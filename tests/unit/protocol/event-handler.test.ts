import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventHandler } from '../../../src/protocol/enhanced/event-handler.js';
import { SmsHandler } from '../../../src/protocol/standard/sms-handler.js';
import { DatabaseService } from '../../../src/database/database.js';
import { initializeLogger, resetLogger } from '../../../src/utils/logger.js';
import { createMessage } from '../../../src/network/packet.js';
import type { DeviceConnection } from '../../../src/network/ws-server.js';
import type { EventInfo } from '../../../src/protocol/enhanced/event-handler.js';

let tmpDir: string;
let db: DatabaseService;
let smsHandler: SmsHandler;
let handler: EventHandler;
let mockConnection: DeviceConnection;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'event-handler-test-'));
  initializeLogger({ level: 'error', pretty: false });
  db = new DatabaseService(path.join(tmpDir, 'test.db'));
  db.open();

  mockConnection = {
    deviceId: 'test-device-id-aaaaaaaaaaaaaaaa',
    deviceName: 'TestPhone',
    ws: {} as any,
    connected: true,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as DeviceConnection;

  const getConnection = () => mockConnection;
  smsHandler = new SmsHandler({
    db,
    getConnection,
    getCert: () => undefined,
    getKey: () => undefined,
  });

  handler = new EventHandler({
    smsHandler,
    db,
    getConnection,
  });
});

afterEach(() => {
  handler.destroy();
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  resetLogger();
});

