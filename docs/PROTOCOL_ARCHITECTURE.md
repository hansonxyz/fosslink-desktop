# Protocol Architecture

FossLink has its own protocol. There is no dual-mode system, no "standard vs enhanced", no adapter pattern. There is one protocol with one set of handlers that are always active.

## Protocol Overview

FossLink uses newline-delimited JSON packets over TLS. Packet types fall into two namespaces:

- **`kdeconnect.*`** -- Used for the discovery, identity, and pairing layers only. These are retained for wire compatibility with the KDE Connect discovery format.
- **`fosslink.*`** -- Used for all application-level features: sync, real-time events, MMS send, contact photos.

This is not two modes. It is one protocol where the low-level connection setup (`kdeconnect.identity`, `kdeconnect.pair`) uses the legacy namespace, and everything above that uses `fosslink.*` packet types.

## Connection Flow

1. UDP discovery on port 1716 (broadcast packets)
2. Phone connects to desktop's WebSocket server (WSS on port 8716, self-signed TLS)
3. Both sides exchange `kdeconnect.identity` packets (first message on the WebSocket)
4. Pairing via `kdeconnect.pair` (verification code displayed on both sides)
5. Application packets (`fosslink.*`) flow freely over the WebSocket

## Discovery & Broadcasting

Both sides broadcast UDP packets on port 1716 and listen for broadcasts from the other side. The broadcast packet is a flat JSON object with `type`, `deviceId`, `deviceName`, `deviceType`, `wsPort`, and `clientVersion` fields.

**Desktop broadcasting rules:**
- Broadcasts when **no phone is connected** via WebSocket (searching for phone, reconnecting after disconnect, first-time setup, post-unpair)
- **Stops broadcasting** when a phone is connected (no need to advertise)
- Broadcast interval: 5 seconds

**Android broadcasting rules:**
- Broadcasts **only when the app is in the foreground** (Activity visible), regardless of connection state (the phone supports multiple desktop connections)
- **Never broadcasts in the background** — saves battery, avoids Doze issues
- Always **listens passively** for desktop broadcasts, even in background (via foreground service)
- Broadcast interval: 5 seconds

**Reconnection after disconnect:**
- Desktop broadcasts continuously when not connected
- Phone's foreground service passively listens for these broadcasts
- When the phone hears a paired desktop's broadcast, it auto-connects via WebSocket
- If the phone's listener socket dies (Doze, WiFi change), a `ConnectivityManager.NetworkCallback` restarts it

**Connection health (ping/pong):**
- Desktop's WebSocket server pings all connected clients every 30 seconds
- If no pong response by the next interval, the connection is terminated and disconnect callbacks fire
- On OS resume from sleep, an immediate ping is sent to detect stale connections within 5 seconds

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

The Android companion app registers handlers for `fosslink.*` packet types in `ConnectionService`. Identity packets include `clientType`, `clientVersion`, and `minPeerVersion` fields so each side can check compatibility.

## Shared Infrastructure

- **Network**: UDP discovery (port 1716), WebSocket connections (WSS on port 8716)
- **Identity exchange and pairing**: `kdeconnect.identity`, `kdeconnect.pair`
- **Database**: SQLite persistence (single schema, disposable — phone is source of truth)
- **IPC**: JSON-RPC notifications to GUI clients
- **State machine**: INIT → DISCONNECTED → DISCOVERING → PAIRING → CONNECTED → SYNCING → READY
