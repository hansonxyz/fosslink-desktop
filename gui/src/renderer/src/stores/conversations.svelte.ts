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
import { filterList } from './filter-list.svelte'

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
  const primaryContact = findContactByPhone(primaryAddress)
  // For spam filtering: known if any participant is in contacts
  const isContactKnown = addresses.some((a) => findContactByPhone(a) !== undefined)

  let displayName: string
  if (addresses.length > 1) {
    // Group thread: resolve each address to contact name or formatted number
    displayName = addresses.map((a) => {
      const c = findContactByPhone(a)
      return c ? c.name : formatPhone(a)
    }).join(', ')
  } else if (primaryContact) {
    displayName = primaryContact.name
  } else {
    displayName = formatPhone(primaryAddress)
  }

  const avatarKey = primaryContact?.name ?? primaryAddress
  const initials = primaryContact ? getInitials(primaryContact.name) : '#'
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
    avatarPhoto: primaryContact?.photo_path ? `xyzattachment://contact-photo/${primaryContact.uid}` : null,
  }
}

/**
 * Derived: filtered + enriched conversation list.
 * Exposed as a getter-based reactive object (same pattern as effectiveState).
 */
export const displayConversations: { current: DisplayConversation[] } = {
  get current(): DisplayConversation[] {
    let list = conversations.raw.map(enrichConversation)

    // Always hide threads on the filter list
    list = list.filter((c) => !filterList.isFiltered(c.addresses))

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
 * Refresh conversations from daemon (trailing debounce).
 * During sync, many notifications fire in bursts. Trailing debounce ensures
 * the sidebar always reflects the final state after a burst settles.
 * First call fires immediately for fast startup.
 */
export function refreshConversations(): void {
  if (!hasLoadedOnce) {
    hasLoadedOnce = true
    void doRefreshConversations()
    return
  }
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined
    void doRefreshConversations()
  }, 100)
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
  const prevThreadId = conversations.selectedThreadId
  conversations.selectedThreadId = threadId
  // Clicking a real conversation exits compose mode
  if (threadId !== null && threadId !== -1) {
    exitCompose()
    if (document.hasFocus()) {
      markThreadRead(threadId)
    }
    // Notify orchestrator that a thread was opened (triggers full sync if needed)
    void window.api.invoke('sync.thread_opened', { threadId }).catch(() => {})
  } else if (prevThreadId !== null) {
    // Notify orchestrator that the thread was closed
    void window.api.invoke('sync.thread_closed', {}).catch(() => {})
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
    if (addresses.length === 1 && normalizePhone(addresses[0]!) === normalized) {
      return row.thread_id
    }
  }
  return null
}

/**
 * Find a thread ID whose address set exactly matches the given addresses.
 * Order-independent, normalized comparison. Returns thread_id or null.
 */
export function findThreadByAddressSet(addresses: string[]): number | null {
  const normalizedSet = new Set(addresses.map(normalizePhone))
  for (const row of conversations.raw) {
    let rowAddresses: string[]
    try {
      const parsed = JSON.parse(row.addresses) as unknown
      rowAddresses = Array.isArray(parsed) ? (parsed as string[]) : [row.addresses]
    } catch {
      rowAddresses = row.addresses.includes(',')
        ? row.addresses.split(',').map((a) => a.trim())
        : [row.addresses]
    }
    if (rowAddresses.length !== normalizedSet.size) continue
    const rowNormalized = rowAddresses.map(normalizePhone)
    if (rowNormalized.every((a) => normalizedSet.has(a))) {
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
