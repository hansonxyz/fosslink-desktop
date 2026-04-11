# Protocol v1.3 Implementation Plan

This document describes the phased implementation of Protocol v1.3 (desktop-driven sync). Each phase is independently testable via a debug console. See `PROTOCOL_1_3_REVISIONS.md` for the full protocol specification.

---

## Architecture Overview

### Layer 1: Transport — Generic Query System

```
src/sync/query-client.ts       Desktop: send queries, collect pages, return Promises
src/sync/query-types.ts        Shared TypeScript types

Android:
  network/QueryServer.kt       Phone: receive queries, paginate, ACK flow control
  network/QueryHandler.kt      Interface for resource handlers
```

`QueryClient` exposes `query(resource, params): Promise<data[]>`. Pagination is invisible to callers. ACK-based flow control (window of 20 pages). No timeouts — WebSocket death rejects all pending queries.

### Layer 2: Resource Handlers — What the phone can answer

```
Android:
  query/ThreadsListHandler.kt       threads.list → all threads with snippets
  query/ThreadsMessagesHandler.kt   threads.messages → messages with date filters
  query/ContactsListHandler.kt      contacts.list → all contacts with photo hashes
  query/ContactsPhotosHandler.kt    contacts.photos → base64 photos for UIDs
```

Each handler is a pure function: `(params) → data[]`. No state, no pagination knowledge. QueryServer calls the handler, paginates the result, sends with flow control.

### Layer 3: Sync Operations — Units of work

```
src/sync/operations/
  thread-list-sync.ts      Query threads.list, diff against local DB
  contact-sync.ts          Query contacts.list, diff photos
  quick-message-sync.ts    Sync messages for one thread within a time window
  full-thread-sync.ts      Sync all messages for one thread + delete detection
  batch-quick-sync.ts      Run quick-message-sync on a list of threads with progress
```

Each operation takes a `QueryClient` and database reference, returns a Promise, can be aborted, and logs to the debug console.

### Layer 4: Sync Orchestrator — State machine + queue

```
src/sync/sync-orchestrator.ts    State machine, operation queue, priority interrupts
```

Owns the state machine (DISCONNECTED → CONNECTED → THREAD_SYNC → MESSAGE_SYNC → READY). Maintains a FIFO operation queue. Handles priority interrupts (user opens thread). Manages stale thread detection and quick-sync window calculation.

### Layer 5: Event Listener — Real-time events

```
src/sync/event-listener.ts      Process fosslink.event, apply to DB, flag threads
```

Independent of the orchestrator. Always processes events immediately. Flags threads for post-sync resync when sync is active.

### Layer 6: Debug Console

```
src/sync/debug-console.ts       Command registry, output buffer, log levels
src/sync/debug-commands.ts       Command handlers

gui/src/renderer/src/components/SyncConsole.svelte    xterm.js terminal + controls
```

Interactive terminal for observing and controlling all sync operations.

---

## Debug Console

### Log Levels

Every level includes the gold orchestrator narrative. The dropdown controls detail depth:

| Level | Detail shown (in addition to gold narrative) |
|-------|----------------------------------------------|
| **Operations** | Gold narrative only — what the orchestrator is doing and why |
| **Queries** | + query sent/completed with item counts and timing |
| **Transport** | + individual pages received, ACKs sent, flow control state |
| **Trace** | + raw packet JSON (truncated to 200 chars) |

### Gold Narrative Messages

Always visible at every log level. Bold gold text. Examples:

```
Phone connected (Pixel 7)
Subscribing to real-time events
Synchronizing thread list...
Thread list synced — 47 threads (2 new, 1 deleted)
Synchronizing messages — 32 threads with activity in last month
Syncing thread 42 (Karla) — messages since 14 days ago
Thread 42 synced — 23 messages
Background sync complete — 32/32 threads (100%)
Ready
User opened thread 42 (Karla) — full sync required (never synced)
Synchronizing full history of thread 42...
Thread 42 full sync complete — 1,847 messages, 3 deleted
```

### Commands

Commands are registered in a `CommandRegistry` — a map of name → handler. The orchestrator calls the same handlers internally, so testing a command tests the real code path.

