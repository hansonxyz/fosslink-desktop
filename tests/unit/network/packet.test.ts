import { describe, it, expect } from 'vitest';
import {
  MSG_IDENTITY,
  MSG_PAIR_REQUEST,
  MSG_PAIR_CODE,
  MSG_PAIR_CONFIRM,
  MSG_PAIR_ACCEPT,
  MSG_PAIR_REJECT,
  MSG_UNPAIR,
  MSG_SYNC_START,
  MSG_SYNC_BATCH,
  MSG_SYNC_COMPLETE,
  MSG_SYNC_ACK,
  MSG_EVENT,
  MSG_EVENT_ACK,
  MSG_SMS_SEND,
  MSG_SMS_SEND_STATUS,
  MSG_MARK_READ,
  MSG_DELETE,
  MSG_DELETE_THREAD,
  MSG_CONTACTS_SYNC,
  MSG_CONTACTS_BATCH,
  MSG_CONTACTS_COMPLETE,
  MSG_CONTACTS_PHOTO,
  MSG_CONTACTS_REQUEST_PHOTO,
  MSG_REQUEST_ATTACHMENT,
  MSG_REQUEST_CONVERSATIONS,
  MSG_REQUEST_CONVERSATION,
  MSG_SMS_MESSAGES,
  MSG_SMS_ATTACHMENT_FILE,
  MSG_BATTERY,
  MSG_BATTERY_REQUEST,
  MSG_FINDMYPHONE,
  MSG_CLIPBOARD,
  MSG_NOTIFICATION,
  MSG_NOTIFICATION_DISMISS,
  MSG_URL_SHARE,
  MSG_SETTINGS,
  MSG_OPEN_APP_STORE,
  CLIENT_TYPE,
  CLIENT_VERSION,
  createMessage,
  serializeMessage,
  parseMessage,
  createIdentityMessage,
  validateIdentityMessage,
  isValidDeviceId,
  parsePacket,
} from '../../../src/network/packet.js';
import { ProtocolError } from '../../../src/core/errors.js';

