/**
 * Database Service
 *
 * SQLite persistence layer using better-sqlite3. The database is
 * disposable — if the schema version mismatches, we wipe and
 * recreate. The phone is always the source of truth.
 */

import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SCHEMA_HASH, SCHEMA_SQL } from './schema.js';
import { ErrorCode, DatabaseError } from '../core/errors.js';
import { createLogger } from '../utils/logger.js';
import type { Logger } from '../utils/logger.js';

// --- Row types ---

export interface ConversationRow {
  thread_id: number;
  addresses: string;
  snippet: string | null;
  date: number;
  read: number;
  unread_count: number;
  /** Timestamp when user viewed this thread in the desktop app. */
  locally_read_at: number | null;
  /** Computed by getAllConversations query — not a stored column. */
  has_outgoing: number;
  /** 1 if full message history has been synced for this thread. */
  full_sync_complete: number;
  /** Epoch ms when last full sync completed. */
  full_sync_date: number;
}

export interface MessageRow {
  _id: number;
  thread_id: number;
  address: string;
  body: string | null;
  date: number;
  type: number;
  read: number;
  sub_id: number;
  event: number;
}

export interface AttachmentRow {
  part_id: number;
  message_id: number;
  unique_identifier: string;
  mime_type: string;
  filename: string | null;
  file_size: number | null;
  downloaded: number;
  local_path: string | null;
  thumbnail_path: string | null;
}

export interface ContactRow {
  uid: string;
  name: string;
  phone_numbers: string;
  photo_path: string | null;
  photo_mime: string | null;
  emails: string | null;
  addresses: string | null;
  organization: string | null;
  notes: string | null;
  birthday: string | null;
  nickname: string | null;
  account_type: string | null;
  account_name: string | null;
  timestamp: number;
}

export interface NotificationRow {
  id: string;
  app_name: string;
  title: string;
  text: string;
  time: number;
  dismissable: number;
  silent: number;
}

export interface DatabaseStats {
  conversations: number;
  messages: number;
  attachments: number;
  contacts: number;
  notifications: number;
  schemaHash: string;
}

// --- Prepared statement cache ---

interface PreparedStatements {
  upsertConversation: BetterSqlite3.Statement;
  getConversation: BetterSqlite3.Statement;
  getAllConversations: BetterSqlite3.Statement;
  deleteConversation: BetterSqlite3.Statement;
  getConversationCount: BetterSqlite3.Statement;
  markThreadLocallyRead: BetterSqlite3.Statement;

  upsertMessage: BetterSqlite3.Statement;
  getMessage: BetterSqlite3.Statement;
  getThreadMessages: BetterSqlite3.Statement;
  getMessageCount: BetterSqlite3.Statement;
  getMessageCountForThread: BetterSqlite3.Statement;
  deleteMessage: BetterSqlite3.Statement;
  deleteThreadMessages: BetterSqlite3.Statement;

  upsertAttachment: BetterSqlite3.Statement;
  getAttachment: BetterSqlite3.Statement;
  getAttachmentsForMessage: BetterSqlite3.Statement;
  getAttachmentsForThread: BetterSqlite3.Statement;
  getUndownloadedAttachments: BetterSqlite3.Statement;
  markAttachmentDownloaded: BetterSqlite3.Statement;
  setAttachmentThumbnail: BetterSqlite3.Statement;
  updateAttachmentPath: BetterSqlite3.Statement;
  deleteAttachmentsForMessage: BetterSqlite3.Statement;
  deleteAttachmentsForThread: BetterSqlite3.Statement;

  upsertContact: BetterSqlite3.Statement;
  getContact: BetterSqlite3.Statement;
  getAllContacts: BetterSqlite3.Statement;
  getContactCount: BetterSqlite3.Statement;

  upsertNotification: BetterSqlite3.Statement;
  getRecentNotifications: BetterSqlite3.Statement;
  deleteNotification: BetterSqlite3.Statement;
  clearNotifications: BetterSqlite3.Statement;

  setSyncState: BetterSqlite3.Statement;
  getSyncState: BetterSqlite3.Statement;
}

