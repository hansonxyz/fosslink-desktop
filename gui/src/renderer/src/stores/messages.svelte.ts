/**
 * Messages Store
 *
 * Manages messages for the currently selected thread.
 * Enriches raw MessageRow data with display info (time labels, date separators, sender names).
 *
 * Key design: The conversation-level sync only stores 1 message per thread (the snippet).
 * When the user views a thread, we request the full history from the phone. But the phone
 * may be disconnected at that moment, so we track a "pending" thread ID and fire the
 * request when the phone next connects (device.connected notification).
 */

import { findContactByPhone } from './contacts.svelte'
import { clearSentMessages } from './send-queue.svelte'
import { markThreadRead, refreshConversations, conversations } from './conversations.svelte'
import { scrollState } from './scroll.svelte'
import { retryPendingDownloads, notifyAttachmentReady } from './attachments.svelte'
import { settings } from './settings.svelte'
import { formatTimestampBadge, isDifferentDay, TIMESTAMP_GAP_MS } from '../lib/message-format'
import { formatPhone } from '../lib/phone'
import { isVerificationMessage } from '../lib/verification'
import { parseTapback } from '../lib/tapback'
import { t } from './i18n.svelte'

export const messages = $state({
  threadId: null as number | null,
  rows: [] as MessageRow[],
  loading: false,
})

/** Raw attachment rows from the daemon, keyed by message_id */
const attachmentsByMessage = $state(new Map<number, AttachmentInfo[]>())

/** Optimistic reactions we've sent but haven't been synced back yet.
 *  Keyed by target message _id → array of reactions. */
const pendingReactions = $state(new Map<number, TapbackReaction[]>())

/** Add an optimistic reaction (shown immediately before sync). */
export function addPendingReaction(targetMessageId: number, emoji: string): void {
  const existing = pendingReactions.get(targetMessageId) ?? []
  const senderName = t('export.me')
  if (!existing.some((r) => r.emoji === emoji && r.senderName === senderName)) {
    existing.push({ emoji, senderName })
    pendingReactions.set(targetMessageId, existing)
  }
}

/** Clear all pending reactions (called when thread reloads after sync). */
export function clearPendingReactions(): void {
  pendingReactions.clear()
}

function classifyMimeType(mime: string): AttachmentInfo['kind'] {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'other'
}

/**
 * Enrich raw message rows into DisplayMessages.
 * Memoized via $derived — only recomputes when messages.rows changes,
 * not on every access (critical for virtual scroll performance).
 *
 * Also detects iPhone tapback reactions (e.g. 'Laughed at "text"') and
 * converts them into emoji badges on the target message.
 */