```
help                              List all commands
status                            State machine state, queue, connection info
clear                             Clear console output

query <resource> [params...]      Run a raw query
  query threads.list
  query threads.messages 42 --since=7d
  query contacts.list

sync <operation> [args...]        Run a sync operation
  sync threads                    ThreadListSync
  sync contacts                   ContactSync
  sync messages 42                QuickMessageSync on thread 42
  sync messages 42 --full         FullThreadSync on thread 42
  sync all                        Full Phase 2→3 sequence

subscribe                         Start real-time event subscription
unsubscribe                       Stop events

stale <threadId|all>              Mark thread(s) as stale
reset                             Clear all sync state flags

queue                             Show operation queue
pause                             Pause orchestrator
resume                            Resume orchestrator
abort                             Abort current operation

ws <json>                         Send raw WebSocket message
state                             Show state machine transition history
db threads                        Show local threads with sync flags
db messages <threadId> --last=N   Show last N messages in a thread
```

---

## Implementation Phases

### Phase 0: Debug Console + Sync Log

**Goal**: Build the debug infrastructure used by all subsequent phases.

**Desktop files:**
- `src/sync/debug-console.ts` — `DebugConsole` singleton class
  - Ring buffer (~5000 lines)
  - `log(level, category, message)` — writes to buffer
  - `registerCommand(name, handler)` — adds to command registry
  - `execute(input)` — parses and dispatches command
  - Log levels: `'narrative' | 'query' | 'transport' | 'trace'`
  - Narrative level messages are always included regardless of selected filter
- `gui/src/renderer/src/components/SyncConsole.svelte` — xterm.js terminal
  - Log level dropdown at top
  - Terminal renders colored output from DebugConsole buffer
  - Command input at prompt
  - Auto-scroll unless user scrolls up (resume on scroll to bottom)
- Wire into Settings as "Sync Console" button → opens body panel
- Register initial commands: `help`, `status`, `clear`

**Test**: Open Sync Console from Settings. Type `help`, see command list. Type `status`, see current state. Verify auto-scroll behavior.

---

### Phase 1: Query Transport Layer

**Goal**: Generic paginated query system over WebSocket. Test with an echo handler.

**Desktop files:**
- `src/sync/query-types.ts` — types:
  ```typescript
  interface QueryRequest { queryId: string; resource: string; params: Record<string, unknown> }
  interface QueryResultPage { queryId: string; pageId: string; page: number; totalPages: number; data: unknown[] }
  interface QueryAck { queryId: string; pageId: string }
  ```
- `src/sync/query-client.ts` — `QueryClient` class:
  - `query(resource, params): Promise<unknown[]>` — main API
  - Generates UUID queryId, sends `fosslink.query`, collects pages by queryId
  - Sends `fosslink.query.ack` for each page processed
  - Rejects all pending queries on disconnect
  - One query at a time (queues if busy)
  - Logs to DebugConsole at query/transport/trace levels
- `src/sync/query-client.ts` — wire `setSendFunction` / `clearSendFunction` (same pattern as gallery handler)
- Register `fosslink.query.result` in message router → route to QueryClient

**Phone files:**
- `network/QueryServer.kt` — receives `fosslink.query`, dispatches to handler map
  - Maintains in-flight page window (max 20)
  - Listens for `fosslink.query.ack`, sends next page on ACK
  - Handler interface: `fun handle(params: JSONObject): List<JSONObject>`
- `query/EchoHandler.kt` — test handler, returns params as data items

**Debug commands (Phase 1):**
- `query echo {"items": [1,2,...40]}` — test round-trip with echo handler
- `ws <json>` — send raw WebSocket message

**Test**: `query echo {"items":[1,2,...40]}` → verify 2 pages received, ACKs sent, result is 40 items. Disconnect during query → verify clean rejection.

---

### Phase 2: Phone Resource Handlers

**Goal**: Real data from the phone via the query system.

**Phone files:**
- `query/ThreadsListHandler.kt` — queries Telephony.Sms + Telephony.Mms ContentProviders for threads
  - Returns: `threadId`, `addresses`, `snippet`, `snippetDate`, `unreadCount`
- `query/ThreadsMessagesHandler.kt` — queries messages for a thread
  - Params: `threadId` (required), `sinceDate` (optional), `untilDate` (optional)
  - Returns: `_id`, `threadId`, `address`, `body`, `date`, `type`, `read`, `sub_id`, `event`, plus MMS part metadata
- `query/ContactsListHandler.kt` — queries ContactsContract
  - Returns: `uid`, `name`, `phones`, `emails`, `photoHash`
- `query/ContactsPhotosHandler.kt` — returns base64-encoded photos
  - Params: `uids` (string array)
  - Returns: `uid`, `mimeType`, `data` (base64)
- Register all handlers in `QueryServer.kt` handler map