export class DatabaseService {
  private db: BetterSqlite3.Database | undefined;
  private stmts: PreparedStatements | undefined;
  private logger: Logger;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.logger = createLogger('database');
  }

  open(): void {
    if (this.db) {
      throw new DatabaseError(
        ErrorCode.DATABASE_OPEN_FAILED,
        'Database already open',
      );
    }

    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

    this.db = new Database(this.dbPath);
    this.checkSchemaVersion();

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');

    this.db.exec(SCHEMA_SQL);

    // Persist the schema hash so future startups can detect changes
    this.db.prepare(
      "INSERT OR REPLACE INTO sync_state (key, value, updated_at) VALUES ('schema_hash', ?, ?)",
    ).run(SCHEMA_HASH, Date.now());

    this.prepareStatements();

    this.logger.info('database.open', 'Database opened', {
      path: this.dbPath,
      schemaHash: SCHEMA_HASH,
    });
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = undefined;
      this.stmts = undefined;
      this.logger.debug('database.close', 'Database closed');
    }
  }

  isOpen(): boolean {
    return this.db !== undefined;
  }

  // --- Conversations ---

  upsertConversation(conv: ConversationRow): void {
    this.ensureOpen();
    this.stmts!.upsertConversation.run(conv);
  }

  upsertConversations(convs: ConversationRow[]): void {
    const db = this.ensureOpen();
    const txn = db.transaction((rows: ConversationRow[]) => {
      for (const row of rows) {
        this.stmts!.upsertConversation.run(row);
      }
    });
    txn(convs);
  }

  getConversation(threadId: number): ConversationRow | undefined {
    this.ensureOpen();
    return this.stmts!.getConversation.get(threadId) as ConversationRow | undefined;
  }

  getAllConversations(): ConversationRow[] {
    this.ensureOpen();
    return this.stmts!.getAllConversations.all() as ConversationRow[];
  }

  deleteConversation(threadId: number): void {
    this.ensureOpen();
    this.stmts!.deleteConversation.run(threadId);
  }

  markThreadLocallyRead(threadId: number): void {
    this.ensureOpen();
    this.stmts!.markThreadLocallyRead.run(Date.now(), threadId);
  }

  getConversationCount(): number {
    this.ensureOpen();
    return (this.stmts!.getConversationCount.get() as { count: number }).count;
  }

  /** Mark a thread as fully synced (all message history downloaded). */
  markThreadFullySynced(threadId: number): void {
    const db = this.ensureOpen();
    db.prepare('UPDATE conversations SET full_sync_complete = 1, full_sync_date = ? WHERE thread_id = ?')
      .run(Date.now(), threadId);
  }

  /** Mark a thread as needing full resync (stale after 6 days). */
  markThreadStale(threadId: number): void {
    const db = this.ensureOpen();
    db.prepare('UPDATE conversations SET full_sync_complete = 0, full_sync_date = 0 WHERE thread_id = ?')
      .run(threadId);
  }

  /** Mark all threads older than maxAge as stale. */
  markStaleThreads(maxAgeMs: number): number {
    const db = this.ensureOpen();
    const cutoff = Date.now() - maxAgeMs;
    const result = db.prepare(
      'UPDATE conversations SET full_sync_complete = 0 WHERE full_sync_complete = 1 AND full_sync_date < ? AND full_sync_date > 0'
    ).run(cutoff);
    return result.changes;
  }

  /** Get all thread IDs that exist locally. */
  getAllThreadIds(): number[] {
    const db = this.ensureOpen();
    return (db.prepare('SELECT thread_id FROM conversations').all() as Array<{ thread_id: number }>)
      .map(r => r.thread_id);
  }

  /** Get all message IDs for a thread. */
  getMessageIdsForThread(threadId: number): Set<number> {
    const db = this.ensureOpen();
    const rows = db.prepare('SELECT _id FROM messages WHERE thread_id = ?').all(threadId) as Array<{ _id: number }>;
    return new Set(rows.map(r => r._id));
  }

  /** Delete specific messages by ID (batch). */
  deleteMessagesByIds(ids: number[]): void {
    if (ids.length === 0) return;
    const db = this.ensureOpen();
    const txn = db.transaction((batch: number[]) => {
      const stmt = db.prepare('DELETE FROM messages WHERE _id = ?');
      const attStmt = db.prepare('DELETE FROM attachments WHERE message_id = ?');
      for (const id of batch) {
        stmt.run(id);
        attStmt.run(id);
      }
    });
    txn(ids);
  }

  // --- Pending operations queue ---

  /** Queue an operation to be sent to the phone on next connect. */
  queueOperation(opType: string, payload: Record<string, unknown>): void {
    const db = this.ensureOpen();
    db.prepare('INSERT INTO pending_operations (op_type, payload, created_at) VALUES (?, ?, ?)')
      .run(opType, JSON.stringify(payload), Date.now());
  }

  /** Get all pending operations, oldest first. */
  getPendingOperations(): Array<{ id: number; op_type: string; payload: Record<string, unknown>; created_at: number }> {
    const db = this.ensureOpen();
    const rows = db.prepare('SELECT * FROM pending_operations ORDER BY id ASC').all() as Array<{
      id: number; op_type: string; payload: string; created_at: number;
    }>;
    return rows.map(r => ({ ...r, payload: JSON.parse(r.payload) as Record<string, unknown> }));
  }

  /** Remove a pending operation after it has been sent. */
  removePendingOperation(id: number): void {
    const db = this.ensureOpen();
    db.prepare('DELETE FROM pending_operations WHERE id = ?').run(id);
  }

  /** Clear all pending operations (on unpair/resync). */
  clearPendingOperations(): void {
    const db = this.ensureOpen();
    db.prepare('DELETE FROM pending_operations').run();
  }

  /**
   * Repair conversations with empty or missing addresses by rebuilding
   * from the messages table. Returns the number of conversations repaired.
   */
  repairConversationAddresses(): number {
    const db = this.ensureOpen();
    // Find conversations with empty/malformed addresses
    const broken = db.prepare(`
      SELECT thread_id, addresses FROM conversations
      WHERE addresses IS NULL OR addresses = '' OR addresses = '[]' OR addresses = '[""]'
    `).all() as Array<{ thread_id: number; addresses: string | null }>;

    if (broken.length === 0) return 0;

    const update = db.prepare(`
      UPDATE conversations SET addresses = ? WHERE thread_id = ?
    `);

    let repaired = 0;
    const txn = db.transaction(() => {
      for (const conv of broken) {
        // Rebuild addresses from distinct non-empty addresses in messages
        const rows = db.prepare(`
          SELECT DISTINCT address FROM messages
          WHERE thread_id = ? AND address IS NOT NULL AND address != ''
        `).all(conv.thread_id) as Array<{ address: string }>;

        if (rows.length > 0) {
          const addresses = JSON.stringify(rows.map((r) => r.address));
          update.run(addresses, conv.thread_id);
          repaired++;
          this.logger.info('database.repair', 'Repaired conversation addresses', {
            threadId: conv.thread_id,
            addresses,
          });
        }
      }
    });
    txn();
    return repaired;
  }

  // --- Messages ---

  upsertMessage(msg: MessageRow): void {
    this.ensureOpen();
    this.stmts!.upsertMessage.run(msg);
  }

  upsertMessages(msgs: MessageRow[]): void {
    const db = this.ensureOpen();
    const txn = db.transaction((rows: MessageRow[]) => {
      for (const row of rows) {
        this.stmts!.upsertMessage.run(row);
      }
    });
    txn(msgs);
  }

  getMessage(id: number): MessageRow | undefined {
    this.ensureOpen();
    return this.stmts!.getMessage.get(id) as MessageRow | undefined;
  }

  getThreadMessages(threadId: number): MessageRow[] {
    this.ensureOpen();
    return this.stmts!.getThreadMessages.all(threadId) as MessageRow[];
  }

  getMessageCount(): number {
    this.ensureOpen();
    return (this.stmts!.getMessageCount.get() as { count: number }).count;
  }

  getMessageCountForThread(threadId: number): number {
    this.ensureOpen();
    return (this.stmts!.getMessageCountForThread.get(threadId) as { count: number }).count;
  }

  deleteMessage(id: number): void {
    this.ensureOpen();
    this.stmts!.deleteMessage.run(id);
  }

  deleteThreadMessages(threadId: number): void {
    this.ensureOpen();
    this.stmts!.deleteThreadMessages.run(threadId);
  }

  // --- Attachments ---

  upsertAttachment(att: AttachmentRow): void {
    this.ensureOpen();
    this.stmts!.upsertAttachment.run(att);
  }

  upsertAttachments(atts: AttachmentRow[]): void {
    const db = this.ensureOpen();
    const txn = db.transaction((rows: AttachmentRow[]) => {
      for (const row of rows) {
        this.stmts!.upsertAttachment.run(row);
      }
    });
    txn(atts);
  }

  getAttachment(partId: number, messageId: number): AttachmentRow | undefined {
    this.ensureOpen();
    return this.stmts!.getAttachment.get(partId, messageId) as AttachmentRow | undefined;
  }

  getAttachmentsForMessage(messageId: number): AttachmentRow[] {
    this.ensureOpen();
    return this.stmts!.getAttachmentsForMessage.all(messageId) as AttachmentRow[];
  }

  getAttachmentsForThread(threadId: number): AttachmentRow[] {
    this.ensureOpen();
    return this.stmts!.getAttachmentsForThread.all(threadId) as AttachmentRow[];
  }

  getUndownloadedAttachments(): AttachmentRow[] {
    this.ensureOpen();
    return this.stmts!.getUndownloadedAttachments.all() as AttachmentRow[];
  }

  markAttachmentDownloaded(partId: number, messageId: number, localPath: string, fileSize: number): void {
    this.ensureOpen();
    this.stmts!.markAttachmentDownloaded.run(localPath, fileSize, partId, messageId);
  }

  setAttachmentThumbnail(partId: number, messageId: number, thumbnailPath: string): void {
    this.ensureOpen();
    this.stmts!.setAttachmentThumbnail.run(thumbnailPath, partId, messageId);
  }

  updateAttachmentPath(partId: number, messageId: number, localPath: string, mimeType: string): void {
    this.ensureOpen();
    this.stmts!.updateAttachmentPath.run(localPath, mimeType, partId, messageId);
  }

  deleteAttachmentsForMessage(messageId: number): void {
    this.ensureOpen();
    this.stmts!.deleteAttachmentsForMessage.run(messageId);
  }

  deleteAttachmentsForThread(threadId: number): void {
    this.ensureOpen();
    this.stmts!.deleteAttachmentsForThread.run(threadId);
  }

  // --- Contacts ---

  upsertContact(contact: ContactRow): void {
    this.ensureOpen();
    this.stmts!.upsertContact.run(contact);
  }

  upsertContacts(contacts: ContactRow[]): void {
    const db = this.ensureOpen();
    const txn = db.transaction((rows: ContactRow[]) => {
      for (const row of rows) {
        this.stmts!.upsertContact.run(row);
      }
    });
    txn(contacts);
  }

  getContact(uid: string): ContactRow | undefined {
    this.ensureOpen();
    return this.stmts!.getContact.get(uid) as ContactRow | undefined;
  }

  getAllContacts(): ContactRow[] {
    this.ensureOpen();
    return this.stmts!.getAllContacts.all() as ContactRow[];
  }

  deleteContact(uid: string): void {
    const db = this.ensureOpen();
    db.prepare('DELETE FROM contacts WHERE uid = ?').run(uid);
  }

  getContactCount(): number {
    this.ensureOpen();
    return (this.stmts!.getContactCount.get() as { count: number }).count;
  }

  // --- Notifications ---

  upsertNotification(notif: NotificationRow): void {
    this.ensureOpen();
    this.stmts!.upsertNotification.run(notif);
  }

  getRecentNotifications(limit: number): NotificationRow[] {
    this.ensureOpen();
    return this.stmts!.getRecentNotifications.all(limit) as NotificationRow[];
  }

  deleteNotification(id: string): void {
    this.ensureOpen();
    this.stmts!.deleteNotification.run(id);
  }

  clearNotifications(): void {
    this.ensureOpen();
    this.stmts!.clearNotifications.run();
  }

  // --- Sync State ---

  setSyncState(key: string, value: string): void {
    this.ensureOpen();
    this.stmts!.setSyncState.run(key, value, Date.now());
  }

  getSyncState(key: string): string | undefined {
    this.ensureOpen();
    const row = this.stmts!.getSyncState.get(key) as { value: string } | undefined;
    return row?.value;
  }

  // --- Utility ---

  getStats(): DatabaseStats {
    const db = this.ensureOpen();
    const count = (table: string): number => {
      return (db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }).count;
    };
    return {
      conversations: count('conversations'),
      messages: count('messages'),
      attachments: count('attachments'),
      contacts: count('contacts'),
      notifications: count('notifications'),
      schemaHash: SCHEMA_HASH,
    };
  }

  /**
   * Drop the database file entirely and reprovision from schema.
   * This is the only way to wipe data — no selective DELETEs.
   */
  wipeAllData(): void {
    this.ensureOpen();

    // Close, delete db + WAL/SHM files
    this.db!.close();
    this.db = undefined;
    this.stmts = undefined;

    fs.unlinkSync(this.dbPath);
    const walPath = this.dbPath + '-wal';
    const shmPath = this.dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // Reprovision fresh
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.db.exec(SCHEMA_SQL);
    this.db.prepare(
      "INSERT OR REPLACE INTO sync_state (key, value, updated_at) VALUES ('schema_hash', ?, ?)",
    ).run(SCHEMA_HASH, Date.now());
    this.prepareStatements();

    this.logger.info('database.wipe', 'Database dropped and reprovisioned', {
      path: this.dbPath,
      schemaHash: SCHEMA_HASH,
    });
  }

  /** Alias for wipeAllData — kept for backward compat. */
  clearAllData(): void {
    this.wipeAllData();
  }

  // --- Internal ---

  private ensureOpen(): BetterSqlite3.Database {
    if (!this.db) {
      throw new DatabaseError(
        ErrorCode.DATABASE_OPEN_FAILED,
        'Database not open. Call open() first.',
      );
    }
    return this.db;
  }

  private checkSchemaVersion(): void {
    // Read stored schema hash. On a brand-new DB the table won't exist yet,
    // so we check for it first.
    let storedHash: string | undefined;
    let isExistingDb = false;
    try {
      const row = this.db!.prepare(
        "SELECT value FROM sync_state WHERE key = 'schema_hash'",
      ).get() as { value: string } | undefined;
      storedHash = row?.value;
      isExistingDb = true; // sync_state table exists → not a fresh DB
    } catch {
      // Table doesn't exist yet — check if this is a legacy DB (has user_version set)
      // or a truly brand-new DB
      const userVersion = this.db!.pragma('user_version', { simple: true }) as number;
      isExistingDb = userVersion > 0;
    }

    if (storedHash === SCHEMA_HASH) {
      return;
    }

    // Wipe if this is an existing DB with a different (or missing) schema hash
    if (isExistingDb) {
      this.logger.warn('database.schema', 'Schema changed, wiping database', {
        dbHash: storedHash ?? '(legacy)',
        codeHash: SCHEMA_HASH,
      });

      this.db!.close();

      // Delete db file and WAL/SHM files
      fs.unlinkSync(this.dbPath);
      const walPath = this.dbPath + '-wal';
      const shmPath = this.dbPath + '-shm';
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

      this.db = new Database(this.dbPath);
    }
  }

  private prepareStatements(): void {
    const db = this.db!;

    this.stmts = {
      // Conversations
      upsertConversation: db.prepare(`
        INSERT INTO conversations (thread_id, addresses, snippet, date, read, unread_count)
        VALUES (@thread_id, @addresses, @snippet, @date, @read, @unread_count)
        ON CONFLICT(thread_id) DO UPDATE SET
          addresses = excluded.addresses,
          snippet = excluded.snippet,
          date = excluded.date,
          read = excluded.read,
          unread_count = excluded.unread_count,
          locally_read_at = conversations.locally_read_at,
          full_sync_complete = conversations.full_sync_complete,
          full_sync_date = conversations.full_sync_date
      `),
      getConversation: db.prepare('SELECT * FROM conversations WHERE thread_id = ?'),
      getAllConversations: db.prepare(`
        SELECT c.*,
          CASE WHEN EXISTS (
            SELECT 1 FROM messages m WHERE m.thread_id = c.thread_id AND m.type = 2
              AND LOWER(TRIM(m.body)) != 'stop'
          ) THEN 1 ELSE 0 END AS has_outgoing
        FROM conversations c
        ORDER BY c.date DESC
      `),
      deleteConversation: db.prepare('DELETE FROM conversations WHERE thread_id = ?'),
      getConversationCount: db.prepare('SELECT COUNT(*) as count FROM conversations'),
      markThreadLocallyRead: db.prepare('UPDATE conversations SET locally_read_at = ? WHERE thread_id = ?'),

      // Messages
      upsertMessage: db.prepare(`
        INSERT INTO messages (_id, thread_id, address, body, date, type, read, sub_id, event)
        VALUES (@_id, @thread_id, @address, @body, @date, @type, @read, @sub_id, @event)
        ON CONFLICT(_id) DO UPDATE SET
          thread_id = excluded.thread_id,
          address = excluded.address,
          body = excluded.body,
          date = excluded.date,
          type = excluded.type,
          read = excluded.read,
          sub_id = excluded.sub_id,
          event = excluded.event
      `),
      getMessage: db.prepare('SELECT * FROM messages WHERE _id = ?'),
      getThreadMessages: db.prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY date ASC'),
      getMessageCount: db.prepare('SELECT COUNT(*) as count FROM messages'),
      getMessageCountForThread: db.prepare('SELECT COUNT(*) as count FROM messages WHERE thread_id = ?'),
      deleteMessage: db.prepare('DELETE FROM messages WHERE _id = ?'),
      deleteThreadMessages: db.prepare('DELETE FROM messages WHERE thread_id = ?'),

      // Attachments
      upsertAttachment: db.prepare(`
        INSERT INTO attachments (part_id, message_id, unique_identifier, mime_type, filename, file_size, downloaded, local_path, thumbnail_path)
        VALUES (@part_id, @message_id, @unique_identifier, @mime_type, @filename, @file_size, @downloaded, @local_path, @thumbnail_path)
        ON CONFLICT(part_id, message_id) DO UPDATE SET
          unique_identifier = excluded.unique_identifier,
          mime_type = excluded.mime_type,
          filename = excluded.filename,
          file_size = COALESCE(attachments.file_size, excluded.file_size),
          downloaded = MAX(attachments.downloaded, excluded.downloaded),
          local_path = COALESCE(attachments.local_path, excluded.local_path),
          thumbnail_path = COALESCE(attachments.thumbnail_path, excluded.thumbnail_path)
      `),
      getAttachment: db.prepare('SELECT * FROM attachments WHERE part_id = ? AND message_id = ?'),
      getAttachmentsForMessage: db.prepare('SELECT * FROM attachments WHERE message_id = ?'),
      getAttachmentsForThread: db.prepare(
        'SELECT a.* FROM attachments a INNER JOIN messages m ON a.message_id = m._id WHERE m.thread_id = ?',
      ),
      getUndownloadedAttachments: db.prepare('SELECT * FROM attachments WHERE downloaded = 0'),
      markAttachmentDownloaded: db.prepare(
        'UPDATE attachments SET downloaded = 1, local_path = ?, file_size = ? WHERE part_id = ? AND message_id = ?',
      ),
      setAttachmentThumbnail: db.prepare(
        'UPDATE attachments SET thumbnail_path = ? WHERE part_id = ? AND message_id = ?',
      ),
      updateAttachmentPath: db.prepare(
        'UPDATE attachments SET local_path = ?, mime_type = ? WHERE part_id = ? AND message_id = ?',
      ),
      deleteAttachmentsForMessage: db.prepare('DELETE FROM attachments WHERE message_id = ?'),
      deleteAttachmentsForThread: db.prepare(
        'DELETE FROM attachments WHERE message_id IN (SELECT _id FROM messages WHERE thread_id = ?)',
      ),

      // Contacts
      upsertContact: db.prepare(`
        INSERT INTO contacts (uid, name, phone_numbers, photo_path, photo_mime, emails, addresses, organization, notes, birthday, nickname, account_type, account_name, timestamp)
        VALUES (@uid, @name, @phone_numbers, @photo_path, @photo_mime, @emails, @addresses, @organization, @notes, @birthday, @nickname, @account_type, @account_name, @timestamp)
        ON CONFLICT(uid) DO UPDATE SET
          name = excluded.name,
          phone_numbers = excluded.phone_numbers,
          photo_path = excluded.photo_path,
          photo_mime = excluded.photo_mime,
          emails = excluded.emails,
          addresses = excluded.addresses,
          organization = excluded.organization,
          notes = excluded.notes,
          birthday = excluded.birthday,
          nickname = excluded.nickname,
          account_type = excluded.account_type,
          account_name = excluded.account_name,
          timestamp = excluded.timestamp
      `),
      getContact: db.prepare('SELECT * FROM contacts WHERE uid = ?'),
      getAllContacts: db.prepare('SELECT * FROM contacts ORDER BY name ASC'),
      getContactCount: db.prepare('SELECT COUNT(*) as count FROM contacts'),

      // Notifications
      upsertNotification: db.prepare(`
        INSERT INTO notifications (id, app_name, title, text, time, dismissable, silent)
        VALUES (@id, @app_name, @title, @text, @time, @dismissable, @silent)
        ON CONFLICT(id) DO UPDATE SET
          app_name = excluded.app_name,
          title = excluded.title,
          text = excluded.text,
          time = excluded.time,
          dismissable = excluded.dismissable,
          silent = excluded.silent
      `),
      getRecentNotifications: db.prepare('SELECT * FROM notifications ORDER BY time DESC LIMIT ?'),
      deleteNotification: db.prepare('DELETE FROM notifications WHERE id = ?'),
      clearNotifications: db.prepare('DELETE FROM notifications'),

      // Sync state
      setSyncState: db.prepare(`
        INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `),
      getSyncState: db.prepare('SELECT value FROM sync_state WHERE key = ?'),
    };
  }
}
