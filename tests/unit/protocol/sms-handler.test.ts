import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SmsHandler } from '../../../src/protocol/standard/sms-handler.js';
import { DatabaseService } from '../../../src/database/database.js';
import type { ProtocolMessage } from '../../../src/network/packet.js';
import type { DeviceConnection } from '../../../src/network/ws-server.js';
import { initializeLogger, resetLogger } from '../../../src/utils/logger.js';

function createMockConnection(): DeviceConnection {
  return {
    deviceId: 'test-device-id-12345678901234567890',
    deviceName: 'Test Phone',
    ws: {} as any,
    connected: true,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as DeviceConnection;
}

function createMessagesPacket(messages: Record<string, unknown>[]): ProtocolMessage {
  return {
    type: 'fosslink.sms.messages',
    body: { messages },
  };
}

describe('SmsHandler', () => {
  let tmpDir: string;
  let db: DatabaseService;
  let connection: DeviceConnection;
  let handler: SmsHandler;

  beforeEach(() => {
    initializeLogger({ level: 'error', pretty: false });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-handler-test-'));
    db = new DatabaseService(path.join(tmpDir, 'test.db'));
    db.open();
    connection = createMockConnection();

    handler = new SmsHandler({
      db,
      getConnection: () => connection,
      getCert: () => 'mock-cert',
      getKey: () => 'mock-key',
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resetLogger();
  });

  describe('handleMessages', () => {
    it('should parse and persist a single message', () => {
      const packet = createMessagesPacket([{
        _id: 1,
        thread_id: 100,
        addresses: [{ address: '+15551234567' }],
        body: 'Hello world',
        date: 1700000000000,
        type: 1,
        read: 0,
      }]);

      handler.handleMessages(packet, connection);

      const msg = db.getMessage(1);
      expect(msg).toBeDefined();
      expect(msg!.thread_id).toBe(100);
      expect(msg!.address).toBe('+15551234567');
      expect(msg!.body).toBe('Hello world');
      expect(msg!.type).toBe(1);
      expect(msg!.read).toBe(0);
    });

    it('should persist multiple messages in a batch', () => {
      const packet = createMessagesPacket([
        { _id: 1, thread_id: 100, addresses: [{ address: '+15551234567' }], body: 'First', date: 1700000000000, type: 1, read: 1 },
        { _id: 2, thread_id: 100, addresses: [{ address: '+15551234567' }], body: 'Second', date: 1700000001000, type: 2, read: 1 },
        { _id: 3, thread_id: 100, addresses: [{ address: '+15551234567' }], body: 'Third', date: 1700000002000, type: 1, read: 0 },
      ]);

      handler.handleMessages(packet, connection);

      expect(db.getMessageCount()).toBe(3);
      const threadMsgs = db.getThreadMessages(100);
      expect(threadMsgs).toHaveLength(3);
    });

    it('should create conversation from messages', () => {
      const packet = createMessagesPacket([
        { _id: 1, thread_id: 100, addresses: [{ address: '+15551234567' }], body: 'Hello', date: 1700000000000, type: 1, read: 1 },
        { _id: 2, thread_id: 100, addresses: [{ address: '+15551234567' }], body: 'World', date: 1700000001000, type: 2, read: 1 },
      ]);

      handler.handleMessages(packet, connection);

      const conv = db.getConversation(100);
      expect(conv).toBeDefined();
      expect(conv!.snippet).toBe('World'); // most recent message
      expect(conv!.date).toBe(1700000001000);
      expect(JSON.parse(conv!.addresses)).toContain('+15551234567');
    });

    it('should handle messages from multiple threads', () => {
      const packet = createMessagesPacket([
        { _id: 1, thread_id: 100, addresses: [{ address: '+15551234567' }], body: 'Thread 1', date: 1700000000000, type: 1, read: 1 },
        { _id: 2, thread_id: 200, addresses: [{ address: '+15559876543' }], body: 'Thread 2', date: 1700000001000, type: 1, read: 0 },
      ]);

      handler.handleMessages(packet, connection);

      expect(db.getConversationCount()).toBe(2);
      expect(db.getConversation(100)!.snippet).toBe('Thread 1');
      expect(db.getConversation(200)!.snippet).toBe('Thread 2');
    });

    it('should track unread count', () => {
      const packet = createMessagesPacket([
        { _id: 1, thread_id: 100, addresses: [{ address: '+1555' }], body: 'Unread 1', date: 1700000000000, type: 1, read: 0 },
        { _id: 2, thread_id: 100, addresses: [{ address: '+1555' }], body: 'Unread 2', date: 1700000001000, type: 1, read: 0 },
        { _id: 3, thread_id: 100, addresses: [{ address: '+1555' }], body: 'Read', date: 1700000002000, type: 1, read: 1 },
      ]);

      handler.handleMessages(packet, connection);

      const conv = db.getConversation(100);
      expect(conv!.unread_count).toBe(2);
      expect(conv!.read).toBe(0);
    });

    it('should handle messages with attachment metadata', () => {
      const packet = createMessagesPacket([{
        _id: 10,
        thread_id: 100,
        addresses: [{ address: '+15551234567' }],
        body: null,
        date: 1700000000000,
        type: 1,
        read: 0,
        attachments: [{
          part_id: 1,
          unique_identifier: 'PART_42',
          mime_type: 'image/jpeg',
          filename: 'photo.jpg',
        }],
      }]);

      handler.handleMessages(packet, connection);

      const atts = db.getAttachmentsForMessage(10);
      expect(atts).toHaveLength(1);
      expect(atts[0]!.part_id).toBe(1);
      expect(atts[0]!.mime_type).toBe('image/jpeg');
      expect(atts[0]!.filename).toBe('photo.jpg');
      expect(atts[0]!.downloaded).toBe(0);
    });

    it('should handle MMS two-phase: empty attachments then metadata', () => {
      // Phase 1: Message arrives with empty attachments
      const phase1 = createMessagesPacket([{
        _id: 10,
        thread_id: 100,
        addresses: [{ address: '+15551234567' }],
        body: null,
        date: 1700000000000,
        type: 1,
        read: 0,
        attachments: [],
      }]);

      handler.handleMessages(phase1, connection);

      let msg = db.getMessage(10);
      expect(msg).toBeDefined();
      expect(db.getAttachmentsForMessage(10)).toHaveLength(0);

      // Phase 2: Same message arrives again with attachment metadata
      const phase2 = createMessagesPacket([{
        _id: 10,
        thread_id: 100,
        addresses: [{ address: '+15551234567' }],
        body: null,
        date: 1700000000000,
        type: 1,
        read: 0,
        attachments: [{
          part_id: 1,
          unique_identifier: 'PART_42',
          mime_type: 'image/png',
          filename: 'image.png',
        }],
      }]);

      handler.handleMessages(phase2, connection);

      msg = db.getMessage(10);
      expect(msg).toBeDefined();
      expect(db.getAttachmentsForMessage(10)).toHaveLength(1);
    });

    it('should handle empty messages array gracefully', () => {
      const packet = createMessagesPacket([]);
      handler.handleMessages(packet, connection); // should not throw
      expect(db.getMessageCount()).toBe(0);
    });

    it('should handle missing messages field gracefully', () => {
      const packet: ProtocolMessage = { type: 'fosslink.sms.messages', body: {} };
      handler.handleMessages(packet, connection); // should not throw
      expect(db.getMessageCount()).toBe(0);
    });

    it('should skip messages with missing _id or thread_id', () => {
      const packet = createMessagesPacket([
        { body: 'no id', date: 1700000000000, type: 1 } as Record<string, unknown>,
        { _id: 1, thread_id: 100, addresses: [{ address: '+1555' }], body: 'valid', date: 1700000000000, type: 1, read: 1 },
      ]);

      handler.handleMessages(packet, connection);
      expect(db.getMessageCount()).toBe(1);
    });

    it('should handle message with missing addresses gracefully', () => {
      const packet = createMessagesPacket([{
        _id: 1,
        thread_id: 100,
        body: 'No addresses',
        date: 1700000000000,
        type: 1,
        read: 1,
      }]);

      handler.handleMessages(packet, connection);
      const msg = db.getMessage(1);
      expect(msg).toBeDefined();
      expect(msg!.address).toBe('');
    });

    it('should update existing message on re-upsert', () => {
      const packet1 = createMessagesPacket([{
        _id: 1, thread_id: 100, addresses: [{ address: '+1555' }],
        body: 'Original', date: 1700000000000, type: 1, read: 0,
      }]);
      handler.handleMessages(packet1, connection);
      expect(db.getMessage(1)!.read).toBe(0);

      const packet2 = createMessagesPacket([{
        _id: 1, thread_id: 100, addresses: [{ address: '+1555' }],
        body: 'Original', date: 1700000000000, type: 1, read: 1,
      }]);
      handler.handleMessages(packet2, connection);
      expect(db.getMessage(1)!.read).toBe(1);
    });

    it('should default optional fields', () => {
      const packet = createMessagesPacket([{
        _id: 1,
        thread_id: 100,
        addresses: [{ address: '+1555' }],
        body: 'Test',
        date: 1700000000000,
        type: 1,
        read: 1,
        // no sub_id, event
      }]);

      handler.handleMessages(packet, connection);
      const msg = db.getMessage(1);
      expect(msg!.sub_id).toBe(0);
      expect(msg!.event).toBe(0);
    });
  });

  describe('callbacks', () => {
    it('should fire onMessages callback with threadId and rows', () => {
      let receivedThreadId: number | undefined;
      let receivedCount = 0;

      handler.onMessages((threadId, messages) => {
        receivedThreadId = threadId;
        receivedCount = messages.length;
      });

      const packet = createMessagesPacket([
        { _id: 1, thread_id: 100, addresses: [{ address: '+1555' }], body: 'A', date: 1700000000000, type: 1, read: 1 },
        { _id: 2, thread_id: 100, addresses: [{ address: '+1555' }], body: 'B', date: 1700000001000, type: 2, read: 1 },
      ]);

      handler.handleMessages(packet, connection);

      expect(receivedThreadId).toBe(100);
      expect(receivedCount).toBe(2);
    });

    it('should fire onConversationsUpdated callback', () => {
      let receivedCount = 0;

      handler.onConversationsUpdated((conversations) => {
        receivedCount = conversations.length;
      });

      const packet = createMessagesPacket([
        { _id: 1, thread_id: 100, addresses: [{ address: '+1555' }], body: 'A', date: 1700000000000, type: 1, read: 1 },
      ]);

      handler.handleMessages(packet, connection);
      expect(receivedCount).toBe(1);
    });
  });

  describe('outgoing requests', () => {
    it('should send requestConversations packet', () => {
      handler.requestConversations();
      expect(connection.send).toHaveBeenCalledTimes(1);
      expect(connection.send).toHaveBeenCalledWith('fosslink.sms.request_conversations', expect.any(Object));
    });

    it('should send requestConversation packet with threadID', () => {
      handler.requestConversation(42);
      expect(connection.send).toHaveBeenCalledTimes(1);
      expect(connection.send).toHaveBeenCalledWith('fosslink.sms.request_conversation', expect.objectContaining({ threadID: 42 }));
    });

    it('should send SMS via queueMessage when connected', () => {
      const queueId = handler.queueMessage('+15551234567', 'Hello from test');
      expect(queueId).toBeTruthy();
      expect(connection.send).toHaveBeenCalledTimes(1);
      expect(connection.send).toHaveBeenCalledWith('fosslink.sms.send', expect.objectContaining({
        sendSms: true,
        phoneNumber: '+15551234567',
        messageBody: 'Hello from test',
      }));
    });

    it('should send requestAttachment packet', () => {
      handler.requestAttachment(5, 'PART_99');
      expect(connection.send).toHaveBeenCalledTimes(1);
      expect(connection.send).toHaveBeenCalledWith('fosslink.sms.request_attachment', expect.objectContaining({
        part_id: 5,
        unique_identifier: 'PART_99',
      }));
    });

    it('should not throw when not connected', () => {
      const disconnectedHandler = new SmsHandler({
        db,
        getConnection: () => undefined,
        getCert: () => 'mock-cert',
        getKey: () => 'mock-key',
      });
      // Should not throw
      disconnectedHandler.requestConversations();
      disconnectedHandler.requestConversation(1);
      disconnectedHandler.queueMessage('+1555', 'test');
      disconnectedHandler.requestAttachment(1, 'PART_1');
    });
  });

  describe('handleAttachmentFile', () => {
    it('should warn when missing payloadTransferInfo', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.sms.attachment_file',
        body: { filename: 'photo.jpg' },
      };

      // Should not throw, just logs a warning
      handler.handleAttachmentFile(packet, connection);
    });

    it('should warn when missing payloadSize', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.sms.attachment_file',
        body: { filename: 'photo.jpg' },
      };

      // Should not throw
      handler.handleAttachmentFile(packet, connection);
    });
  });

  describe('downloadAttachment', () => {
    it('should return cached path if already downloaded and file exists', async () => {
      // Insert an attachment that's already downloaded
      const localPath = path.join(tmpDir, 'cached.jpg');
      fs.writeFileSync(localPath, 'fake image data');

      db.upsertMessage({
        _id: 500, thread_id: 1, address: '+1555', body: 'MMS',
        date: Date.now(), type: 1, read: 0, sub_id: 0, event: 0,
      });
      db.upsertAttachment({
        part_id: 10, message_id: 500, unique_identifier: 'PART_42',
        mime_type: 'image/jpeg', filename: 'photo.jpg',
        file_size: 15, downloaded: 1, local_path: localPath, thumbnail_path: null,
      });

      const result = await handler.downloadAttachment(10, 500);
      expect(result).toBe(localPath);
    });

    it('should throw if attachment not found in DB', async () => {
      await expect(handler.downloadAttachment(999, 999)).rejects.toThrow('Attachment not found');
    });
  });

  describe('deleteMessage', () => {
    it('should delete message and its attachments from DB', () => {
      db.upsertMessage({
        _id: 300, thread_id: 1, address: '+1555', body: 'test',
        date: Date.now(), type: 1, read: 0, sub_id: 0, event: 0,
      });
      db.upsertAttachment({
        part_id: 1, message_id: 300, unique_identifier: 'PART_42',
        mime_type: 'image/jpeg', filename: 'photo.jpg',
        file_size: null, downloaded: 0, local_path: null, thumbnail_path: null,
      });

      handler.deleteMessage(300);

      expect(db.getMessage(300)).toBeUndefined();
      expect(db.getAttachmentsForMessage(300)).toHaveLength(0);
    });

    it('should delete attachment files from disk', () => {
      const filePath = path.join(tmpDir, 'to-delete.jpg');
      fs.writeFileSync(filePath, 'fake data');

      db.upsertMessage({
        _id: 301, thread_id: 1, address: '+1555', body: 'test',
        date: Date.now(), type: 1, read: 0, sub_id: 0, event: 0,
      });
      db.upsertAttachment({
        part_id: 1, message_id: 301, unique_identifier: 'PART_42',
        mime_type: 'image/jpeg', filename: 'photo.jpg',
        file_size: 9, downloaded: 1, local_path: filePath, thumbnail_path: null,
      });

      handler.deleteMessage(301);

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should handle missing attachment files gracefully', () => {
      db.upsertMessage({
        _id: 302, thread_id: 1, address: '+1555', body: 'test',
        date: Date.now(), type: 1, read: 0, sub_id: 0, event: 0,
      });
      db.upsertAttachment({
        part_id: 1, message_id: 302, unique_identifier: 'PART_42',
        mime_type: 'image/jpeg', filename: 'photo.jpg',
        file_size: 100, downloaded: 1, local_path: '/nonexistent/path.jpg', thumbnail_path: null,
      });

      // Should not throw even if file doesn't exist
      expect(() => handler.deleteMessage(302)).not.toThrow();
      expect(db.getMessage(302)).toBeUndefined();
    });
  });

  describe('deleteConversation', () => {
    it('should delete conversation, messages, and attachments', () => {
      db.upsertConversation({
        thread_id: 50, addresses: '["+1555"]', snippet: 'test',
        date: Date.now(), read: 1, unread_count: 0, locally_read_at: null, has_outgoing: 0,
      });
      db.upsertMessage({
        _id: 400, thread_id: 50, address: '+1555', body: 'msg1',
        date: Date.now(), type: 1, read: 0, sub_id: 0, event: 0,
      });
      db.upsertMessage({
        _id: 401, thread_id: 50, address: '+1555', body: 'msg2',
        date: Date.now(), type: 1, read: 0, sub_id: 0, event: 0,
      });
      db.upsertAttachment({
        part_id: 1, message_id: 400, unique_identifier: 'PART_42',
        mime_type: 'image/jpeg', filename: 'photo.jpg',
        file_size: null, downloaded: 0, local_path: null, thumbnail_path: null,
      });

      handler.deleteConversation(50);

      expect(db.getConversation(50)).toBeUndefined();
      expect(db.getThreadMessages(50)).toHaveLength(0);
      expect(db.getAttachmentsForMessage(400)).toHaveLength(0);
    });

    it('should delete attachment files from disk for all messages', () => {
      const file1 = path.join(tmpDir, 'file1.jpg');
      const file2 = path.join(tmpDir, 'file2.jpg');
      fs.writeFileSync(file1, 'data1');
      fs.writeFileSync(file2, 'data2');

      db.upsertConversation({
        thread_id: 51, addresses: '["+1555"]', snippet: 'test',
        date: Date.now(), read: 1, unread_count: 0, locally_read_at: null, has_outgoing: 0,
      });
      db.upsertMessage({
        _id: 410, thread_id: 51, address: '+1555', body: 'msg1',
        date: Date.now(), type: 1, read: 0, sub_id: 0, event: 0,
      });
      db.upsertMessage({
        _id: 411, thread_id: 51, address: '+1555', body: 'msg2',
        date: Date.now(), type: 1, read: 0, sub_id: 0, event: 0,
      });
      db.upsertAttachment({
        part_id: 1, message_id: 410, unique_identifier: 'PART_42',
        mime_type: 'image/jpeg', filename: 'a.jpg',
        file_size: 5, downloaded: 1, local_path: file1, thumbnail_path: null,
      });
      db.upsertAttachment({
        part_id: 2, message_id: 411, unique_identifier: 'PART_43',
        mime_type: 'image/png', filename: 'b.png',
        file_size: 5, downloaded: 1, local_path: file2, thumbnail_path: null,
      });

      handler.deleteConversation(51);

      expect(fs.existsSync(file1)).toBe(false);
      expect(fs.existsSync(file2)).toBe(false);
    });
  });
});
