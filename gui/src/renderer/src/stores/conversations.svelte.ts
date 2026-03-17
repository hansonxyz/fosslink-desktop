/**
 * Conversations Store
 *
 * Manages conversation list, spam filtering, search, and selection.
 * Enriches raw ConversationRow data with contact names and display info.
 */

import { findContactByPhone } from './contacts.svelte'
import { formatPhone, normalizePhone } from '../lib/phone'
import { getInitials, getAvatarColor } from '../lib/avatar'
import { isVerificationMessage } from '../lib/verification'

export const conversations = $state({
  raw: [] as ConversationRow[],
  loading: false,
  selectedThreadId: null as number | null,
  searchQuery: '',
  showSpam: false,
  showUnreadOnly: false,
  composingNew: false,
  composeAddress: null as string | null,
})

/**
 * Enrich a raw ConversationRow into a DisplayConversation.
 * Uses contacts store for name resolution.
 */
function enrichConversation(row: ConversationRow): DisplayConversation {
  let addresses: string[]
  try {
    const parsed = JSON.parse(row.addresses) as unknown
    addresses = Array.isArray(parsed) ? (parsed as string[]) : [row.addresses]
  } catch {
    addresses = row.addresses.includes(',')
      ? row.addresses.split(',').map((a) => a.trim())
      : [row.addresses]
  }

  const primaryAddress = addresses[0] ?? ''
  const contact = findContactByPhone(primaryAddress)
  const isContactKnown = contact !== undefined

  let displayName: string
  if (contact) {
    displayName = contact.name
  } else if (addresses.length > 1) {
    displayName = addresses.map(formatPhone).join(', ')
  } else {
    displayName = formatPhone(primaryAddress)
  }

  const avatarKey = contact?.name ?? primaryAddress
  const initials = contact ? getInitials(contact.name) : '#'
  const color = getAvatarColor(avatarKey)

  // Effective unread: if we've locally read this thread at or after the latest
  // message timestamp, treat it as read regardless of the phone's unread state
  const locallyRead = row.locally_read_at !== null && row.locally_read_at >= row.date
  const phoneRead = row.read === 1
  const effectivelyRead = locallyRead || phoneRead
  const effectiveUnread = effectivelyRead ? 0 : row.unread_count

  return {
    threadId: row.thread_id,
    addresses,
    displayName,
    snippet: row.snippet ?? '',
    date: row.date,
    read: effectivelyRead,
    unreadCount: effectiveUnread,
    isContact: isContactKnown,
    hasOutgoing: row.has_outgoing === 1,
    avatarInitials: initials,
    avatarColor: color,
    avatarPhoto: contact?.photo_path ? `xyzattachment://contact-photo/${contact.uid}` : null,
  }
}

/**
 * Derived: filtered + enriched conversation list.
 * Exposed as a getter-based reactive object (same pattern as effectiveState).
 */
export const displayConversations: { current: DisplayConversation[] } = {
  get current(): DisplayConversation[] {
    let list = conversations.raw.map(enrichConversation)

    // Default: only show known contacts, threads we've replied to,
    // and verification code threads
    if (!conversations.showSpam) {
      list = list.filter(
        (c) => c.isContact || c.hasOutgoing || isVerificationMessage(c.snippet),
      )
    }

    // Unread-only filter
    if (conversations.showUnreadOnly) {
      list = list.filter((c) => c.unreadCount > 0)
    }

    // Apply search filter
    if (conversations.searchQuery.trim()) {
      const q = conversations.searchQuery.toLowerCase()
      list = list.filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) ||
          c.snippet.toLowerCase().includes(q) ||
          c.addresses.some((a) => a.includes(q)),
      )
    }

    // Inject temp compose entry at the top (after filtering)
    if (conversations.composingNew && conversations.composeAddress) {
      const addr = conversations.composeAddress
      const contact = findContactByPhone(addr)
      const displayName = contact ? contact.name : formatPhone(addr)
      const avatarKey = contact?.name ?? addr
      const initials = contact ? getInitials(contact.name) : '#'
      const color = getAvatarColor(avatarKey)
      list.unshift({
        threadId: -1,
        addresses: [addr],
        displayName,
        snippet: '',
        date: Date.now(),
        read: true,
        unreadCount: 0,
        isContact: contact !== undefined,
        hasOutgoing: false,
        avatarInitials: initials,
        avatarColor: color,
        avatarPhoto: contact?.photo_path ? `xyzattachment://contact-photo/${contact.uid}` : null,
      })
    }

    return list
  },
}

