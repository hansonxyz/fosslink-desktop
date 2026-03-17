/**
 * FossLink v2 Message Types and Serialization
 *
 * Messages are JSON objects sent as WebSocket text frames:
 *   { "type": "fosslink.<type>", "body": { ... } }
 *
 * No newline delimiter (WebSocket frames are self-delimiting).
 * No `id` field. No capability lists. No protocol version negotiation.
 */

import { ErrorCode, ProtocolError } from '../core/errors.js';

// --- Message type constants ---

// Identity & pairing
export const MSG_IDENTITY = 'fosslink.identity' as const;
export const MSG_PAIR_REQUEST = 'fosslink.pair_request' as const;
export const MSG_PAIR_CODE = 'fosslink.pair_code' as const;
export const MSG_PAIR_CONFIRM = 'fosslink.pair_confirm' as const;
export const MSG_PAIR_ACCEPT = 'fosslink.pair_accept' as const;
export const MSG_PAIR_REJECT = 'fosslink.pair_reject' as const;
export const MSG_UNPAIR = 'fosslink.unpair' as const;

// SMS sync
export const MSG_SYNC_START = 'fosslink.sms.sync_start' as const;
export const MSG_SYNC_BATCH = 'fosslink.sms.sync_batch' as const;
export const MSG_SYNC_COMPLETE = 'fosslink.sms.sync_complete' as const;
export const MSG_SYNC_ACK = 'fosslink.sms.sync_ack' as const;

// Real-time events
export const MSG_EVENT = 'fosslink.sms.event' as const;
export const MSG_EVENT_ACK = 'fosslink.sms.event_ack' as const;

// Send SMS/MMS
export const MSG_SMS_SEND = 'fosslink.sms.send' as const;
export const MSG_SMS_SEND_STATUS = 'fosslink.sms.send_status' as const;

// Desktop → Phone commands
export const MSG_MARK_READ = 'fosslink.sms.mark_read' as const;
export const MSG_DELETE = 'fosslink.sms.delete' as const;
export const MSG_DELETE_THREAD = 'fosslink.sms.delete_thread' as const;

// Contacts
export const MSG_CONTACTS_SYNC = 'fosslink.contacts.sync' as const;
export const MSG_CONTACTS_BATCH = 'fosslink.contacts.batch' as const;
export const MSG_CONTACTS_COMPLETE = 'fosslink.contacts.complete' as const;
export const MSG_CONTACTS_PHOTO = 'fosslink.contacts.photo' as const;
export const MSG_CONTACTS_REQUEST_PHOTO = 'fosslink.contacts.request_photo' as const;
export const MSG_CONTACTS_UIDS_RESPONSE = 'fosslink.contacts.uids_response' as const;
export const MSG_CONTACTS_VCARDS_RESPONSE = 'fosslink.contacts.vcards_response' as const;

// Request attachment download
export const MSG_REQUEST_ATTACHMENT = 'fosslink.sms.request_attachment' as const;

// Request conversations / conversation (standard protocol compat during transition)
export const MSG_REQUEST_CONVERSATIONS = 'fosslink.sms.request_conversations' as const;
export const MSG_REQUEST_CONVERSATION = 'fosslink.sms.request_conversation' as const;
export const MSG_SMS_MESSAGES = 'fosslink.sms.messages' as const;
export const MSG_SMS_ATTACHMENT_FILE = 'fosslink.sms.attachment_file' as const;

// Battery
export const MSG_BATTERY = 'fosslink.battery' as const;
export const MSG_BATTERY_REQUEST = 'fosslink.battery.request' as const;

// Find my phone
export const MSG_FINDMYPHONE = 'fosslink.findmyphone' as const;

// Telephony (dial)
export const MSG_DIAL = 'fosslink.telephony.dial' as const;

// Clipboard
export const MSG_CLIPBOARD = 'fosslink.clipboard' as const;

// Notifications
export const MSG_NOTIFICATION = 'fosslink.notification' as const;
export const MSG_NOTIFICATION_DISMISS = 'fosslink.notification.dismiss' as const;