**Debug commands (Phase 2):**
- `query threads.list` — see all threads
- `query threads.messages <threadId>` — all messages in thread
- `query threads.messages <threadId> --since=7d` — last 7 days
- `query contacts.list` — all contacts

**Test**: Run each query, verify real data. Test threads.messages with date filters. Test a large thread (thousands of messages) — verify pagination and ACK flow control.

---

### Phase 3: Sync Operations

**Goal**: Desktop-side sync logic that queries the phone and updates the local DB.

**Desktop files:**
- `src/sync/operations/thread-list-sync.ts` — `ThreadListSync`
  - Queries `threads.list`
  - Diffs against local DB: new threads, deleted threads, updated snippets
  - Returns `{ added: number, removed: number, updated: number }`
- `src/sync/operations/contact-sync.ts` — `ContactSync`
  - Queries `contacts.list`
  - Diffs photo hashes, fetches changed photos via `contacts.photos`
  - Returns `{ total: number, photosUpdated: number }`
- `src/sync/operations/quick-message-sync.ts` — `QuickMessageSync`
  - Queries `threads.messages` with `sinceDate`
  - Upserts messages into local DB (dedup by `_id`)
  - Returns `{ messagessynced: number }`
- `src/sync/operations/full-thread-sync.ts` — `FullThreadSync`
  - Queries `threads.messages` with no date filter (all messages)
  - Upserts messages, tracks seen `_id`s
  - After completion: deletes local messages NOT in seen set (Option B delete detection)
  - Sets `full_sync_complete = 1`, `full_sync_date = now` on thread
  - Returns `{ messagessynced: number, deleted: number }`
- `src/sync/operations/batch-quick-sync.ts` — `BatchQuickSync`
  - Takes sorted list of threads + time windows
  - Runs `QuickMessageSync` for each sequentially
  - Reports progress: `(completed / total) * 100`
  - Can be aborted between threads

**DB schema changes:**
- Add `full_sync_complete INTEGER DEFAULT 0` to conversations
- Add `full_sync_date INTEGER DEFAULT 0` to conversations
- Add `initial_sync_complete` and `initial_sync_date` keys to sync_state

**Debug commands (Phase 3):**
- `sync threads` — run ThreadListSync, show diff results
- `sync contacts` — run ContactSync, show results
- `sync messages <threadId>` — run QuickMessageSync (1 week default)
- `sync messages <threadId> --since=30d` — custom window
- `sync messages <threadId> --full` — run FullThreadSync
- `db threads` — show local threads with sync flags
- `db messages <threadId> --last=5` — show recent messages

**Test**: Run each sync individually. Send a text, run `sync messages <thread>`, verify it appears. Delete a message on phone, run `sync messages <thread> --full`, verify delete detection.

---

### Phase 4: Event Listener

**Goal**: Real-time events from phone, applied independently of sync.

**Phone files:**
- Update `SmsEventHandler.kt` → emit `fosslink.event` packets instead of `fosslink.sms.event`
  - Event types: `message.new`, `message.deleted`, `thread.deleted`, `contact.changed`
- Add `fosslink.subscribe` handler in ConnectionService — enables event pushing for that connection

**Desktop files:**
- `src/sync/event-listener.ts` — `EventListener` class
  - Processes `fosslink.event` packets
  - Applies to DB (upsert message, delete message, delete thread, mark contact dirty)
  - Emits IPC notifications (UI updates)
  - Maintains a `Set<number>` of thread IDs flagged for post-sync resync
  - Method: `getAndClearFlaggedThreads(): number[]`
- Register `fosslink.event` and `fosslink.subscribe` in message router
- Send `fosslink.subscribe` on connection

**Debug commands (Phase 4):**
- `subscribe` — manually subscribe to events
- `unsubscribe` — stop events
- Events appear in log as green text automatically
- `flags` — show threads flagged for resync

**Test**: Subscribe, send a text, verify event in log + message in UI. Delete a message on phone, verify delete event. Run a sync operation, send a text during it, verify thread gets flagged.

---

### Phase 5: Sync Orchestrator

**Goal**: Wire everything into the automated state machine.

