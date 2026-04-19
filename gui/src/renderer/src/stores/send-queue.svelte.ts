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

  const msg: PendingMessage = {
    queueId: tempId,
    daemonQueueId: null,
    threadId,
    recipients: plainRecipients,
    body,
    attachments: plainAttachments,
    date: Date.now(),
    status: 'sending',
  }

  // Immediately visible in the UI
  pending.push(msg)

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