let refreshTimer: ReturnType<typeof setTimeout> | undefined
let hasLoadedOnce = false

/**
 * Refresh conversations from daemon (debounced).
 * During sync, hundreds of sms.messages notifications fire per second.
 * Debounce ensures we fetch at most once per 500ms.
 * First call fires immediately for fast startup.
 */
export function refreshConversations(): void {
  if (!hasLoadedOnce) {
    hasLoadedOnce = true
    void doRefreshConversations()
    return
  }
  if (refreshTimer !== undefined) return
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined
    void doRefreshConversations()
  }, 500)
}

async function doRefreshConversations(): Promise<void> {
  conversations.loading = true
  try {
    const rows = (await window.api.invoke('sms.conversations')) as ConversationRow[]
    // Atomic replacement — avoids intermediate empty state that could
    // cause selectedConversation to flash null during notification storms
    conversations.raw = rows
  } catch {
    // Not connected — leave current state
  } finally {
    conversations.loading = false
  }
}

/** Select a conversation by thread ID. */
export function selectConversation(threadId: number | null): void {
  conversations.selectedThreadId = threadId
  // Clicking a real conversation exits compose mode
  if (threadId !== null && threadId !== -1) {
    exitCompose()
    if (document.hasFocus()) {
      markThreadRead(threadId)
    }
  }
}

/**
 * Mark a thread as locally read. Updates the daemon DB and the local
 * raw data so the unread badge disappears immediately without waiting
 * for a full conversations refresh.
 */
export function markThreadRead(threadId: number): void {
  const now = Date.now()
  // Optimistic update: set locally_read_at in the local store immediately
  const row = conversations.raw.find((r) => r.thread_id === threadId)
  if (row) {
    row.locally_read_at = now
  }
  // Persist to daemon DB (fire and forget)
  void window.api.invoke('sms.mark_thread_read', { threadId }).catch(() => {})
}

/** Enter compose mode for a new conversation. */
export function startCompose(): void {
  conversations.composingNew = true
  conversations.composeAddress = null
  conversations.selectedThreadId = null
}

/** Exit compose mode. */
export function exitCompose(): void {
  conversations.composingNew = false
  conversations.composeAddress = null
}

/** Set the address for the temp compose entry. */
export function setComposeAddress(address: string): void {
  conversations.composeAddress = address
}

/**
 * Find a thread ID by address. Scans conversations.raw for a matching
 * address (normalized comparison). Returns thread_id or null.
 */
export function findThreadByAddress(address: string): number | null {
  const normalized = normalizePhone(address)
  for (const row of conversations.raw) {
    let addresses: string[]
    try {
      const parsed = JSON.parse(row.addresses) as unknown
      addresses = Array.isArray(parsed) ? (parsed as string[]) : [row.addresses]
    } catch {
      addresses = row.addresses.includes(',')
        ? row.addresses.split(',').map((a) => a.trim())
        : [row.addresses]
    }
    if (addresses.some((a) => normalizePhone(a) === normalized)) {
      return row.thread_id
    }
  }
  return null
}

/** Toggle spam filter. */
export function toggleSpamFilter(): void {
  conversations.showSpam = !conversations.showSpam
}

/** Toggle unread-only filter. */
export function toggleUnreadFilter(): void {
  conversations.showUnreadOnly = !conversations.showUnreadOnly
}

/** Set search query. */
export function setSearchQuery(query: string): void {
  conversations.searchQuery = query
}

/**
 * Initialize the conversations store. Call from App.svelte onMount.
 * Returns a cleanup function.
 */
export function initConversationsStore(): () => void {
  const handleNotification = (method: string, _params: unknown): void => {
    if (
      method === 'sms.conversations_updated' ||
      method === 'sms.messages' ||
      method === 'sync.completed' ||
      method === 'contacts.updated'
    ) {
      void refreshConversations()
    }
  }

  window.api.onNotification(handleNotification)

  return () => {
    window.api.offNotification(handleNotification)
  }
}
