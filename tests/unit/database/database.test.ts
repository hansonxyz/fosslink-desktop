import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import Database from 'better-sqlite3';
import { DatabaseService } from '../../../src/database/database.js';
import type {
  ConversationRow,
  MessageRow,
  AttachmentRow,
  ContactRow,
  NotificationRow,
} from '../../../src/database/database.js';
import { SCHEMA_HASH } from '../../../src/database/schema.js';

describe('DatabaseService', () => {
  let db: DatabaseService;
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xyz-db-test-'));
    dbPath = path.join(tmpDir, 'test.db');
    db = new DatabaseService(dbPath);
  });

  afterEach(() => {
    try { db.close(); } catch { /* may already be closed */ }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // --- Test data factories ---

  function makeConversation(overrides?: Partial<ConversationRow>): ConversationRow {
    return {
      thread_id: 1,
      addresses: '["5551234567"]',
      snippet: 'Hello there',
      date: 1700000000000,
      read: 1,
      unread_count: 0,
      locally_read_at: null,
      has_outgoing: 0,
      ...overrides,
    };
  }

  function makeMessage(overrides?: Partial<MessageRow>): MessageRow {
    return {
      _id: 100,
      thread_id: 1,
      address: '5551234567',
      body: 'Hello there',
      date: 1700000000000,
      type: 1,
      read: 0,
      sub_id: 0,
      event: 0,
      ...overrides,
    };
  }

  function makeAttachment(overrides?: Partial<AttachmentRow>): AttachmentRow {
    return {
      part_id: 1,
      message_id: 100,
      unique_identifier: 'PART_999',
      mime_type: 'image/jpeg',
      filename: 'photo.jpg',
      file_size: null,
      downloaded: 0,
      local_path: null,
      thumbnail_path: null,
      ...overrides,
    };
  }

  function makeContact(overrides?: Partial<ContactRow>): ContactRow {
    return {
      uid: 'contact-1',
      name: 'Alice Smith',
      phone_numbers: '[{"number":"5551234567","type":"cell"}]',
      photo_path: null,
      photo_mime: null,
      emails: null,
      addresses: null,
      organization: null,
      notes: null,
      birthday: null,
      nickname: null,
      account_type: null,
      account_name: null,
      timestamp: 1700000000,
      ...overrides,
    };
  }

  function makeNotification(overrides?: Partial<NotificationRow>): NotificationRow {
    return {
      id: 'notif-1',
      app_name: 'Messages',
      title: 'New message',
      text: 'Hello there',
      time: 1700000000000,
      dismissable: 1,
      silent: 0,
      ...overrides,
    };
  }

  // --- Lifecycle ---

  describe('lifecycle', () => {
    it('creates database file on open', () => {
      db.open();
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('isOpen returns false before open', () => {
      expect(db.isOpen()).toBe(false);
    });

    it('isOpen returns true after open', () => {
      db.open();
      expect(db.isOpen()).toBe(true);
    });

    it('isOpen returns false after close', () => {
      db.open();
      db.close();
      expect(db.isOpen()).toBe(false);
    });

    it('throws when opening already-open database', () => {
      db.open();
      expect(() => db.open()).toThrow('Database already open');
    });

    it('allows reopen after close', () => {
      db.open();
      db.close();
      db.open();
      expect(db.isOpen()).toBe(true);
    });

    it('methods throw when database is not open', () => {
      expect(() => db.getAllConversations()).toThrow('Database not open');
      expect(() => db.getMessageCount()).toThrow('Database not open');
      expect(() => db.getAllContacts()).toThrow('Database not open');
    });
  });

  // --- Schema version ---

  describe('schema version', () => {
    it('sets schema version on fresh database', () => {
      db.open();
      const stats = db.getStats();
      expect(stats.schemaHash).toBe(SCHEMA_HASH);
    });

    it('preserves data when version matches', () => {
      db.open();
      db.upsertConversation(makeConversation());
      db.close();

      const db2 = new DatabaseService(dbPath);
      db2.open();
      expect(db2.getConversationCount()).toBe(1);
      db2.close();
    });

    it('wipes database when schema hash mismatches', () => {
      db.open();
      db.upsertConversation(makeConversation());
      db.close();

      // Manually change the stored schema hash to simulate old schema
      const raw = new Database(dbPath);
      raw.prepare(
        "UPDATE sync_state SET value = 'old_hash_1234' WHERE key = 'schema_hash'",
      ).run();
      raw.close();

      const db2 = new DatabaseService(dbPath);
      db2.open();
      expect(db2.getConversationCount()).toBe(0);
      expect(db2.getStats().schemaHash).toBe(SCHEMA_HASH);
      db2.close();
    });

    it('wipes legacy database with user_version but no schema hash', () => {
      db.open();
      db.upsertConversation(makeConversation());
      db.close();

      // Simulate legacy DB: has user_version set, remove schema_hash row
      const raw = new Database(dbPath);
      raw.pragma('user_version = 1');
      raw.prepare("DELETE FROM sync_state WHERE key = 'schema_hash'").run();
      raw.close();

      const db2 = new DatabaseService(dbPath);
      db2.open();
      expect(db2.getConversationCount()).toBe(0);
      expect(db2.getStats().schemaHash).toBe(SCHEMA_HASH);
      db2.close();
    });
  });

  // --- Conversations ---

  describe('conversations', () => {
    beforeEach(() => db.open());

    it('inserts a new conversation', () => {
      db.upsertConversation(makeConversation());
      expect(db.getConversationCount()).toBe(1);
    });

    it('upserts existing conversation', () => {
      db.upsertConversation(makeConversation());
      db.upsertConversation(makeConversation({ snippet: 'Updated' }));
      expect(db.getConversationCount()).toBe(1);
      expect(db.getConversation(1)!.snippet).toBe('Updated');
    });

    it('returns undefined for non-existent conversation', () => {
      expect(db.getConversation(999)).toBeUndefined();
    });

    it('getAllConversations returns sorted by date DESC', () => {
      db.upsertConversation(makeConversation({ thread_id: 1, date: 1000 }));
      db.upsertConversation(makeConversation({ thread_id: 2, date: 3000 }));
      db.upsertConversation(makeConversation({ thread_id: 3, date: 2000 }));

      const all = db.getAllConversations();
      expect(all.map((c) => c.thread_id)).toEqual([2, 3, 1]);
    });

    it('bulk upsert in transaction', () => {
      const convs = [
        makeConversation({ thread_id: 1 }),
        makeConversation({ thread_id: 2 }),
        makeConversation({ thread_id: 3 }),
      ];
      db.upsertConversations(convs);
      expect(db.getConversationCount()).toBe(3);
    });

    it('deletes a conversation', () => {
      db.upsertConversation(makeConversation());
      db.deleteConversation(1);
      expect(db.getConversationCount()).toBe(0);
    });
  });

  // --- Messages ---

  describe('messages', () => {
    beforeEach(() => db.open());

    it('inserts a new message', () => {
      db.upsertMessage(makeMessage());
      expect(db.getMessageCount()).toBe(1);
    });

    it('upserts existing message', () => {
      db.upsertMessage(makeMessage());
      db.upsertMessage(makeMessage({ body: 'Updated body' }));
      expect(db.getMessageCount()).toBe(1);
      expect(db.getMessage(100)!.body).toBe('Updated body');
    });

    it('returns undefined for non-existent message', () => {
      expect(db.getMessage(999)).toBeUndefined();
    });

    it('getThreadMessages returns sorted by date ASC', () => {
      db.upsertMessage(makeMessage({ _id: 1, date: 3000 }));
      db.upsertMessage(makeMessage({ _id: 2, date: 1000 }));
      db.upsertMessage(makeMessage({ _id: 3, date: 2000 }));

      const msgs = db.getThreadMessages(1);
      expect(msgs.map((m) => m._id)).toEqual([2, 3, 1]);
    });

    it('getThreadMessages returns empty for non-existent thread', () => {
      expect(db.getThreadMessages(999)).toEqual([]);
    });

    it('bulk upsert in transaction', () => {
      const msgs = [
        makeMessage({ _id: 1 }),
        makeMessage({ _id: 2 }),
        makeMessage({ _id: 3 }),
      ];
      db.upsertMessages(msgs);
      expect(db.getMessageCount()).toBe(3);
    });

    it('getMessageCountForThread returns correct count', () => {
      db.upsertMessage(makeMessage({ _id: 1, thread_id: 1 }));
      db.upsertMessage(makeMessage({ _id: 2, thread_id: 1 }));
      db.upsertMessage(makeMessage({ _id: 3, thread_id: 2 }));
      expect(db.getMessageCountForThread(1)).toBe(2);
      expect(db.getMessageCountForThread(2)).toBe(1);
    });

    it('deletes a single message', () => {
      db.upsertMessage(makeMessage({ _id: 1 }));
      db.upsertMessage(makeMessage({ _id: 2 }));
      db.deleteMessage(1);
      expect(db.getMessageCount()).toBe(1);
    });

    it('deletes all messages for a thread', () => {
      db.upsertMessage(makeMessage({ _id: 1, thread_id: 1 }));
      db.upsertMessage(makeMessage({ _id: 2, thread_id: 1 }));
      db.upsertMessage(makeMessage({ _id: 3, thread_id: 2 }));
      db.deleteThreadMessages(1);
      expect(db.getMessageCount()).toBe(1);
      expect(db.getMessage(3)).toBeDefined();
    });

    it('handles null body for MMS', () => {
      db.upsertMessage(makeMessage({ body: null }));
      expect(db.getMessage(100)!.body).toBeNull();
    });
  });

  // --- Attachments ---

  describe('attachments', () => {
    beforeEach(() => db.open());

    it('inserts a new attachment', () => {
      db.upsertAttachment(makeAttachment());
      const atts = db.getAttachmentsForMessage(100);
      expect(atts).toHaveLength(1);
      expect(atts[0]!.mime_type).toBe('image/jpeg');
    });

    it('upserts existing attachment', () => {
      db.upsertAttachment(makeAttachment());
      db.upsertAttachment(makeAttachment({ filename: 'updated.jpg' }));
      const atts = db.getAttachmentsForMessage(100);
      expect(atts).toHaveLength(1);
      expect(atts[0]!.filename).toBe('updated.jpg');
    });

    it('returns empty for message with no attachments', () => {
      expect(db.getAttachmentsForMessage(999)).toEqual([]);
    });

    it('getUndownloadedAttachments returns only undownloaded', () => {
      db.upsertAttachment(makeAttachment({ part_id: 1, downloaded: 0 }));
      db.upsertAttachment(makeAttachment({ part_id: 2, downloaded: 1 }));
      const undownloaded = db.getUndownloadedAttachments();
      expect(undownloaded).toHaveLength(1);
      expect(undownloaded[0]!.part_id).toBe(1);
    });

    it('markAttachmentDownloaded updates fields', () => {
      db.upsertAttachment(makeAttachment());
      db.markAttachmentDownloaded(1, 100, '/tmp/photo.jpg', 12345);
      const atts = db.getAttachmentsForMessage(100);
      expect(atts[0]!.downloaded).toBe(1);
      expect(atts[0]!.local_path).toBe('/tmp/photo.jpg');
      expect(atts[0]!.file_size).toBe(12345);
    });

    it('bulk upsert in transaction', () => {
      const atts = [
        makeAttachment({ part_id: 1 }),
        makeAttachment({ part_id: 2 }),
        makeAttachment({ part_id: 3 }),
      ];
      db.upsertAttachments(atts);
      expect(db.getAttachmentsForMessage(100)).toHaveLength(3);
    });

    it('getAttachment returns single row by composite key', () => {
      db.upsertAttachment(makeAttachment({ part_id: 5, message_id: 200 }));
      const att = db.getAttachment(5, 200);
      expect(att).toBeDefined();
      expect(att!.part_id).toBe(5);
      expect(att!.message_id).toBe(200);
    });

    it('getAttachment returns undefined for missing row', () => {
      expect(db.getAttachment(999, 999)).toBeUndefined();
    });

    it('deleteAttachmentsForMessage removes correct rows only', () => {
      db.upsertAttachment(makeAttachment({ part_id: 1, message_id: 100 }));
      db.upsertAttachment(makeAttachment({ part_id: 2, message_id: 100 }));
      db.upsertAttachment(makeAttachment({ part_id: 3, message_id: 200 }));

      db.deleteAttachmentsForMessage(100);

      expect(db.getAttachmentsForMessage(100)).toHaveLength(0);
      expect(db.getAttachmentsForMessage(200)).toHaveLength(1);
    });

    it('deleteAttachmentsForThread removes rows across messages in thread', () => {
      // Create messages in thread 1
      db.upsertMessage(makeMessage({ _id: 10, thread_id: 1 }));
      db.upsertMessage(makeMessage({ _id: 11, thread_id: 1 }));
      // Create message in thread 2
      db.upsertMessage(makeMessage({ _id: 20, thread_id: 2 }));

      // Attachments for thread 1
      db.upsertAttachment(makeAttachment({ part_id: 1, message_id: 10 }));
      db.upsertAttachment(makeAttachment({ part_id: 2, message_id: 11 }));
      // Attachment for thread 2
      db.upsertAttachment(makeAttachment({ part_id: 3, message_id: 20 }));

      db.deleteAttachmentsForThread(1);

      expect(db.getAttachmentsForMessage(10)).toHaveLength(0);
      expect(db.getAttachmentsForMessage(11)).toHaveLength(0);
      expect(db.getAttachmentsForMessage(20)).toHaveLength(1);
    });
  });

  describe('wipeAllData', () => {
    beforeEach(() => db.open());

    it('clears all data tables but not sync_state', () => {
      db.upsertConversation(makeConversation());
      db.upsertMessage(makeMessage());
      db.upsertAttachment(makeAttachment());
      db.upsertContact(makeContact());
      db.upsertNotification(makeNotification());
      db.setSyncState('lastSync', '12345');

      db.wipeAllData();

      const stats = db.getStats();
      expect(stats.conversations).toBe(0);
      expect(stats.messages).toBe(0);
      expect(stats.attachments).toBe(0);
      expect(stats.contacts).toBe(0);
      expect(stats.notifications).toBe(0);
      // sync_state should be preserved
      expect(db.getSyncState('lastSync')).toBe('12345');
    });
  });

  // --- Contacts ---

  describe('contacts', () => {
    beforeEach(() => db.open());

    it('inserts a new contact', () => {
      db.upsertContact(makeContact());
      expect(db.getContactCount()).toBe(1);
    });

    it('upserts existing contact', () => {
      db.upsertContact(makeContact());
      db.upsertContact(makeContact({ name: 'Alice Jones' }));
      expect(db.getContactCount()).toBe(1);
      expect(db.getContact('contact-1')!.name).toBe('Alice Jones');
    });

    it('returns undefined for non-existent contact', () => {
      expect(db.getContact('nonexistent')).toBeUndefined();
    });

    it('getAllContacts returns sorted by name ASC', () => {
      db.upsertContact(makeContact({ uid: 'c1', name: 'Charlie' }));
      db.upsertContact(makeContact({ uid: 'c2', name: 'Alice' }));
      db.upsertContact(makeContact({ uid: 'c3', name: 'Bob' }));

      const all = db.getAllContacts();
      expect(all.map((c) => c.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('bulk upsert in transaction', () => {
      const contacts = [
        makeContact({ uid: 'c1' }),
        makeContact({ uid: 'c2' }),
        makeContact({ uid: 'c3' }),
      ];
      db.upsertContacts(contacts);
      expect(db.getContactCount()).toBe(3);
    });
  });

  // --- Notifications ---

  describe('notifications', () => {
    beforeEach(() => db.open());

    it('inserts a new notification', () => {
      db.upsertNotification(makeNotification());
      const notifs = db.getRecentNotifications(10);
      expect(notifs).toHaveLength(1);
    });

    it('upserts existing notification', () => {
      db.upsertNotification(makeNotification());
      db.upsertNotification(makeNotification({ text: 'Updated' }));
      const notifs = db.getRecentNotifications(10);
      expect(notifs).toHaveLength(1);
      expect(notifs[0]!.text).toBe('Updated');
    });

    it('getRecentNotifications returns sorted by time DESC with limit', () => {
      db.upsertNotification(makeNotification({ id: 'n1', time: 1000 }));
      db.upsertNotification(makeNotification({ id: 'n2', time: 3000 }));
      db.upsertNotification(makeNotification({ id: 'n3', time: 2000 }));

      const notifs = db.getRecentNotifications(2);
      expect(notifs).toHaveLength(2);
      expect(notifs.map((n) => n.id)).toEqual(['n2', 'n3']);
    });

    it('deletes a notification', () => {
      db.upsertNotification(makeNotification());
      db.deleteNotification('notif-1');
      expect(db.getRecentNotifications(10)).toHaveLength(0);
    });

    it('clearNotifications removes all', () => {
      db.upsertNotification(makeNotification({ id: 'n1' }));
      db.upsertNotification(makeNotification({ id: 'n2' }));
      db.clearNotifications();
      expect(db.getRecentNotifications(10)).toHaveLength(0);
    });
  });

  // --- Sync State ---

  describe('sync state', () => {
    beforeEach(() => db.open());

    it('set and get roundtrip', () => {
      db.setSyncState('last_sync', '1700000000000');
      expect(db.getSyncState('last_sync')).toBe('1700000000000');
    });

    it('returns undefined for non-existent key', () => {
      expect(db.getSyncState('nonexistent')).toBeUndefined();
    });

    it('overwrites existing key', () => {
      db.setSyncState('last_sync', '1000');
      db.setSyncState('last_sync', '2000');
      expect(db.getSyncState('last_sync')).toBe('2000');
    });
  });

  // --- Utility ---

  describe('utility', () => {
    beforeEach(() => db.open());

    it('getStats returns correct counts', () => {
      db.upsertConversation(makeConversation());
      db.upsertMessage(makeMessage());
      db.upsertAttachment(makeAttachment());
      db.upsertContact(makeContact());
      db.upsertNotification(makeNotification());

      const stats = db.getStats();
      expect(stats.conversations).toBe(1);
      expect(stats.messages).toBe(1);
      expect(stats.attachments).toBe(1);
      expect(stats.contacts).toBe(1);
      expect(stats.notifications).toBe(1);
      expect(stats.schemaHash).toBe(SCHEMA_HASH);
    });

    it('clearAllData removes all rows', () => {
      db.upsertConversation(makeConversation());
      db.upsertMessage(makeMessage());
      db.upsertAttachment(makeAttachment());
      db.upsertContact(makeContact());
      db.upsertNotification(makeNotification());
      db.setSyncState('test', 'value');

      db.clearAllData();

      const stats = db.getStats();
      expect(stats.conversations).toBe(0);
      expect(stats.messages).toBe(0);
      expect(stats.attachments).toBe(0);
      expect(stats.contacts).toBe(0);
      expect(stats.notifications).toBe(0);
      expect(db.getSyncState('test')).toBeUndefined();
    });

    it('clearAllData preserves schema (tables still exist)', () => {
      db.clearAllData();
      // Should not throw — tables still exist
      db.upsertConversation(makeConversation());
      expect(db.getConversationCount()).toBe(1);
    });
  });

  // --- Empty state ---

  describe('empty state', () => {
    beforeEach(() => db.open());

    it('all getAll methods return empty arrays', () => {
      expect(db.getAllConversations()).toEqual([]);
      expect(db.getThreadMessages(1)).toEqual([]);
      expect(db.getAttachmentsForMessage(1)).toEqual([]);
      expect(db.getUndownloadedAttachments()).toEqual([]);
      expect(db.getAllContacts()).toEqual([]);
      expect(db.getRecentNotifications(10)).toEqual([]);
    });

    it('all count methods return 0', () => {
      expect(db.getConversationCount()).toBe(0);
      expect(db.getMessageCount()).toBe(0);
      expect(db.getMessageCountForThread(1)).toBe(0);
      expect(db.getContactCount()).toBe(0);
    });

    it('getStats returns all zeros', () => {
      const stats = db.getStats();
      expect(stats.conversations).toBe(0);
      expect(stats.messages).toBe(0);
      expect(stats.attachments).toBe(0);
      expect(stats.contacts).toBe(0);
      expect(stats.notifications).toBe(0);
    });
  });
});