const _displayMessages: DisplayMessage[] = $derived.by(() => {
  const rows = messages.rows

  // --- Pass 1: Identify tapback messages and build reactions map ---
  const tapbackIndices = new Set<number>()
  const reactionsMap = new Map<number, TapbackReaction[]>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    if (!row.body) continue
    const tapback = parseTapback(row.body)
    if (!tapback) continue

    // Search backward for the target message (limit to 200 messages)
    let targetId: number | null = null
    for (let j = i - 1; j >= 0 && j >= i - 200; j--) {
      const candidate = rows[j]!
      if (!candidate.body) continue
      if (tapback.isTruncated) {
        if (candidate.body.startsWith(tapback.quotedText)) {
          targetId = candidate._id
          break
        }
      } else {
        if (candidate.body === tapback.quotedText) {
          targetId = candidate._id
          break
        }
      }
    }

    if (targetId !== null) {
      tapbackIndices.add(i)
      if (tapback.type === 'add') {
        const existing = reactionsMap.get(targetId) ?? []
        const isSentReaction = row.type === 2
        const senderName = isSentReaction
          ? t('export.me')
          : (findContactByPhone(row.address)?.name ?? formatPhone(row.address))
        // Deduplicate: don't add same emoji from same sender
        if (!existing.some((r) => r.emoji === tapback.emoji && r.senderName === senderName)) {
          existing.push({ emoji: tapback.emoji, senderName })
          reactionsMap.set(targetId, existing)
        }
      } else {
        // Remove: cancel matching earlier add
        const existing = reactionsMap.get(targetId)
        if (existing) {
          const idx = existing.findIndex((r) => r.emoji === tapback.emoji)
          if (idx !== -1) existing.splice(idx, 1)
          if (existing.length === 0) reactionsMap.delete(targetId)
        }
      }
    }
    // If no target found, leave it as a regular message (don't hide it)
  }

  // --- Pass 2: Build display messages, skipping matched tapbacks ---
  let lastTimestampDate = 0
  const result: DisplayMessage[] = []

  for (let i = 0; i < rows.length; i++) {
    if (tapbackIndices.has(i)) continue

    const row = rows[i]!
    const prevIdx = findPrevVisibleIndex(i, tapbackIndices)
    const prev = prevIdx >= 0 ? rows[prevIdx]! : null
    const dayChange = prev === null || isDifferentDay(prev.date, row.date)
    const gap = row.date - lastTimestampDate
    const showTimestamp = dayChange || gap >= TIMESTAMP_GAP_MS

    if (showTimestamp) {
      lastTimestampDate = row.date
    }

    const isSent = row.type === 2
    let senderName: string | null = null
    if (!isSent) {
      const contact = findContactByPhone(row.address)
      senderName = contact?.name ?? formatPhone(row.address)
    }

    const atts = attachmentsByMessage.get(row._id) ?? []

    result.push({
      id: row._id,
      threadId: row.thread_id,
      body: row.body ?? (atts.length > 0 ? '' : '[Attachment]'),
      date: row.date,
      isSent,
      senderName,
      showTimestamp,
      timestampLabel: showTimestamp ? formatTimestampBadge(row.date, dayChange) : '',
      attachments: atts,
      reactions: mergeReactions(reactionsMap.get(row._id) ?? [], pendingReactions.get(row._id) ?? []),
    })
  }

  return result
})

/** Merge synced reactions with optimistic pending reactions, deduplicating. */
function mergeReactions(synced: TapbackReaction[], pending: TapbackReaction[]): TapbackReaction[] {
  if (pending.length === 0) return synced
  if (synced.length === 0) return pending
  const result = [...synced]
  for (const p of pending) {
    if (!result.some((r) => r.emoji === p.emoji && r.senderName === p.senderName)) {
      result.push(p)
    }
  }
  return result
}

/** Find the index of the previous visible (non-tapback) row, or -1 */
function findPrevVisibleIndex(currentIndex: number, skipSet: Set<number>): number {
  for (let j = currentIndex - 1; j >= 0; j--) {
    if (!skipSet.has(j)) return j
  }
  return -1
}

export const displayMessages: { current: DisplayMessage[] } = {
  get current(): DisplayMessage[] {
    return _displayMessages
  },
}

/**
 * Load messages for a thread. Resets state and fetches from daemon.
 */
export function resetMessages(): void {
  messages.threadId = null
  messages.rows.length = 0
  messages.loading = false
  attachmentsByMessage.clear()
  pendingReactions.clear()
}

export function loadThread(threadId: number | null): void {
  if (threadId === null) {
    messages.threadId = null
    messages.rows.length = 0
    attachmentsByMessage.clear()
    pendingThreadRequest = null
    prevDbCount = 0
    return
  }

  messages.threadId = threadId
  messages.loading = true
  prevDbCount = 0
  void doLoadThread(threadId)
}

// Thread ID that needs full history but the phone was disconnected
let pendingThreadRequest: number | null = null

// Tracks threads we've already received full data for
const threadsFetched = new Set<number>()

// Track previous message count to detect when new messages arrive from the phone
let prevDbCount = 0

interface DaemonAttachmentRow {
  part_id: number
  message_id: number
  mime_type: string
  downloaded: number
  thumbnail_path: string | null
}

/** Check if refreshed data is identical to current state (avoids reactive churn). */
function isThreadDataUnchanged(rows: MessageRow[], rawAtts: DaemonAttachmentRow[]): boolean {
  const curRows = messages.rows
  if (rows.length !== curRows.length) return false
  // Compare first, last, and a middle row by _id and date (cheap proxy for equality)
  const check = (i: number): boolean =>
    curRows[i]!._id === rows[i]!._id && curRows[i]!.date === rows[i]!.date
  if (rows.length > 0 && !check(0)) return false
  if (rows.length > 1 && !check(rows.length - 1)) return false
  if (rows.length > 2 && !check(rows.length >> 1)) return false
  // Check attachment count matches
  let curAttCount = 0
  for (const [, atts] of attachmentsByMessage) curAttCount += atts.length
  if (rawAtts.length !== curAttCount) return false
  // Check if any attachment download status changed
  for (const att of rawAtts) {
    const existing = attachmentsByMessage.get(att.message_id)
    if (!existing) return false
    const match = existing.find((a) => a.partId === att.part_id)
    if (!match) return false
    if (match.downloaded !== (att.downloaded === 1)) return false
  }
  return true
}

