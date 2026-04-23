/**
 * Send Queue Store
 *
 * Manages optimistic display of outgoing messages while they're queued
 * for delivery. Messages appear instantly in the thread with a "Sending..."
 * status, then disappear once the phone confirms delivery (the synced
 * version replaces them).
 *
 * Uses a reactive array (not Map) for reliable Svelte 5 cross-module
 * reactivity. Handles the race condition where the daemon's
 * sms.send_status notification arrives before the sms.send IPC response.
 */

export type SendStatus = 'sending' | 'sent' | 'timeout' | 'failed'

export interface PendingMessage {
  queueId: string
  daemonQueueId: string | null
  threadId: number
  recipients: string[]
  body: string
  attachments: DraftAttachment[]
  date: number
  status: SendStatus
}

// Reactive array — Svelte 5 reliably tracks array mutations (.push, .splice)
let pending: PendingMessage[] = $state([])

// Daemon queueId → our local tempId (for notification lookup)
const daemonToTemp = new Map<string, string>()

// Notifications that arrive before the IPC response (race condition buffer)
const earlyStatuses = new Map<string, 'sent' | 'timeout' | 'failed'>()

// Delayed-removal timers for 'sent' messages (5s grace period)
const removalTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Provider for current message rows, registered by the messages store.
// Used so we can check if the phone has already delivered a matching
// outgoing message (fast phone response beating our ghost) without
// creating a circular import between send-queue and messages.
let rowsProvider: (() => MessageRow[]) | null = null

export function setRowsProvider(fn: () => MessageRow[]): void {
  rowsProvider = fn
}

/** Does the given rows list already contain an outgoing message matching
 *  (threadId, body) whose date is recent enough to be from this send? */
function rowsContainMatch(
  rows: MessageRow[],
  threadId: number,
  body: string,
  ghostDate: number,
): boolean {
  for (const r of rows) {
    if (r.thread_id !== threadId) continue
    if (r.type !== 2) continue
    if ((r.body ?? '') !== body) continue
    if (r.date < ghostDate - 5_000) continue
    if (r.date > ghostDate + 60_000) continue
    return true
  }
  return false
}

function removeGhost(idx: number): void {
  const msg = pending[idx]!
  if (msg.attachments.length > 0) {
    window.api.cleanupDrafts(msg.attachments.map((a) => a.draftId))
  }
  const timer = removalTimers.get(msg.queueId)
  if (timer) {
    clearTimeout(timer)
    removalTimers.delete(msg.queueId)
  }
  if (msg.daemonQueueId) daemonToTemp.delete(msg.daemonQueueId)
  pending.splice(idx, 1)
}

/** Remove any pending ghosts whose real message has arrived in the given
 *  rows. Call from the messages store after a row refresh. */
export function clearMatchingPending(rows: MessageRow[]): void {
  if (pending.length === 0) return
  for (let i = pending.length - 1; i >= 0; i--) {
    const p = pending[i]!
    // Attachments-only ghosts have empty body — skip matching (tight body
    // match isn't reliable and the 5s 'sent' timer will clean up).
    if (p.body.length === 0) continue
    if (rowsContainMatch(rows, p.threadId, p.body, p.date)) {
      removeGhost(i)
    }
  }
}

function findIndex(queueId: string): number {
  return pending.findIndex((msg) => msg.queueId === queueId)
}

function removeByQueueId(queueId: string): void {
  const idx = findIndex(queueId)
  if (idx !== -1) {
    const msg = pending[idx]!
    if (msg.attachments.length > 0) {
      window.api.cleanupDrafts(msg.attachments.map((a) => a.draftId))
    }
    pending.splice(idx, 1)
  }
}

/**
 * Get all pending messages for a given thread, sorted by date.
 */
export function getPendingMessages(threadId: number): PendingMessage[] {
  return pending.filter((msg) => msg.threadId === threadId)
}

/**
 * Queue a message for sending. Shows it optimistically in the UI
 * and fires the IPC call to the daemon.
 */