// URL sharing
export const MSG_URL_SHARE = 'fosslink.url.share' as const;

// Settings
export const MSG_SETTINGS = 'fosslink.settings' as const;

// Storage analysis
export const MSG_STORAGE_REQUEST = 'fosslink.storage.request' as const;
export const MSG_STORAGE_ANALYSIS = 'fosslink.storage.analysis' as const;

// App store
export const MSG_OPEN_APP_STORE = 'fosslink.open_app_store' as const;

// Contact migration
export const MSG_CONTACTS_MIGRATION_SCAN = 'fosslink.contacts.migration_scan' as const;
export const MSG_CONTACTS_MIGRATION_SCAN_RESPONSE = 'fosslink.contacts.migration_scan_response' as const;
export const MSG_CONTACTS_MIGRATION_EXECUTE = 'fosslink.contacts.migration_execute' as const;
export const MSG_CONTACTS_MIGRATION_EXECUTE_RESPONSE = 'fosslink.contacts.migration_execute_response' as const;

// Gallery
export const MSG_GALLERY_SCAN = 'fosslink.gallery.scan' as const;
export const MSG_GALLERY_SCAN_RESPONSE = 'fosslink.gallery.scan_response' as const;
export const MSG_GALLERY_THUMBNAIL = 'fosslink.gallery.thumbnail' as const;
export const MSG_GALLERY_THUMBNAIL_RESPONSE = 'fosslink.gallery.thumbnail_response' as const;
export const MSG_GALLERY_MEDIA_EVENT = 'fosslink.gallery.media_event' as const;
export const MSG_GALLERY_MEDIA_EVENT_ACK = 'fosslink.gallery.media_event_ack' as const;

// Filesystem (WebDAV bridge)
export const MSG_FS_STAT = 'fosslink.fs.stat' as const;
export const MSG_FS_STAT_RESPONSE = 'fosslink.fs.stat_response' as const;
export const MSG_FS_READDIR = 'fosslink.fs.readdir' as const;
export const MSG_FS_READDIR_RESPONSE = 'fosslink.fs.readdir_response' as const;
export const MSG_FS_READ = 'fosslink.fs.read' as const;
export const MSG_FS_READ_RESPONSE = 'fosslink.fs.read_response' as const;
export const MSG_FS_WRITE = 'fosslink.fs.write' as const;
export const MSG_FS_WRITE_RESPONSE = 'fosslink.fs.write_response' as const;
export const MSG_FS_MKDIR = 'fosslink.fs.mkdir' as const;
export const MSG_FS_MKDIR_RESPONSE = 'fosslink.fs.mkdir_response' as const;
export const MSG_FS_DELETE = 'fosslink.fs.delete' as const;
export const MSG_FS_DELETE_RESPONSE = 'fosslink.fs.delete_response' as const;
export const MSG_FS_RENAME = 'fosslink.fs.rename' as const;
export const MSG_FS_RENAME_RESPONSE = 'fosslink.fs.rename_response' as const;
export const MSG_FS_WATCH = 'fosslink.fs.watch' as const;
export const MSG_FS_WATCH_RESPONSE = 'fosslink.fs.watch_response' as const;
export const MSG_FS_UNWATCH = 'fosslink.fs.unwatch' as const;
export const MSG_FS_UNWATCH_RESPONSE = 'fosslink.fs.unwatch_response' as const;
export const MSG_FS_WATCH_EVENT = 'fosslink.fs.watch_event' as const;
export const MSG_FS_WATCH_EVENT_ACK = 'fosslink.fs.watch_event_ack' as const;

export const CLIENT_TYPE = 'fosslink' as const;
export const CLIENT_VERSION = '1.0.0' as const;
export const MIN_PEER_VERSION = '1.0.0' as const;

// --- Interfaces ---

export interface ProtocolMessage {
  type: string;
  body: Record<string, unknown>;
}

