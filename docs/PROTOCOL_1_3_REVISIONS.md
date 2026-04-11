# Protocol v1.3 — Desktop-Driven Sync

## Overview

Protocol v1.3 replaces the phone-driven batch sync with a desktop-driven query model. The phone is stateless — it answers queries and pushes real-time events. Each desktop independently manages its own sync state, supporting multiple desktops connected to the same phone without interference.

### Design Principles

1. **Phone is stateless** — no sync timestamps, no per-desktop tracking, no "last batch sent". Phone just answers queries and pushes events.
2. **Desktop drives everything** — desktop decides what to sync, when, and how much. Each desktop maintains its own sync progress in its local database.
3. **Progressive sync** — render useful content fast (thread list + snippets), then fill in message history in the background based on recency and user activity.
4. **Priority-based** — active (open) thread > recent threads > old threads. User-visible data always syncs first.
5. **Sequential orchestration** — all sync operations are queued and executed one at a time. No concurrent queries. No race conditions.

---

## Connection States

```
DISCONNECTED → CONNECTING → CONNECTED → THREAD_SYNC → MESSAGE_SYNC → READY
                                              ↑              ↑
                                              └──────────────┘
                                        (user opens thread → pause background sync,
                                         sync that thread, resume background sync)
```

All state transitions are driven by the desktop. The phone does not influence state transitions — it only responds to queries and pushes events.

---

## Generic Query System

All data retrieval uses a single request/response pattern over WebSocket. This replaces the bespoke `fosslink.sms.sync_start`, `fosslink.sms.sync_batch`, `fosslink.sms.sync_complete` packet types from v1.2.

### Request

Desktop sends:
```json
{
  "type": "fosslink.query",
  "body": {
    "queryId": "<uuid>",
    "resource": "threads.list",
    "params": { ... }
  }
}
```

### Response (paginated)

Phone executes the full query internally, splits results into pages of 20 items, and sends pages using ACK-based flow control:

```json
{
  "type": "fosslink.query.result",
  "body": {
    "queryId": "<uuid>",
    "pageId": "<uuid>",
    "page": 1,
    "totalPages": 5,
    "data": [ ... ]
  }
}
```

### ACK-Based Flow Control

The phone uses a sliding window of 20 pages in-flight:

1. Phone sends up to 20 pages immediately after executing the query.
2. Each page has a unique `pageId`.
3. Desktop processes each page and sends an ACK:
   ```json
   { "type": "fosslink.query.ack", "body": { "queryId": "<uuid>", "pageId": "<uuid>" } }
   ```
4. For each ACK the phone receives, it sends 1 additional page (maintaining the 20-page window).
5. When all pages have been sent and ACKed, the query is complete.

### Query Complete Signal

The last page is identifiable by `page === totalPages`. When the desktop receives and processes the last page, the query is complete. No separate "query complete" packet is needed.

### No Timeouts

There are no query timeouts. If the WebSocket connection is open, the query is in progress. If the WebSocket dies, the desktop drops ALL in-progress query state. On reconnect, the sync process starts from scratch.

### Desktop-Side Query Abstraction

The desktop has a `QueryClient` class that:
1. Generates a `queryId` (UUID)
2. Sends the query request
3. Collects pages as they arrive (matched by `queryId`)
4. Sends ACKs for each processed page
5. Resolves a Promise with the full concatenated result when all pages are received
6. Rejects the Promise if the WebSocket disconnects

All sync logic calls `queryClient.query(resource, params)` and gets back a Promise of the complete result. The pagination is invisible to the caller.

### Available Query Resources

| Resource | Params | Returns |
|----------|--------|---------|
| `threads.list` | `{}` | All threads: `threadId`, `addresses`, `snippet`, `snippetDate`, `unreadCount` |
| `threads.messages` | `{ threadId, sinceDate?, untilDate? }` | Messages in time range for a thread. If no dates, returns all messages. |
| `contacts.list` | `{}` | All contacts: `uid`, `name`, `phones`, `photoHash` |
| `contacts.photos` | `{ uids: string[] }` | Contact photos as base64 for requested UIDs |

---

## Real-Time Events