describe('EventHandler — message events', () => {
  it('handles received event and persists message', () => {
    const eventPacket = createMessage('fosslink.sms.event', {
      event: 'received',
      eventId: 'evt-001',
      timestamp: Date.now(),
      messages: [
        {
          _id: 1,
          thread_id: 100,
          addresses: [{ address: '+1234567890' }],
          body: 'Hello from phone',
          date: 1700000000000,
          type: 1,
          read: 0,
        },
      ],
    });

    handler.handleEvent(eventPacket, mockConnection);

    // Message should be persisted
    const messages = db.getThreadMessages(100);
    expect(messages.length).toBe(1);
    expect(messages[0]!.body).toBe('Hello from phone');
  });

  it('handles sent event and persists message', () => {
    const eventPacket = createMessage('fosslink.sms.event', {
      event: 'sent',
      eventId: 'evt-002',
      timestamp: Date.now(),
      messages: [
        {
          _id: 2,
          thread_id: 200,
          addresses: [{ address: '+9876543210' }],
          body: 'Sent from phone',
          date: 1700000001000,
          type: 2,
          read: 1,
        },
      ],
    });

    handler.handleEvent(eventPacket, mockConnection);

    const messages = db.getThreadMessages(200);
    expect(messages.length).toBe(1);
    expect(messages[0]!.body).toBe('Sent from phone');
  });

  it('sends event_ack after debounce', async () => {
    vi.useFakeTimers();

    const eventPacket = createMessage('fosslink.sms.event', {
      event: 'received',
      eventId: 'evt-003',
      timestamp: Date.now(),
      messages: [
        {
          _id: 3,
          thread_id: 300,
          addresses: [{ address: '+1111111111' }],
          body: 'Test',
          date: 1700000002000,
          type: 1,
          read: 0,
        },
      ],
    });

    handler.handleEvent(eventPacket, mockConnection);

    // No ack sent yet (debounce)
    expect(mockConnection.send).not.toHaveBeenCalled();

    // Advance past debounce
    vi.advanceTimersByTime(150);

    // Now ack should be sent
    expect(mockConnection.send).toHaveBeenCalledWith('fosslink.sms.event_ack', expect.objectContaining({ eventIds: ['evt-003'] }));

    vi.useRealTimers();
  });

  it('batches multiple acks within debounce window', async () => {
    vi.useFakeTimers();

    // Send 3 events rapidly
    for (let i = 0; i < 3; i++) {
      handler.handleEvent(createMessage('fosslink.sms.event', {
        event: 'received',
        eventId: `evt-batch-${i}`,
        timestamp: Date.now(),
        messages: [
          {
            _id: 10 + i,
            thread_id: 400,
            addresses: [{ address: '+2222222222' }],
            body: `Message ${i}`,
            date: 1700000010000 + i * 1000,
            type: 1,
            read: 0,
          },
        ],
      }), mockConnection);
    }

    // No ack yet
    expect(mockConnection.send).not.toHaveBeenCalled();

    // Advance past debounce
    vi.advanceTimersByTime(150);

    // Should have exactly 1 ack call with all 3 eventIds
    expect(mockConnection.send).toHaveBeenCalledTimes(1);
    expect(mockConnection.send).toHaveBeenCalledWith('fosslink.sms.event_ack', expect.objectContaining({ eventIds: ['evt-batch-0', 'evt-batch-1', 'evt-batch-2'] }));

    // All 3 messages should be persisted
    const messages = db.getThreadMessages(400);
    expect(messages.length).toBe(3);

    vi.useRealTimers();
  });

  it('fires callback with correct event info', () => {
    const events: EventInfo[] = [];
    handler.onEventReceived((event) => {
      events.push(event);
    });

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'received',
      eventId: 'evt-cb-001',
      timestamp: Date.now(),
      messages: [
        {
          _id: 20,
          thread_id: 500,
          addresses: [{ address: '+3333333333' }],
          body: 'Callback test',
          date: 1700000020000,
          type: 1,
          read: 0,
        },
        {
          _id: 21,
          thread_id: 500,
          addresses: [{ address: '+3333333333' }],
          body: 'Callback test 2',
          date: 1700000021000,
          type: 1,
          read: 0,
        },
      ],
    }), mockConnection);

    expect(events.length).toBe(1);
    expect(events[0]).toEqual({
      type: 'received',
      eventId: 'evt-cb-001',
      threadId: 500,
      messageCount: 2,
    });
  });

  it('ignores event without eventId', () => {
    const events: EventInfo[] = [];
    handler.onEventReceived((event) => events.push(event));

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'received',
      messages: [
        {
          _id: 30,
          thread_id: 600,
          addresses: [{ address: '+4444444444' }],
          body: 'No eventId',
          date: 1700000030000,
          type: 1,
          read: 0,
        },
      ],
    }), mockConnection);

    expect(events.length).toBe(0);
    expect(db.getThreadMessages(600).length).toBe(0);
  });

  it('ignores message event without messages array', () => {
    const events: EventInfo[] = [];
    handler.onEventReceived((event) => events.push(event));

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'received',
      eventId: 'evt-no-msgs',
    }), mockConnection);

    // No callback for message events without messages
    expect(events.length).toBe(0);
  });

  it('handles event with empty messages array', () => {
    const events: EventInfo[] = [];
    handler.onEventReceived((event) => events.push(event));

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'received',
      eventId: 'evt-empty',
      messages: [],
    }), mockConnection);

    // Callback should still fire (event was valid)
    expect(events.length).toBe(1);
    expect(events[0]!.messageCount).toBe(0);
  });

  it('does not crash when connection unavailable for ack', async () => {
    vi.useFakeTimers();

    const disconnectedHandler = new EventHandler({
      smsHandler,
      db,
      getConnection: () => undefined,
    });

    disconnectedHandler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'received',
      eventId: 'evt-noconn',
      timestamp: Date.now(),
      messages: [
        {
          _id: 40,
          thread_id: 700,
          addresses: [{ address: '+5555555555' }],
          body: 'No connection',
          date: 1700000040000,
          type: 1,
          read: 0,
        },
      ],
    }), mockConnection);

    // Advance past debounce — should not throw
    vi.advanceTimersByTime(150);

    // Message should still be persisted even though ack failed
    const messages = db.getThreadMessages(700);
    expect(messages.length).toBe(1);

    disconnectedHandler.destroy();
    vi.useRealTimers();
  });

  it('destroy clears pending acks and callbacks', () => {
    vi.useFakeTimers();

    const events: EventInfo[] = [];
    handler.onEventReceived((event) => events.push(event));

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'received',
      eventId: 'evt-destroy',
      timestamp: Date.now(),
      messages: [
        {
          _id: 50,
          thread_id: 800,
          addresses: [{ address: '+6666666666' }],
          body: 'Before destroy',
          date: 1700000050000,
          type: 1,
          read: 0,
        },
      ],
    }), mockConnection);

    handler.destroy();

    // Advance past debounce — ack should have been flushed during destroy
    vi.advanceTimersByTime(150);

    // Should have sent ack during destroy flush
    expect(mockConnection.send).toHaveBeenCalledWith('fosslink.sms.event_ack', expect.objectContaining({ eventIds: ['evt-destroy'] }));

    vi.useRealTimers();
  });

  it('ignores events after destroy', () => {
    handler.destroy();

    const events: EventInfo[] = [];
    handler.onEventReceived((event) => events.push(event));

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'received',
      eventId: 'evt-after-destroy',
      timestamp: Date.now(),
      messages: [
        {
          _id: 60,
          thread_id: 900,
          addresses: [{ address: '+7777777777' }],
          body: 'After destroy',
          date: 1700000060000,
          type: 1,
          read: 0,
        },
      ],
    }), mockConnection);

    // Callbacks were cleared by destroy, so nothing fires
    expect(events.length).toBe(0);
  });
});

