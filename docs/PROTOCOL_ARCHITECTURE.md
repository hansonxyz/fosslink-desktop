# Protocol Architecture

FossLink has its own protocol. There is no dual-mode system, no "standard vs enhanced", no adapter pattern. There is one protocol with one set of handlers that are always active.

## Protocol Overview

FossLink uses newline-delimited JSON packets over TLS. Packet types fall into two namespaces:

- **`kdeconnect.*`** -- Used for the discovery, identity, and pairing layers only. These are retained for wire compatibility with the KDE Connect discovery format.
- **`fosslink.*`** -- Used for all application-level features: sync, real-time events, MMS send, contact photos.

This is not two modes. It is one protocol where the low-level connection setup (`kdeconnect.identity`, `kdeconnect.pair`) uses the legacy namespace, and everything above that uses `fosslink.*` packet types.

## Connection Flow

1. UDP discovery on port 1716 (broadcast format shared with KDE Connect for compatibility)
2. TCP connect to peer's advertised port
3. Exchange `kdeconnect.identity` packets (plain text)
4. TLS upgrade (roles inverted: TCP server = TLS client)
5. Protocol v8: Exchange identity again over TLS
6. Pairing via `kdeconnect.pair`
7. Application packets (`fosslink.*`) flow freely

## Code Structure

```
src/protocol/
  packet-router.ts           Routes incoming packets to handlers by type
  pairing-handler.ts         Handles kdeconnect.pair packets
  standard/                  Base protocol operations
    sms-handler.ts             SMS request/response (kdeconnect.sms.*)
    contacts-handler.ts        Contact sync (kdeconnect.contacts.*)
    notification-handler.ts    Phone notifications (kdeconnect.notification)
  enhanced/                  FossLink application protocol
    enhanced-sync-handler.ts   Reliable batch sync (fosslink.sms.sync_*)
    event-handler.ts           Real-time push events (fosslink.sms.event)
```

The `standard/` and `enhanced/` directories are organizational groupings, not separate modes. All handlers are registered and active at all times. The `standard/` handlers cover base operations that use the `kdeconnect.*` packet namespace (SMS request/response, contacts, notifications). The `enhanced/` handlers cover the FossLink-specific features that use `fosslink.*` packets.

## Design Principles

1. **All handlers always active** -- There is no mode switching. Every handler registers with the packet router at startup and handles its packet types.
2. **Same database output** -- All handlers write to the same tables and fire the same IPC notifications.
3. **GUI is protocol-agnostic** -- The GUI reads from the database and receives IPC notifications. It does not know or care about packet types.

## Packet Types

### Discovery / Identity / Pairing (kdeconnect.* namespace)

These use the KDE Connect namespace for wire compatibility with the discovery layer:

```
kdeconnect.identity              Both directions    Device identification
kdeconnect.pair                  Both directions    Pairing request/response
kdeconnect.sms.request_conversations  Desktop -> Phone    Request conversation list
kdeconnect.sms.request_conversation   Desktop -> Phone    Request thread messages
kdeconnect.sms.messages          Phone -> Desktop   Messages from phone
kdeconnect.sms.request           Desktop -> Phone   Send SMS
kdeconnect.sms.request_attachment     Desktop -> Phone    Request attachment download
kdeconnect.sms.attachment_file   Phone -> Desktop   Attachment data
kdeconnect.contacts.request_all_uids_timestamps  Desktop -> Phone
kdeconnect.contacts.request_vcards_by_uid        Desktop -> Phone
kdeconnect.contacts.response_vcards              Phone -> Desktop
kdeconnect.notification          Phone -> Desktop   Phone notifications
```

### Reliable Sync (Phase 4)

```
fosslink.sms.sync_start       Desktop -> Phone   { lastSyncTimestamp }
fosslink.sms.sync_batch       Phone -> Desktop   { messages[], batchIndex, totalBatches }
fosslink.sms.sync_complete    Phone -> Desktop   { messageCount, latestTimestamp }
fosslink.sms.sync_ack         Desktop -> Phone   { latestTimestamp }
```

### Real-Time Events (Phase 5)

```
fosslink.sms.event            Phone -> Desktop   { event, data, eventId }
fosslink.sms.event_ack        Desktop -> Phone   { eventIds[] }
fosslink.sms.mark_read        Desktop -> Phone   { threadId }
fosslink.sms.delete           Desktop -> Phone   { messageId }
fosslink.sms.delete_thread    Desktop -> Phone   { threadId }
```

### MMS Send (Phase 6)

```
fosslink.sms.send_mms         Desktop -> Phone   { addresses[], body, attachments[] }
fosslink.sms.send_status      Phone -> Desktop   { requestId, status, messageId?, error? }
```

### Contact Photos (Phase 7)

```
fosslink.contacts.photo_hashes     Phone -> Desktop   { "uid": "sha256", ... }
fosslink.contacts.request_photos   Desktop -> Phone   { uids[] }
fosslink.contacts.photo            Phone -> Desktop   { uid, mimeType } + payload
```

## Android Side

The Android companion app registers handlers for `fosslink.*` packet types via its plugin system (`XyzSyncPlugin`, `XyzEventPlugin`). Identity packets include `clientType` and `clientVersion` fields so each side knows the peer's capabilities.

## Shared Infrastructure

- **Network**: UDP discovery, TCP connections, TLS upgrade
- **Identity exchange and pairing**: `kdeconnect.identity`, `kdeconnect.pair`
- **Database**: SQLite persistence (single schema)
- **IPC**: Same notification contract to GUI
- **State machine**: Tracks connection state and transitions