Independently of the query system, the phone pushes events over the WebSocket as they happen. Events are NOT part of the query system — they use a separate packet type and are processed immediately regardless of what sync phase is active.

### Subscribe

On connect, desktop sends:
```json
{ "type": "fosslink.subscribe", "body": {} }
```

Phone acknowledges and begins pushing events.

### Event Types

```json
{ "type": "fosslink.event", "body": { "eventType": "message.new", "data": { ... } } }
{ "type": "fosslink.event", "body": { "eventType": "message.deleted", "data": { "messageId": 123 } } }
{ "type": "fosslink.event", "body": { "eventType": "thread.deleted", "data": { "threadId": 456 } } }
{ "type": "fosslink.event", "body": { "eventType": "contact.changed", "data": { "uid": "..." } } }
```

Events are fire-and-forget from the phone. No ACKs. If the desktop misses an event (WebSocket dies), the next reconnect sync catches up.

### Event Handling During Sync

When a real-time event arrives during an active sync operation:
- **Apply immediately** to the database and UI.
- **If sync is in progress for any thread**: mark that thread as needing a quick-resync (1 week or since-last-sync, whichever is larger) after all current sync operations complete.
- **If no sync is in progress (READY state)**: apply the event and do nothing else. The event itself is the authoritative update.

---

## Sync Phases

### Phase 1: Connect (DISCONNECTED → CONNECTED)

1. WebSocket connects to phone's advertised address.
2. Identity exchange (`kdeconnect.identity` packets, both directions).
3. Pairing verification (`kdeconnect.pair` if not already trusted).
4. Desktop sends `fosslink.subscribe` to start receiving real-time events.
5. Phone acknowledges subscription.
6. State → **CONNECTED**.

### Phase 2: Thread Sync (CONNECTED → THREAD_SYNC)

7. **Stale thread detection**: Scan all local threads where `full_sync_complete = 1` and `full_sync_date < (now - 6 days)`. Reset those to `full_sync_complete = 0`. This marks them for full resync on next user open.

8. Desktop queries `threads.list` — phone returns all threads with snippets.