export interface IdentityBody {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'laptop' | 'phone' | 'tablet';
  clientVersion: string;
  minPeerVersion?: string;
}

// Device ID validation regex: 32-38 alphanumeric + dash/underscore
const DEVICE_ID_REGEX = /^[a-zA-Z0-9_-]{32,38}$/;

/**
 * Validate a device ID string.
 */
export function isValidDeviceId(deviceId: string): boolean {
  return DEVICE_ID_REGEX.test(deviceId);
}

/**
 * Create a protocol message.
 */
export function createMessage(type: string, body: Record<string, unknown>): ProtocolMessage {
  return { type, body };
}

/**
 * Serialize a message to a JSON string for WebSocket text frame.
 */
export function serializeMessage(msg: ProtocolMessage): string {
  return JSON.stringify(msg);
}

/**
 * Parse a message from a JSON string (WebSocket text frame).
 * Throws ProtocolError on invalid data.
 */
export function parseMessage(data: string): ProtocolMessage {
  const trimmed = data.trim();
  if (trimmed.length === 0) {
    throw new ProtocolError(
      ErrorCode.PROTOCOL_INVALID_PACKET,
      'Empty message data',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new ProtocolError(
      ErrorCode.PROTOCOL_INVALID_PACKET,
      'Invalid JSON in message',
      { data: trimmed.substring(0, 100) },
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new ProtocolError(
      ErrorCode.PROTOCOL_INVALID_PACKET,
      'Message is not an object',
    );
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj['type'] !== 'string') {
    throw new ProtocolError(
      ErrorCode.PROTOCOL_INVALID_PACKET,
      'Message missing string type field',
    );
  }

  if (typeof obj['body'] !== 'object' || obj['body'] === null) {
    throw new ProtocolError(
      ErrorCode.PROTOCOL_INVALID_PACKET,
      'Message missing object body field',
    );
  }

  return {
    type: obj['type'] as string,
    body: obj['body'] as Record<string, unknown>,
  };
}

/**
 * Create an identity message for this device.
 */
export function createIdentityMessage(options: {
  deviceId: string;
  deviceName: string;
}): ProtocolMessage {
  return createMessage(MSG_IDENTITY, {
    deviceId: options.deviceId,
    deviceName: options.deviceName,
    deviceType: 'desktop',
    clientVersion: CLIENT_VERSION,
    minPeerVersion: MIN_PEER_VERSION,
  });
}

/**
 * Validate an identity message body and return typed IdentityBody.
 * Throws ProtocolError on invalid identity data.
 */
export function validateIdentityMessage(msg: ProtocolMessage): IdentityBody {
  const body = msg.body;

  if (typeof body['deviceId'] !== 'string') {
    throw new ProtocolError(
      ErrorCode.PROTOCOL_INVALID_IDENTITY,
      'Identity message missing deviceId',
    );
  }

  if (!isValidDeviceId(body['deviceId'])) {
    throw new ProtocolError(
      ErrorCode.PROTOCOL_INVALID_IDENTITY,
      `Invalid device ID format: ${body['deviceId']}`,
      { deviceId: body['deviceId'] },
    );
  }

  if (typeof body['deviceName'] !== 'string') {
    throw new ProtocolError(
      ErrorCode.PROTOCOL_INVALID_IDENTITY,
      'Identity message missing deviceName',
    );
  }

  const deviceType = typeof body['deviceType'] === 'string'
    ? body['deviceType'] as IdentityBody['deviceType']
    : 'phone';

  const clientVersion = typeof body['clientVersion'] === 'string'
    ? body['clientVersion']
    : '0.0.0';

  const minPeerVersion = typeof body['minPeerVersion'] === 'string'
    ? body['minPeerVersion']
    : undefined;

  return {
    deviceId: body['deviceId'],
    deviceName: body['deviceName'],
    deviceType,
    clientVersion,
    minPeerVersion,
  };
}

// Legacy alias kept for parsePacket (used in tests)
export const parsePacket = parseMessage;