describe('message type constants', () => {
  const allConstants = [
    MSG_IDENTITY,
    MSG_PAIR_REQUEST,
    MSG_PAIR_CODE,
    MSG_PAIR_CONFIRM,
    MSG_PAIR_ACCEPT,
    MSG_PAIR_REJECT,
    MSG_UNPAIR,
    MSG_SYNC_START,
    MSG_SYNC_BATCH,
    MSG_SYNC_COMPLETE,
    MSG_SYNC_ACK,
    MSG_EVENT,
    MSG_EVENT_ACK,
    MSG_SMS_SEND,
    MSG_SMS_SEND_STATUS,
    MSG_MARK_READ,
    MSG_DELETE,
    MSG_DELETE_THREAD,
    MSG_CONTACTS_SYNC,
    MSG_CONTACTS_BATCH,
    MSG_CONTACTS_COMPLETE,
    MSG_CONTACTS_PHOTO,
    MSG_CONTACTS_REQUEST_PHOTO,
    MSG_REQUEST_ATTACHMENT,
    MSG_REQUEST_CONVERSATIONS,
    MSG_REQUEST_CONVERSATION,
    MSG_SMS_MESSAGES,
    MSG_SMS_ATTACHMENT_FILE,
    MSG_BATTERY,
    MSG_BATTERY_REQUEST,
    MSG_FINDMYPHONE,
    MSG_CLIPBOARD,
    MSG_NOTIFICATION,
    MSG_NOTIFICATION_DISMISS,
    MSG_URL_SHARE,
    MSG_SETTINGS,
    MSG_OPEN_APP_STORE,
  ];

  it('all message type constants start with fosslink.', () => {
    for (const constant of allConstants) {
      expect(constant).toMatch(/^fosslink\./);
    }
  });

  it('identity and pairing constants have correct values', () => {
    expect(MSG_IDENTITY).toBe('fosslink.identity');
    expect(MSG_PAIR_REQUEST).toBe('fosslink.pair_request');
    expect(MSG_PAIR_CODE).toBe('fosslink.pair_code');
    expect(MSG_PAIR_CONFIRM).toBe('fosslink.pair_confirm');
    expect(MSG_PAIR_ACCEPT).toBe('fosslink.pair_accept');
    expect(MSG_PAIR_REJECT).toBe('fosslink.pair_reject');
    expect(MSG_UNPAIR).toBe('fosslink.unpair');
  });

  it('SMS sync constants have correct values', () => {
    expect(MSG_SYNC_START).toBe('fosslink.sms.sync_start');
    expect(MSG_SYNC_BATCH).toBe('fosslink.sms.sync_batch');
    expect(MSG_SYNC_COMPLETE).toBe('fosslink.sms.sync_complete');
    expect(MSG_SYNC_ACK).toBe('fosslink.sms.sync_ack');
  });

  it('real-time event constants have correct values', () => {
    expect(MSG_EVENT).toBe('fosslink.sms.event');
    expect(MSG_EVENT_ACK).toBe('fosslink.sms.event_ack');
  });

  it('send SMS and command constants have correct values', () => {
    expect(MSG_SMS_SEND).toBe('fosslink.sms.send');
    expect(MSG_SMS_SEND_STATUS).toBe('fosslink.sms.send_status');
    expect(MSG_MARK_READ).toBe('fosslink.sms.mark_read');
    expect(MSG_DELETE).toBe('fosslink.sms.delete');
    expect(MSG_DELETE_THREAD).toBe('fosslink.sms.delete_thread');
  });

  it('contacts constants have correct values', () => {
    expect(MSG_CONTACTS_SYNC).toBe('fosslink.contacts.sync');
    expect(MSG_CONTACTS_BATCH).toBe('fosslink.contacts.batch');
    expect(MSG_CONTACTS_COMPLETE).toBe('fosslink.contacts.complete');
    expect(MSG_CONTACTS_PHOTO).toBe('fosslink.contacts.photo');
    expect(MSG_CONTACTS_REQUEST_PHOTO).toBe('fosslink.contacts.request_photo');
  });

  it('attachment and conversation request constants have correct values', () => {
    expect(MSG_REQUEST_ATTACHMENT).toBe('fosslink.sms.request_attachment');
    expect(MSG_REQUEST_CONVERSATIONS).toBe('fosslink.sms.request_conversations');
    expect(MSG_REQUEST_CONVERSATION).toBe('fosslink.sms.request_conversation');
    expect(MSG_SMS_MESSAGES).toBe('fosslink.sms.messages');
    expect(MSG_SMS_ATTACHMENT_FILE).toBe('fosslink.sms.attachment_file');
  });

  it('battery, findmyphone, clipboard, notification, url, settings, app store constants have correct values', () => {
    expect(MSG_BATTERY).toBe('fosslink.battery');
    expect(MSG_BATTERY_REQUEST).toBe('fosslink.battery.request');
    expect(MSG_FINDMYPHONE).toBe('fosslink.findmyphone');
    expect(MSG_CLIPBOARD).toBe('fosslink.clipboard');
    expect(MSG_NOTIFICATION).toBe('fosslink.notification');
    expect(MSG_NOTIFICATION_DISMISS).toBe('fosslink.notification.dismiss');
    expect(MSG_URL_SHARE).toBe('fosslink.url.share');
    expect(MSG_SETTINGS).toBe('fosslink.settings');
    expect(MSG_OPEN_APP_STORE).toBe('fosslink.open_app_store');
  });
});

