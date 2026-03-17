/**
 * Attachments Store
 *
 * Manages on-demand downloading of MMS attachments.
 * When a message with attachments scrolls into view, the component calls
 * requestDownload() which triggers the daemon to fetch the file from the phone.
 * State is tracked per attachment (partId+messageId) to avoid duplicate requests.
 *
 * The daemon queues downloads and waits for a phone connection before sending
 * requests. "Not connected" errors are not counted as retries — they simply
 * remain in 'downloading' state. When the device reconnects, the daemon
 * resumes its queue and the GUI re-requests any that were stuck.
 *
 * NOTE: Uses a plain $state object (not Map) because Svelte 5's reactive proxy
 * for Map does not reliably trigger re-renders for .get() readers when .set()
 * is called. Plain objects with string keys work correctly.
 */

import { markAttachmentDownloaded } from './messages.svelte'

type AttachmentState = 'idle' | 'downloading' | 'ready' | 'error'

interface AttachmentEntry {
  state: AttachmentState
  error?: string
  retryCount: number
  /** Original attachment info for re-requesting on reconnect */
  att?: AttachmentInfo
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000

const states: Record<string, AttachmentEntry> = $state({})

function key(partId: number, messageId: number): string {
  return `${partId}:${messageId}`
}

export function getAttachmentState(partId: number, messageId: number): AttachmentState {
  return states[key(partId, messageId)]?.state ?? 'idle'
}

/**
 * Build an xyzattachment:// URL for a downloaded attachment.
 * Only valid when the attachment state is 'ready'.
 */
export function getAttachmentUrl(partId: number, messageId: number): string {
  return `xyzattachment://file/${partId}/${messageId}`
}

/**
 * Build an xyzattachment:// URL for a thumbnail.
 */
export function getThumbnailUrl(partId: number, messageId: number): string {
  return `xyzattachment://thumb/${partId}/${messageId}`
}

/**
 * Request download for all attachments of a message.
 * Skips attachments already downloaded or in progress.
 */
export function requestDownload(attachments: AttachmentInfo[]): void {
  for (const att of attachments) {
    const k = key(att.partId, att.messageId)
    const existing = states[k]

    // Already downloaded (from DB) — mark as ready immediately
    if (att.downloaded) {
      if (!existing || existing.state !== 'ready') {
        states[k] = { state: 'ready', retryCount: 0 }
      }
      continue
    }

    // Already downloading or ready
    if (existing && (existing.state === 'downloading' || existing.state === 'ready')) {
      continue
    }

    // Start download (or retry if previously errored)
    const retryCount = existing?.retryCount ?? 0
    window.api.log('renderer', 'Starting attachment download', {
      partId: String(att.partId),
      messageId: String(att.messageId),
      kind: att.kind,
      retryCount: String(retryCount),
    })
    states[k] = { state: 'downloading', retryCount, att }
    void doDownload(att, retryCount)
  }
}

async function doDownload(att: AttachmentInfo, retryCount: number): Promise<void> {
  const k = key(att.partId, att.messageId)
  try {
    window.api.log('renderer', 'Invoking sms.get_attachment', {
      partId: String(att.partId),
      messageId: String(att.messageId),
    })
    const result = await window.api.invoke('sms.get_attachment', {
      partId: att.partId,
      messageId: att.messageId,
    })
    window.api.log('renderer', 'Attachment download succeeded', {
      partId: String(att.partId),
      messageId: String(att.messageId),
      result: JSON.stringify(result),
    })
    states[k] = { state: 'ready', retryCount }
    markAttachmentDownloaded(att.partId, att.messageId)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const isNotConnected = errMsg.includes('not connected') || errMsg.includes('Not connected')

    window.api.log('renderer', 'Attachment download failed', {
      partId: String(att.partId),
      messageId: String(att.messageId),
      error: errMsg,
      retryCount: String(retryCount),
      isNotConnected: String(isNotConnected),
    })

    if (isNotConnected) {
      // Don't count "not connected" as a retry — the daemon will queue
      // the request and resume when the phone reconnects.
      // Keep state as 'downloading' so the UI shows a spinner, not an error.
      states[k] = { state: 'downloading', retryCount, att }
      return
    }

    if (retryCount < MAX_RETRIES) {
      // Retry after delay for real errors (timeouts, etc.)
      const nextRetry = retryCount + 1
      window.api.log('renderer', 'Scheduling attachment retry', {
        partId: String(att.partId),
        messageId: String(att.messageId),
        nextRetry: String(nextRetry),
        delayMs: String(RETRY_DELAY_MS * nextRetry),
      })
      states[k] = { state: 'downloading', retryCount: nextRetry, att }
      setTimeout(() => {
        // Only retry if still in downloading state (user might have switched threads)
        const current = states[k]
        if (current?.state === 'downloading') {
          void doDownload(att, nextRetry)
        }
      }, RETRY_DELAY_MS * nextRetry)
    } else {
      states[k] = {
        state: 'error',
        error: errMsg,
        retryCount,
      }
    }
  }
}

/**
 * Re-request downloads for attachments stuck in 'downloading' state.
 * Called when the device reconnects so queued items get another chance.
 */
export function retryPendingDownloads(): void {
  let retried = 0
  for (const k of Object.keys(states)) {
    const entry = states[k]
    if (entry?.state === 'downloading' && entry.att) {
      retried++
      void doDownload(entry.att, entry.retryCount)
    }
  }
  if (retried > 0) {
    window.api.log('renderer', 'Retrying pending downloads on reconnect', {
      count: String(retried),
    })
  }
}

/**
 * Mark an attachment as ready (downloaded) from a daemon notification.
 * This handles the case where the IPC call timed out or errored but
 * the daemon eventually completed the download in the background.
 */
export function notifyAttachmentReady(partId: number, messageId: number): void {
  const k = key(partId, messageId)
  const existing = states[k]
  if (existing?.state === 'ready') return
  window.api.log('renderer', 'Attachment marked ready via notification', {
    partId: String(partId),
    messageId: String(messageId),
    previousState: existing?.state ?? 'idle',
  })
  states[k] = { state: 'ready', retryCount: existing?.retryCount ?? 0 }
}

/**
 * Clear all tracked attachment states (call when switching threads).
 */
export function clearAttachmentStates(): void {
  for (const k of Object.keys(states)) {
    delete states[k]
  }
}