async function doLoadThread(threadId: number): Promise<void> {
  try {
    const [rows, rawAtts] = await Promise.all([
      window.api.invoke('sms.messages', { threadId }) as Promise<MessageRow[]>,
      window.api.invoke('sms.thread_attachments', { threadId }) as Promise<DaemonAttachmentRow[]>,
    ])
    // Only apply if we're still looking at this thread
    if (messages.threadId === threadId) {
      // Skip reactive state update if data hasn't changed (prevents DOM churn
      // during notification storms that trigger repeated thread reloads)
      if (messages.rows.length > 0 && isThreadDataUnchanged(rows, rawAtts)) {
        window.api.log('renderer', 'Thread refresh skipped (unchanged)', {
          threadId: String(threadId),
          messageCount: String(rows.length),
        })
        // Still check pagination state
        const newCount = rows.length
        const gotNewMessages = newCount > prevDbCount
        prevDbCount = newCount
        if (!gotNewMessages && newCount > 1) {
          threadsFetched.add(threadId)
          pendingThreadRequest = null
        }
        return
      }

      window.api.log('renderer', 'Thread loaded', {
        threadId: String(threadId),
        messageCount: String(rows.length),
        attachmentCount: String(rawAtts.length),
      })

      messages.rows.length = 0
      messages.rows.push(...rows)

      // Clear any pending "sent" messages now that real data is in the store.
      // This replaces the optimistic bubbles with their synced versions without
      // the UI gap that occurred when clearing at the notification entry point.
      clearSentMessages()
      // Clear optimistic reactions — the synced tapback messages are now in rows
      pendingReactions.clear()

      // Build attachment map
      attachmentsByMessage.clear()
      for (const att of rawAtts) {
        const info: AttachmentInfo = {
          partId: att.part_id,
          messageId: att.message_id,
          mimeType: att.mime_type,
          downloaded: att.downloaded === 1,
          kind: classifyMimeType(att.mime_type),
          hasThumbnail: !!att.thumbnail_path,
        }
        const existing = attachmentsByMessage.get(att.message_id)
        if (existing) {
          existing.push(info)
        } else {
          attachmentsByMessage.set(att.message_id, [info])
        }
      }

      const newCount = rows.length
      const gotNewMessages = newCount > prevDbCount
      prevDbCount = newCount

      if (threadsFetched.has(threadId)) {
        // Already fully fetched — nothing to do
        pendingThreadRequest = null
      } else if (newCount <= 1) {
        // Only snippet — request first batch from phone
        requestFullThread(threadId)
      } else if (gotNewMessages) {
        // Phone sent us a batch, request the next one using the oldest
        // message timestamp so the phone sends earlier messages
        const oldest = rows[0]!.date
        requestFullThread(threadId, oldest)
      }
      // If !gotNewMessages and newCount > 1, the phone sent an empty/duplicate
      // batch — mark as fully fetched
      if (!gotNewMessages && newCount > 1) {
        threadsFetched.add(threadId)
        pendingThreadRequest = null
      }
    }
  } catch (err) {
    window.api.log('renderer', 'Thread load error', {
      threadId: String(threadId),
      error: err instanceof Error ? err.message : String(err),
    })
  } finally {
    if (messages.threadId === threadId) {
      messages.loading = false
    }
  }
}

function requestFullThread(threadId: number, rangeStartTimestamp?: number): void {
  pendingThreadRequest = threadId
  const params: Record<string, unknown> = { threadId }
  if (rangeStartTimestamp !== undefined) {
    params['rangeStartTimestamp'] = rangeStartTimestamp
  }
  void window.api.invoke('sms.request_thread', params).catch(() => {})
}