**Desktop files:**
- `src/sync/sync-orchestrator.ts` — `SyncOrchestrator` class
  - State machine: DISCONNECTED → CONNECTED → THREAD_SYNC → MESSAGE_SYNC → READY
  - Operation queue (FIFO)
  - `onConnected()` — queues: [ThreadListSync, ContactSync, BatchQuickSync]
  - `onDisconnected()` — aborts current op, clears queue
  - `onThreadOpened(threadId)` — pause queue, insert FullThreadSync or QuickMessageSync, resume
  - `onThreadClosed()` — if priority op was running, abort and resume queue
  - Stale thread detection on connect: reset `full_sync_complete` where date > 6 days
  - Quick-sync window: `max(1 week, now - full_sync_date)`, capped at 3 months
  - First-time: `full_sync_date = 0` → 1 week window
  - After BatchQuickSync completes: check EventListener flagged threads, run quick-sync on them
  - Progress: `{ phase, percent, currentThread }` exposed for UI
  - All operations log gold narrative messages to DebugConsole

**Integration:**
- Daemon creates SyncOrchestrator on init, passes QueryClient + EventListener + DB
- Connection handler calls `orchestrator.onConnected()`
- Disconnect handler calls `orchestrator.onDisconnected()`
- IPC: thread selection notifies `orchestrator.onThreadOpened(id)`
- IPC: resync calls `orchestrator.resync()` (clears all sync state, restarts)

**Debug commands (Phase 5):**
- `status` — shows orchestrator state, current op, queue depth
- `queue` — shows queued operations
- `pause` / `resume` — manual orchestrator control
- `abort` — abort current operation
- `stale <threadId|all>` — mark threads stale for testing
- `reset` — clear all sync flags
- `state` — show state machine transition history

**Test**: Connect to phone, watch full automated sequence in console. Open a thread during background sync, verify pause/priority/resume. Disconnect WiFi, verify clean abort. Reconnect, verify fresh start with correct windows. Simulate stale with `stale all`, reconnect, verify behavior.

---

### Phase 6: UI Integration + Cleanup

**Goal**: Replace old sync system, polish UI, ship.

**Changes:**
- StatusIndicator reads from orchestrator state/progress
- "Synchronizing Conversation..." banner in MessageThread for first-ever full thread sync
- Silent resync (no banner) for stale threads that were previously fully synced
- Remove old `EnhancedSyncHandler` and related v1.2 sync code
- Remove old `EventHandler`, `GalleryEventHandler` event ack system (events are now fire-and-forget)
- Update Android: remove `SmsSyncHandler.kt` (replaced by query handlers)
- Update `CLIENT_VERSION = '1.3.0'`, keep `MIN_PEER_VERSION = '1.2.0'` for backward compat
- Move debug console button behind dev-build flag (or a hidden setting)

**Debug commands (Phase 6):**
- Same as Phase 5 + `db threads` showing real UI sync state

**Test**: Full end-to-end with clean install. Test with large message history (friend's Galaxy). Test multi-desktop (two PCs connected). Test standby/resume. Test the 6-day stale logic. Verify auto-updater still works with new version.

---

## File Summary

### New Desktop Files
```
src/sync/
  debug-console.ts              Singleton: log buffer, command registry
  debug-commands.ts             All command handlers
  query-client.ts               Generic paginated query client
  query-types.ts                Shared types
  event-listener.ts             Real-time event processor
  sync-orchestrator.ts          State machine, queue, progress
  operations/
    thread-list-sync.ts         Diff thread list
    contact-sync.ts             Diff contacts + photos
    quick-message-sync.ts       Time-windowed message sync
    full-thread-sync.ts         Full thread sync + delete detection
    batch-quick-sync.ts         Sequential multi-thread sync

gui/src/renderer/src/components/
  SyncConsole.svelte            xterm.js debug terminal
```

### New Phone Files
```
network/
  QueryServer.kt               Query dispatch + pagination + flow control
  QueryHandler.kt              Handler interface

query/
  ThreadsListHandler.kt        threads.list resource
  ThreadsMessagesHandler.kt    threads.messages resource
  ContactsListHandler.kt       contacts.list resource
  ContactsPhotosHandler.kt     contacts.photos resource
```

### Modified Files
```
Desktop:
  src/core/daemon.ts            Wire orchestrator, remove old sync
  src/network/ws-server.ts      Route new packet types
  src/ipc/handlers.ts           Expose orchestrator state to GUI
  src/database/database.ts      Add full_sync_complete/date columns

Android:
  service/ConnectionService.kt  Register query handlers, subscribe handler
  sms/SmsEventHandler.kt        Emit fosslink.event instead of fosslink.sms.event
```

### Removed Files (Phase 6)
```
Desktop:
  src/protocol/enhanced/enhanced-sync-handler.ts    Replaced by orchestrator + operations
  src/protocol/enhanced/event-handler.ts            Replaced by event-listener.ts

Android:
  sms/SmsSyncHandler.kt                             Replaced by query handlers
```