export async function sendMessage(
  threadId: number,
  recipients: string[],
  body: string,
  attachments: DraftAttachment[] = [],
): Promise<void> {
  const tempId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  // Spread to plain arrays — Svelte 5 $state arrays are Proxy objects
  // that can't be cloned by Electron's structured clone algorithm.
  const plainRecipients = [...recipients]
  const plainAttachments = [...attachments]

  const sendDate = Date.now()

  const msg: PendingMessage = {
    queueId: tempId,
    daemonQueueId: null,
    threadId,
    recipients: plainRecipients,
    body,
    attachments: plainAttachments,
    date: sendDate,
    status: 'sending',
  }

  // Pre-check: if the phone already reported a matching outgoing message
  // (ultra-fast response that beat our ghost render), skip the ghost entirely.
  // This runs synchronously before push so we never even flash a ghost in
  // that race. Body-only match — attachment sends always ghost through.
  const skipGhost =
    body.length > 0 &&
    rowsProvider !== null &&
    rowsContainMatch(rowsProvider(), threadId, body, sendDate)

  if (!skipGhost) {
    // Immediately visible in the UI
    pending.push(msg)
  }

  try {
    const ipcParams: Record<string, unknown> = { recipients: plainRecipients, body }
    if (plainAttachments.length > 0) {
      ipcParams['attachments'] = plainAttachments.map((a) => ({
        filePath: a.filePath,
        fileName: a.fileName,
        mimeType: a.mimeType,
      }))
    }

    const result = (await window.api.invoke('sms.send', ipcParams)) as {
      queueId: string
    }

    // If we skipped the ghost there's nothing to map or apply status to —
    // the real message is already on screen from the phone's fast response.
    if (skipGhost) {
      earlyStatuses.delete(result.queueId)
      return
    }

    // Record the daemon→temp mapping
    daemonToTemp.set(result.queueId, tempId)

    // Store daemon ID on the message (needed for cancel)
    const idx = findIndex(tempId)
    if (idx !== -1) {
      pending[idx]!.daemonQueueId = result.queueId
    }

    // Check if notification already arrived before this response (race condition)
    const earlyStatus = earlyStatuses.get(result.queueId)
    if (earlyStatus) {
      earlyStatuses.delete(result.queueId)
      applyStatus(tempId, result.queueId, earlyStatus)
    }
  } catch (err) {
    if (skipGhost) {
      window.api.log('renderer', 'Send queue error (no ghost)', {
        error: err instanceof Error ? err.message : String(err),
      })
      return
    }
    // IPC call itself failed (daemon not connected, etc.)
    const idx = findIndex(tempId)
    if (idx !== -1) {
      pending[idx]!.status = 'timeout'
    }
    window.api.log('renderer', 'Send queue error', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Apply a resolved status to a pending message.
 * 'sent' marks the message and schedules removal after 5 seconds.
 * 'timeout' marks the message for retry/cancel UI.
 */
function applyStatus(tempId: string, daemonQueueId: string, status: 'sent' | 'timeout' | 'failed'): void {
  const idx = findIndex(tempId)
  if (idx === -1) return

  if (status === 'sent') {
    pending[idx]!.status = 'sent'
    // Remove after 5 seconds unless clearSentMessages() cleans it up first
    const timer = setTimeout(() => {
      removalTimers.delete(tempId)
      removeByQueueId(tempId)
      daemonToTemp.delete(daemonQueueId)
    }, 5000)
    removalTimers.set(tempId, timer)
  } else if (status === 'timeout' || status === 'failed') {
    pending[idx]!.status = status
  }
}

/**
 * Remove all confirmed-sent messages immediately.
 * Call when new messages arrive from the phone (the synced
 * versions replace the optimistic ones).
 */
export function resetSendQueue(): void {
  for (const timer of removalTimers.values()) clearTimeout(timer)
  removalTimers.clear()
  daemonToTemp.clear()
  earlyStatuses.clear()
  pending.length = 0
}

export function clearSentMessages(): void {
  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i]!.status === 'sent') {
      const queueId = pending[i]!.queueId
      const daemonId = pending[i]!.daemonQueueId
      // Cancel the 5s timer
      const timer = removalTimers.get(queueId)
      if (timer) {
        clearTimeout(timer)
        removalTimers.delete(queueId)
      }
      if (daemonId) daemonToTemp.delete(daemonId)
      pending.splice(i, 1)
    }
  }
}

/**
 * Remove all pending messages for a given threadId.
 * Used when a temp compose thread resolves to a real thread.
 */
export function clearPendingForThread(threadId: number): void {
  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i]!.threadId === threadId) {
      const queueId = pending[i]!.queueId
      const daemonId = pending[i]!.daemonQueueId
      const timer = removalTimers.get(queueId)
      if (timer) {
        clearTimeout(timer)
        removalTimers.delete(queueId)
      }
      if (daemonId) daemonToTemp.delete(daemonId)
      pending.splice(i, 1)
    }
  }
}

/**
 * Cancel a pending message. Removes from UI and tells daemon to cancel.
 */
export async function cancelSend(queueId: string): Promise<void> {
  const idx = findIndex(queueId)
  const daemonId = idx !== -1 ? pending[idx]!.daemonQueueId : null
  removeByQueueId(queueId)

  if (daemonId) {
    daemonToTemp.delete(daemonId)
    try {
      await window.api.invoke('sms.cancel_send', { queueId: daemonId })
    } catch {
      // Daemon may have already sent it — that's fine
    }
  }
}

/**
 * Retry a timed-out message.
 */
export async function retrySend(queueId: string): Promise<void> {
  const idx = findIndex(queueId)
  if (idx === -1) return

  const msg = pending[idx]!
  const { threadId, recipients, body, attachments, daemonQueueId } = msg

  // Clean up old entry (don't clean up drafts — we're reusing them)
  pending.splice(idx, 1)
  if (daemonQueueId) {
    daemonToTemp.delete(daemonQueueId)
  }

  // Re-queue as a new send with the same attachments
  await sendMessage(threadId, recipients, body, attachments)
}

/**
 * Handle sms.send_status notification from daemon.
 */
function handleSendStatus(queueId: string, status: 'sent' | 'timeout' | 'failed'): void {
  const tempId = daemonToTemp.get(queueId)
  if (tempId) {
    // Normal path: IPC response already arrived, we know the mapping
    applyStatus(tempId, queueId, status)
  } else {
    // Race condition: notification arrived before IPC response.
    // Buffer it — sendMessage() will check when the response lands.
    earlyStatuses.set(queueId, status)
  }
}

/**
 * Initialize the send queue store. Call from App.svelte onMount.
 * Returns a cleanup function.
 */
export function initSendQueueStore(): () => void {
  const handleNotification = (method: string, params: unknown): void => {
    if (method === 'sms.send_status') {
      const data = params as { queueId?: string; status?: string } | null
      if (data?.queueId && data?.status) {
        handleSendStatus(data.queueId, data.status as 'sent' | 'timeout' | 'failed')
      }
    }
  }

  window.api.onNotification(handleNotification)

  return () => {
    window.api.offNotification(handleNotification)
  }
}