/**
 * Mark an attachment as downloaded in the local store (no re-fetch needed).
 */
export function markAttachmentDownloaded(partId: number, messageId: number): void {
  const atts = attachmentsByMessage.get(messageId)
  if (!atts) return
  const att = atts.find((a) => a.partId === partId)
  if (att) att.downloaded = true
}

// Rate-limit desktop notifications: at most one per 5 seconds
let lastNotificationTime = 0
const NOTIFICATION_COOLDOWN = 5000

function showMessageNotification(_threadId?: number): void {
  const now = Date.now()
  if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) return
  lastNotificationTime = now
  try {
    void new Notification('FossLink', { body: t('notification.newMessage'), silent: false })
  } catch {
    // Notification API not available
  }
}

/**
 * Check whether a thread passes the spam filter and would be visible to the user.
 * Used to suppress notifications/flash for spam-filtered threads.
 */
function isThreadVisibleToUser(threadId: number): boolean {
  if (conversations.showSpam) return true
  const row = conversations.raw.find((r) => r.thread_id === threadId)
  if (!row) return true // New thread not yet in list — notify to be safe
  let primaryAddress: string
  try {
    const parsed = JSON.parse(row.addresses) as unknown
    primaryAddress = Array.isArray(parsed) ? (parsed as string[])[0] ?? '' : row.addresses
  } catch {
    primaryAddress = row.addresses.split(',')[0]?.trim() ?? ''
  }
  const isContact = findContactByPhone(primaryAddress) !== undefined
  const hasOutgoing = row.has_outgoing === 1
  const isVerification = isVerificationMessage(row.snippet ?? '')
  return isContact || hasOutgoing || isVerification
}

// Track whether we need to mark the current thread as read when focus returns
let pendingReadOnFocus = false

// Track the newest message date we've already notified about.
// Only flash/notify when newestDate exceeds this (genuinely new message).
let lastNotifiedDate = 0

// Whether the taskbar is currently flashing (so we can stop on focus)
let isFlashing = false

let refreshTimer: ReturnType<typeof setTimeout> | undefined

/**
 * Refresh current thread messages (debounced).
 * Only refreshes if threadId matches the currently viewed thread.
 */
function refreshCurrentThread(threadId?: number): void {
  if (messages.threadId === null) return
  if (threadId !== undefined && threadId !== messages.threadId) return

  if (refreshTimer !== undefined) return
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined
    if (messages.threadId !== null) {
      void doLoadThread(messages.threadId)
    }
  }, 500)
}

/**
 * Mark the current thread as read if the newest message is visible.
 * Called from MessageBubble on copy-code actions.
 */
export function tryMarkCurrentThreadRead(): void {
  if (messages.threadId !== null && scrollState.isAtBottom) {
    markThreadRead(messages.threadId)
  }
}

/**
 * Initialize the messages store. Call from App.svelte onMount.
 * Returns a cleanup function.
 */