describe('EventHandler — state events', () => {
  it('handles read event and marks thread locally read', () => {
    // First insert a conversation so markThreadLocallyRead has something to update
    db.upsertConversation({
      thread_id: 1000,
      addresses: '+1234567890',
      snippet: 'Hello',
      date: Date.now(),
      read: 0,
      unread_count: 3,
      locally_read_at: null,
      has_outgoing: 0,
    });

    const events: EventInfo[] = [];
    handler.onEventReceived((event) => events.push(event));

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'read',
      eventId: 'evt-read-001',
      threadId: 1000,
    }), mockConnection);

    expect(events.length).toBe(1);
    expect(events[0]).toEqual({
      type: 'read',
      eventId: 'evt-read-001',
      threadId: 1000,
      messageCount: 0,
    });
  });

  it('handles read event and sends ack', () => {
    vi.useFakeTimers();

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'read',
      eventId: 'evt-read-ack',
      threadId: 1001,
    }), mockConnection);

    vi.advanceTimersByTime(150);

    expect(mockConnection.send).toHaveBeenCalledTimes(1);
    expect(mockConnection.send).toHaveBeenCalledWith('fosslink.sms.event_ack', expect.objectContaining({ eventIds: ['evt-read-ack'] }));

    vi.useRealTimers();
  });

  it('handles deleted event and removes messages', () => {
    // Insert messages to be deleted
    db.upsertMessage({
      _id: 100,
      thread_id: 2000,
      address: '+1234567890',
      body: 'To be deleted',
      date: 1700000100000,
      type: 1,
      read: 0,
      sub_id: -1,
      event: 0,
    });
    db.upsertMessage({
      _id: 101,
      thread_id: 2000,
      address: '+1234567890',
      body: 'Also deleted',
      date: 1700000101000,
      type: 1,
      read: 0,
      sub_id: -1,
      event: 0,
    });
    db.upsertMessage({
      _id: 102,
      thread_id: 2000,
      address: '+1234567890',
      body: 'Keep this one',
      date: 1700000102000,
      type: 1,
      read: 0,
      sub_id: -1,
      event: 0,
    });

    const events: EventInfo[] = [];
    handler.onEventReceived((event) => events.push(event));

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'deleted',
      eventId: 'evt-del-001',
      messageIds: [100, 101],
    }), mockConnection);

    // Deleted messages should be gone
    expect(db.getMessage(100)).toBeUndefined();
    expect(db.getMessage(101)).toBeUndefined();
    // Kept message still there
    expect(db.getMessage(102)).toBeDefined();

    expect(events.length).toBe(1);
    expect(events[0]).toEqual({
      type: 'deleted',
      eventId: 'evt-del-001',
      threadId: 0,
      messageCount: 2,
    });
  });

  it('handles thread_deleted event and removes conversation', () => {
    // Insert conversation and messages
    db.upsertConversation({
      thread_id: 3000,
      addresses: '+9876543210',
      snippet: 'Thread to delete',
      date: Date.now(),
      read: 1,
      unread_count: 0,
      locally_read_at: null,
      has_outgoing: 0,
    });
    db.upsertMessage({
      _id: 200,
      thread_id: 3000,
      address: '+9876543210',
      body: 'In deleted thread',
      date: 1700000200000,
      type: 1,
      read: 1,
      sub_id: -1,
      event: 0,
    });

    const events: EventInfo[] = [];
    handler.onEventReceived((event) => events.push(event));

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'thread_deleted',
      eventId: 'evt-tdel-001',
      threadId: 3000,
    }), mockConnection);

    // Thread and messages should be gone
    expect(db.getThreadMessages(3000).length).toBe(0);

    expect(events.length).toBe(1);
    expect(events[0]).toEqual({
      type: 'thread_deleted',
      eventId: 'evt-tdel-001',
      threadId: 3000,
      messageCount: 0,
    });
  });

  it('ignores read event without threadId', () => {
    const events: EventInfo[] = [];
    handler.onEventReceived((event) => events.push(event));

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'read',
      eventId: 'evt-read-no-tid',
    }), mockConnection);

    // Should not fire callback for malformed event
    expect(events.length).toBe(0);
  });

  it('ignores deleted event without messageIds', () => {
    const events: EventInfo[] = [];
    handler.onEventReceived((event) => events.push(event));

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'deleted',
      eventId: 'evt-del-no-ids',
    }), mockConnection);

    expect(events.length).toBe(0);
  });

  it('batches state event acks with message event acks', () => {
    vi.useFakeTimers();

    // Mix of message and state events
    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'received',
      eventId: 'evt-msg-1',
      messages: [
        { _id: 300, thread_id: 4000, addresses: [{ address: '+1111111111' }], body: 'Msg', date: 1700000300000, type: 1, read: 0 },
      ],
    }), mockConnection);

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'read',
      eventId: 'evt-read-2',
      threadId: 4000,
    }), mockConnection);

    handler.handleEvent(createMessage('fosslink.sms.event', {
      event: 'deleted',
      eventId: 'evt-del-3',
      messageIds: [300],
    }), mockConnection);

    vi.advanceTimersByTime(150);

    expect(mockConnection.send).toHaveBeenCalledTimes(1);
    expect(mockConnection.send).toHaveBeenCalledWith('fosslink.sms.event_ack', expect.objectContaining({ eventIds: ['evt-msg-1', 'evt-read-2', 'evt-del-3'] }));

    vi.useRealTimers();
  });
});