describe('CLIENT_TYPE and CLIENT_VERSION', () => {
  it('CLIENT_TYPE is fosslink', () => {
    expect(CLIENT_TYPE).toBe('fosslink');
  });

  it('CLIENT_VERSION is 0.2.0', () => {
    expect(CLIENT_VERSION).toBe('0.2.0');
  });

  it('CLIENT_VERSION matches semver format', () => {
    expect(CLIENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('createMessage', () => {
  it('returns a message with correct type and body', () => {
    const msg = createMessage('fosslink.sms.send', { text: 'hello' });
    expect(msg.type).toBe('fosslink.sms.send');
    expect(msg.body).toEqual({ text: 'hello' });
  });

  it('does not include an id field', () => {
    const msg = createMessage('fosslink.identity', {});
    expect('id' in msg).toBe(false);
  });

  it('preserves complex body contents', () => {
    const body = { nested: { key: 'value' }, list: [1, 2, 3] };
    const msg = createMessage('fosslink.sms.sync_batch', body);
    expect(msg.body).toEqual(body);
  });
});

describe('serializeMessage', () => {
  it('produces a valid JSON string', () => {
    const msg = createMessage('fosslink.battery', { level: 85 });
    const serialized = serializeMessage(msg);
    const parsed = JSON.parse(serialized);
    expect(parsed.type).toBe('fosslink.battery');
    expect(parsed.body.level).toBe(85);
  });

  it('does not end with a newline', () => {
    const msg = createMessage('fosslink.clipboard', { content: 'test' });
    const serialized = serializeMessage(msg);
    expect(serialized.endsWith('\n')).toBe(false);
  });

  it('does not contain embedded newlines', () => {
    const msg = createMessage('fosslink.identity', { deviceName: 'MyPC' });
    const serialized = serializeMessage(msg);
    expect(serialized.includes('\n')).toBe(false);
  });

  it('does not include an id field in output', () => {
    const msg = createMessage('fosslink.identity', {});
    const serialized = serializeMessage(msg);
    const parsed = JSON.parse(serialized);
    expect('id' in parsed).toBe(false);
  });
});

describe('parseMessage', () => {
  it('roundtrips with serializeMessage', () => {
    const original = createMessage('fosslink.pair_request', { publicKey: 'abc123' });
    const serialized = serializeMessage(original);
    const parsed = parseMessage(serialized);
    expect(parsed.type).toBe(original.type);
    expect(parsed.body).toEqual(original.body);
  });

  it('parses a valid JSON string without id field', () => {
    const json = '{"type":"fosslink.sms.event","body":{"threadId":42}}';
    const msg = parseMessage(json);
    expect(msg.type).toBe('fosslink.sms.event');
    expect(msg.body['threadId']).toBe(42);
  });

  it('does not require an id field', () => {
    const json = '{"type":"fosslink.battery","body":{"level":50}}';
    const msg = parseMessage(json);
    expect(msg.type).toBe('fosslink.battery');
    expect('id' in msg).toBe(false);
  });

  it('tolerates trailing whitespace', () => {
    const json = '{"type":"fosslink.identity","body":{}}  \n';
    const msg = parseMessage(json);
    expect(msg.type).toBe('fosslink.identity');
  });

  it('throws ProtocolError on empty string', () => {
    expect(() => parseMessage('')).toThrow(ProtocolError);
  });

  it('throws ProtocolError on whitespace-only string', () => {
    expect(() => parseMessage('   \n  ')).toThrow(ProtocolError);
  });

  it('throws ProtocolError on invalid JSON', () => {
    expect(() => parseMessage('not json at all')).toThrow(ProtocolError);
  });

  it('throws ProtocolError on missing type field', () => {
    expect(() => parseMessage('{"body":{}}')).toThrow(ProtocolError);
  });

  it('throws ProtocolError on non-string type field', () => {
    expect(() => parseMessage('{"type":123,"body":{}}')).toThrow(ProtocolError);
  });

  it('throws ProtocolError on missing body field', () => {
    expect(() => parseMessage('{"type":"fosslink.identity"}')).toThrow(ProtocolError);
  });

  it('throws ProtocolError on null body', () => {
    expect(() => parseMessage('{"type":"fosslink.identity","body":null}')).toThrow(ProtocolError);
  });

  it('throws ProtocolError on non-object body', () => {
    expect(() => parseMessage('{"type":"fosslink.identity","body":"string"}')).toThrow(ProtocolError);
  });

  it('throws ProtocolError on non-object input (array)', () => {
    expect(() => parseMessage('[1, 2, 3]')).toThrow(ProtocolError);
  });
});

describe('parsePacket legacy alias', () => {
  it('parsePacket is the same function as parseMessage', () => {
    expect(parsePacket).toBe(parseMessage);
  });
});

describe('createIdentityMessage', () => {
  it('creates a message with MSG_IDENTITY type', () => {
    const msg = createIdentityMessage({
      deviceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      deviceName: 'TestPC',
    });
    expect(msg.type).toBe(MSG_IDENTITY);
  });

  it('includes deviceId and deviceName from options', () => {
    const msg = createIdentityMessage({
      deviceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      deviceName: 'MyDesktop',
    });
    expect(msg.body['deviceId']).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
    expect(msg.body['deviceName']).toBe('MyDesktop');
  });

  it('sets deviceType to desktop', () => {
    const msg = createIdentityMessage({
      deviceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      deviceName: 'TestPC',
    });
    expect(msg.body['deviceType']).toBe('desktop');
  });

  it('includes clientVersion matching CLIENT_VERSION', () => {
    const msg = createIdentityMessage({
      deviceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      deviceName: 'TestPC',
    });
    expect(msg.body['clientVersion']).toBe(CLIENT_VERSION);
  });

  it('does not include an id field', () => {
    const msg = createIdentityMessage({
      deviceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      deviceName: 'TestPC',
    });
    expect('id' in msg).toBe(false);
  });
});

describe('validateIdentityMessage', () => {
  function makeIdentityMessage(overrides?: Record<string, unknown>) {
    return createMessage(MSG_IDENTITY, {
      deviceId: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
      deviceName: 'TestPhone',
      deviceType: 'phone',
      clientVersion: '0.2.0',
      ...overrides,
    });
  }

  it('accepts a valid identity message and returns typed IdentityBody', () => {
    const msg = makeIdentityMessage();
    const identity = validateIdentityMessage(msg);
    expect(identity.deviceId).toBe('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4');
    expect(identity.deviceName).toBe('TestPhone');
    expect(identity.deviceType).toBe('phone');
    expect(identity.clientVersion).toBe('0.2.0');
  });

  it('throws ProtocolError on missing deviceId', () => {
    const msg = makeIdentityMessage();
    delete msg.body['deviceId'];
    expect(() => validateIdentityMessage(msg)).toThrow(ProtocolError);
  });

  it('throws ProtocolError on invalid deviceId format', () => {
    const msg = makeIdentityMessage({ deviceId: 'tooshort' });
    expect(() => validateIdentityMessage(msg)).toThrow(ProtocolError);
  });

  it('throws ProtocolError on non-string deviceId', () => {
    const msg = makeIdentityMessage({ deviceId: 12345 });
    expect(() => validateIdentityMessage(msg)).toThrow(ProtocolError);
  });

  it('throws ProtocolError on missing deviceName', () => {
    const msg = makeIdentityMessage();
    delete msg.body['deviceName'];
    expect(() => validateIdentityMessage(msg)).toThrow(ProtocolError);
  });

  it('throws ProtocolError on non-string deviceName', () => {
    const msg = makeIdentityMessage({ deviceName: 42 });
    expect(() => validateIdentityMessage(msg)).toThrow(ProtocolError);
  });

  it('defaults deviceType to phone when missing', () => {
    const msg = makeIdentityMessage();
    delete msg.body['deviceType'];
    const identity = validateIdentityMessage(msg);
    expect(identity.deviceType).toBe('phone');
  });

  it('defaults clientVersion to 0.0.0 when missing', () => {
    const msg = makeIdentityMessage();
    delete msg.body['clientVersion'];
    const identity = validateIdentityMessage(msg);
    expect(identity.clientVersion).toBe('0.0.0');
  });

  it('accepts all valid device types', () => {
    for (const deviceType of ['desktop', 'laptop', 'phone', 'tablet']) {
      const msg = makeIdentityMessage({ deviceType });
      const identity = validateIdentityMessage(msg);
      expect(identity.deviceType).toBe(deviceType);
    }
  });
});

describe('isValidDeviceId', () => {
  it('accepts 32-char hex string', () => {
    expect(isValidDeviceId('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4')).toBe(true);
  });

  it('accepts 38-char string with dashes and underscores', () => {
    expect(isValidDeviceId('a1b2c3d4-e5f6-a1b2-c3d4-e5f6a1b2c3d4')).toBe(true);
  });

  it('accepts 36-char UUID format', () => {
    expect(isValidDeviceId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('accepts string with underscores', () => {
    expect(isValidDeviceId('a1b2c3d4_e5f6_a1b2_c3d4_e5f6a1b2c3d4')).toBe(true);
  });

  it('accepts exactly 32 characters', () => {
    expect(isValidDeviceId('a'.repeat(32))).toBe(true);
  });

  it('accepts exactly 38 characters', () => {
    expect(isValidDeviceId('a'.repeat(38))).toBe(true);
  });

  it('rejects string shorter than 32 chars', () => {
    expect(isValidDeviceId('abc123')).toBe(false);
  });

  it('rejects 31 characters', () => {
    expect(isValidDeviceId('a'.repeat(31))).toBe(false);
  });

  it('rejects string longer than 38 chars', () => {
    expect(isValidDeviceId('a'.repeat(39))).toBe(false);
  });

  it('rejects string with special characters', () => {
    expect(isValidDeviceId('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d!')).toBe(false);
  });

  it('rejects string with spaces', () => {
    expect(isValidDeviceId('a1b2c3d4 e5f6a1b2c3d4e5f6a1b2c3d4')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidDeviceId('')).toBe(false);
  });
});