9. **Diff thread list**:
   - For each thread from phone: if it exists locally, compare snippet date. If phone's snippet is newer, update the snippet and mark thread for message sync.
   - For new threads (phone has, desktop doesn't): create in DB with snippet.
   - For deleted threads (desktop has, phone doesn't): delete from DB.

10. Desktop queries `contacts.list` — phone returns all contacts with photo hashes.

11. **Diff contacts**: compare photo hashes, request photos for new/changed contacts via `contacts.photos` query.

12. **Render immediately**: thread list and contact names are now up to date. The UI shows current threads with snippets even before any message history is synced.

13. State → **THREAD_SYNC complete**.

### Phase 3: Background Message Sync (THREAD_SYNC → MESSAGE_SYNC)

14. Sort threads by most recent message date (newest first).

15. Filter to threads where the most recent message is less than 1 month old (or all threads on first-ever sync — see "First-Time Experience" below).

16. For each thread, determine the quick-sync window:
    - If `full_sync_date > 0`: window = `max(1 week, now - full_sync_date)`, capped at 3 months.
    - If `full_sync_date = 0` (never fully synced): window = 1 week.

17. For each thread in order:
    - Query `threads.messages { threadId, sinceDate: (now - window) }`.
    - Insert/update messages in desktop DB.
    - Deduplicate by message `_id` (real-time events may have already inserted some).

18. Status shows **"Syncing... X%"** where X = `(threads processed / total threads to process) * 100`.

19. If a real-time event arrives during this phase:
    - Apply immediately.
    - Flag the affected thread for a post-sync quick-resync.

20. When all threads are processed:
    - If `initial_sync_complete` is not set: set `initial_sync_complete = 1`, `initial_sync_date = now`.
    - Process any threads flagged for post-sync quick-resync.

21. State → **READY**.

### Phase 4: On-Demand Full Thread Sync (user opens a thread)

This phase only triggers when the user opens a thread that has `full_sync_complete = 0` (never fully synced, or marked stale after 6 days).

22. **First-time full sync** (thread has never been fully synced):
    - Pause background message sync (Phase 3) if it's running.
    - Show **"Synchronizing Conversation..."** banner with progress bar at top of message thread.
    - Query `threads.messages { threadId }` (no date filter — all messages).
    - Insert messages into DB as pages arrive.
    - Progress bar: `(pages received / totalPages) * 100`.
    - On complete: set `full_sync_complete = 1`, `full_sync_date = now`.
    - If user switches to a different thread: abort query, resume background sync.

23. **Stale resync** (thread was previously fully synced, but `full_sync_date < now - 6 days`):
    - Do NOT show banner — user already has recent messages from the quick-sync.
    - Query `threads.messages { threadId }` (all messages) silently in background.
    - Use Option B delete detection: track seen message `_id`s during the sync walk. After completion, delete any local messages NOT seen (they were deleted on the phone).
    - On complete: set `full_sync_complete = 1`, `full_sync_date = now`.
    - If user switches to a different thread: abort, resume background sync.

24. **Thread already current** (fully synced within 6 days):
    - Quick 1-week resync in background (no banner).
    - Any new messages appear via real-time events.

25. After on-demand sync completes, resume background message sync (Phase 3) if it was paused.

### Delete Detection (Option B)

When performing a full thread sync (Phase 4, steps 22-23):

1. Create a Set of seen message `_id` values.
2. As each page of messages arrives from the phone, add all `_id` values to the Set and upsert into DB.
3. After all pages are processed, query local DB for all messages in that thread.
4. Delete any local messages whose `_id` is NOT in the seen Set.

This handles messages deleted on the phone during the stale period without causing UI flicker.

---

## Reconnect Behavior

### Normal Reconnect (WebSocket drops, phone reconnects)

1. Desktop detects disconnect (ping/pong timeout or WebSocket close event).
2. State → DISCONNECTED.
3. Desktop begins broadcasting UDP discovery.
4. Phone reconnects (hears broadcast, initiates WebSocket).
5. Process restarts from Phase 1.
6. Since `initial_sync_complete` is already set, Phase 3 uses `max(1 week, time since last sync)` windows instead of 1 month. This is typically a fast sync.

### OS Standby/Resume

1. `powerMonitor.on('resume')` fires.
2. Desktop force-disconnects the WebSocket (the connection is likely stale).
3. Discovery and auto-reconnect proceed normally.
4. Process restarts from Phase 1.

### Read/Unread Persistence

Desktop maintains `locally_read_at` timestamps on conversations. These are NOT affected by resyncs. A thread marked read locally stays read even if the phone reports it as unread. The phone's `read` flag is used only for initial state on first sync.

---

## First-Time Experience

On the very first connection (no local data, `initial_sync_complete = 0`):

1. Phase 2 (Thread Sync) creates all threads from scratch.
2. Phase 3 (Background Message Sync) syncs 1 week of messages for all threads with activity in the last month.
3. The user sees threads and recent messages quickly.
4. When the user opens a thread, Phase 4 triggers a full sync with the "Synchronizing Conversation..." banner.
5. After Phase 3 completes for all threads, `initial_sync_complete = 1` is set.

---

## Multi-Desktop Support

Each desktop maintains its own:
- `full_sync_complete` and `full_sync_date` per thread
- `initial_sync_complete` flag
- `locally_read_at` timestamps
- Message database

The phone has no awareness of how many desktops are connected or what each has synced. It simply answers queries and pushes events. Two desktops connected simultaneously will each independently query the phone and maintain their own state.

---

## Sync Log

An in-memory ring buffer (last ~1000 entries) records sync activity for debugging:

- Each entry: `{ timestamp, category, message }`
- Categories: `connect`, `thread-sync`, `message-sync`, `query`, `event`, `error`
- Accessible from Settings → "Sync Log" button → opens a panel with auto-scrolling text
- Auto-scrolls unless the user scrolls up (same behavior as message thread). Resumes auto-scroll when the user scrolls back to the bottom.
- Clears on app restart (not persisted to disk)

---

## Database Schema Changes (Desktop)

### Existing tables (no changes)

- `conversations` — thread list with snippets
- `messages` — message history
- `attachments` — MMS attachment metadata
- `contacts` — contact list
- `sync_state` — key/value store for sync flags

### New sync_state keys

| Key | Value | Description |
|-----|-------|-------------|
| `initial_sync_complete` | `'0'` or `'1'` | Set after Phase 3 completes for the first time |
| `initial_sync_date` | epoch ms string | When initial sync completed |

### New conversation columns

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `full_sync_complete` | INTEGER | 0 | 1 if full message history has been synced for this thread |
| `full_sync_date` | INTEGER | 0 | Epoch ms when last full sync completed |

---

## Phone-Side Changes from v1.2

### Removed
- `fosslink.sms.sync_start` — no longer used
- `fosslink.sms.sync_batch` — replaced by generic query system
- `fosslink.sms.sync_complete` — no longer used
- `fosslink.sms.sync_ack` — replaced by `fosslink.query.ack`
- `lastSyncTimestamp` handling — phone no longer tracks sync state

### Added
- `fosslink.query` — generic query request handler
- `fosslink.query.result` — paginated query response
- `fosslink.query.ack` — page acknowledgment (flow control)
- `fosslink.subscribe` — start real-time event push
- `fosslink.event` — real-time event push (replaces `fosslink.sms.event`)
- Query handlers for: `threads.list`, `threads.messages`, `contacts.list`, `contacts.photos`

### Unchanged
- Identity exchange (`kdeconnect.identity`)
- Pairing (`kdeconnect.pair`, `fosslink.pair_confirm`, `fosslink.unpair`)
- SMS send (`fosslink.sms.send_mms`, `fosslink.sms.send_status`)
- Gallery (`fosslink.gallery.*`)
- Filesystem (`fosslink.fs.*`)
- Phone dial, URL sharing, find my phone, battery, storage — all unchanged

---

## Packet Type Summary

### Connection & Pairing (unchanged)
```
kdeconnect.identity          Both directions    Device identification
kdeconnect.pair              Both directions    Pairing request/response
fosslink.pair_confirm        Phone → Desktop    Pairing code confirmation
fosslink.unpair              Both directions    Unpair request
```

### Query System (new)
```
fosslink.query               Desktop → Phone    Query request { queryId, resource, params }
fosslink.query.result        Phone → Desktop    Paginated response { queryId, pageId, page, totalPages, data }
fosslink.query.ack           Desktop → Phone    Page processed { queryId, pageId }
```

### Real-Time Events (new, replaces fosslink.sms.event)
```
fosslink.subscribe           Desktop → Phone    Start event push
fosslink.event               Phone → Desktop    Real-time event { eventType, data }
```

### SMS Send (unchanged)
```
fosslink.sms.send_mms        Desktop → Phone    Send message
fosslink.sms.send_status     Phone → Desktop    Send status update
fosslink.sms.mark_read       Desktop → Phone    Mark thread read
fosslink.sms.delete          Desktop → Phone    Delete message
fosslink.sms.delete_thread   Desktop → Phone    Delete thread
```

### Other Features (unchanged)
```
fosslink.gallery.*           Both directions    Gallery scan, thumbnails
fosslink.fs.*                Both directions    Filesystem mount, watch
fosslink.contacts.photo_*    Both directions    Contact photo sync
fosslink.battery             Phone → Desktop    Battery state
fosslink.phone.dial          Desktop → Phone    Phone dial
fosslink.url.share           Desktop → Phone    URL sharing
fosslink.findphone.*         Both directions    Find my phone
fosslink.storage.*           Both directions    Storage analysis
fosslink.contacts.migration* Both directions    Contact migration
```

---

## Version Compatibility

- Desktop v1.3 with phone v1.2: Desktop detects old phone (no `fosslink.query` support), falls back to v1.2 sync protocol.
- Desktop v1.2 with phone v1.3: Phone detects old desktop (receives `fosslink.sms.sync_start` instead of `fosslink.query`), handles v1.2 protocol.
- Both sides v1.3: New query-based sync protocol is used.

The `clientVersion` and `minPeerVersion` fields in the identity packet control this. Desktop v1.3 sets `MIN_PEER_VERSION = '1.2.0'` (backward compatible with v1.2 phones) and `CLIENT_VERSION = '1.3.0'`. The new query system is only used when both sides are v1.3+.