export function initMessagesStore(): () => void {
  const handleNotification = (method: string, params: unknown): void => {
    if (method === 'sms.messages') {
      const data = params as { threadId?: number; newestDate?: number } | null
      // Don't call clearSentMessages() here — let the 5-second timer in
      // applyStatus() handle it. Clearing immediately causes a visual gap:
      // the pending bubble disappears before the synced message is fetched
      // and rendered, making the UI jump.
      refreshCurrentThread(data?.threadId)
      // If we're actively viewing this thread, mark it as read (only if focused).
      // BUT only if the conversation actually has unread messages — otherwise we
      // create a feedback loop: mark_read → phone updates read status → content
      // observer fires → phone sends us the message → we mark_read again → ...
      if (data?.threadId !== undefined && data.threadId === messages.threadId) {
        const conv = conversations.raw.find((r) => r.thread_id === data.threadId)
        const hasUnread = conv && conv.unread_count > 0 && (conv.locally_read_at === null || conv.locally_read_at < conv.date)
        if (hasUnread) {
          if (document.hasFocus() && scrollState.isAtBottom) {
            markThreadRead(data.threadId)
          } else {
            pendingReadOnFocus = true
          }
        }
      }
      // Desktop notification + taskbar flash rules:
      // 1. Only for INCOMING messages (thread has unread — outgoing never triggers)
      // 2. Only when window doesn't have focus
      // 3. Only for genuinely NEW messages (newestDate > lastNotifiedDate)
      // 4. Only for recent messages (within 10 min — skip old sync data)
      // 5. Stop on focus regain, never re-trigger until next new incoming
      const TEN_MINUTES = 10 * 60 * 1000
      const newestDate = data?.newestDate ?? 0
      const isNew = newestDate > lastNotifiedDate
      const isRecent = newestDate > 0 && (Date.now() - newestDate) < TEN_MINUTES
      // Check if the thread has unread messages (incoming, not our own sends)
      const conv = data?.threadId !== undefined
        ? conversations.raw.find((r) => r.thread_id === data.threadId)
        : undefined
      const hasUnread = conv ? conv.unread_count > 0 && (conv.locally_read_at === null || conv.locally_read_at < conv.date) : false

      if (!document.hasFocus() && isNew && isRecent && hasUnread) {
        const visible = data?.threadId === undefined || isThreadVisibleToUser(data.threadId!)
        if (visible) {
          lastNotifiedDate = newestDate
          if (settings.notificationsEnabled) {
            showMessageNotification(data?.threadId)
          }
          if (settings.flashTaskbar) {
            window.api.flashTaskbar(true)
            isFlashing = true
            window.api.log('flash', 'Taskbar flash ON', {
              reason: 'New incoming message while unfocused',
              threadId: data?.threadId !== undefined ? String(data.threadId) : 'unknown',
              newestDate: String(newestDate),
            })
          }
        }
      }
    } else if (method === 'sms.event') {
      const data = params as { type?: string; threadId?: number; eventId?: string; messageCount?: number } | null
      if (data?.type === 'read') {
        // Thread marked as read on phone — refresh and stop any stale taskbar flash
        refreshConversations()
        window.api.flashTaskbar(false)
        window.api.log('flash', 'Taskbar flash OFF', {
          reason: 'sms.event type=read (message read on phone)',
          threadId: data.threadId !== undefined ? String(data.threadId) : 'unknown',
        })
      } else if (data?.type === 'deleted' || data?.type === 'thread_deleted') {
        refreshConversations()
        if (data.type === 'thread_deleted' && data.threadId !== undefined && data.threadId === messages.threadId) {
          // Currently viewing deleted thread — navigate away
          messages.threadId = null
          messages.rows = []
        }
        refreshCurrentThread(data?.threadId)
      }
    } else if (method === 'device.connected') {
      // Phone just connected — retry any attachment downloads that were waiting
      retryPendingDownloads()
      // If we have a pending thread request, fire it now
      if (pendingThreadRequest !== null && messages.threadId === pendingThreadRequest) {
        const threadId = pendingThreadRequest
        // Use oldest message timestamp for pagination
        const oldest = messages.rows.length > 0 ? messages.rows[0]!.date : undefined
        window.api.log('renderer', 'Phone connected, retrying thread request', {
          threadId: String(threadId),
          rangeStartTimestamp: oldest !== undefined ? String(oldest) : 'none',
        })
        requestFullThread(threadId, oldest)
      }
    } else if (method === 'sms.attachment_downloaded') {
      const data = params as { partId?: number; messageId?: number } | null
      if (data?.partId !== undefined && data?.messageId !== undefined) {
        markAttachmentDownloaded(data.partId, data.messageId)
        notifyAttachmentReady(data.partId, data.messageId)
      }
    }
  }

  window.api.onNotification(handleNotification)

  const handleFocus = (): void => {
    if (pendingReadOnFocus && messages.threadId !== null && scrollState.isAtBottom) {
      markThreadRead(messages.threadId)
    }
    if (scrollState.isAtBottom) {
      pendingReadOnFocus = false
    }
    // Stop taskbar flash when window regains focus
    if (isFlashing) {
      window.api.flashTaskbar(false)
      isFlashing = false
      window.api.log('flash', 'Taskbar flash OFF', { reason: 'Window regained focus' })
    }
  }
  window.addEventListener('focus', handleFocus)

  return () => {
    window.api.offNotification(handleNotification)
    window.removeEventListener('focus', handleFocus)
    if (refreshTimer !== undefined) {
      clearTimeout(refreshTimer)
      refreshTimer = undefined
    }
  }
}
