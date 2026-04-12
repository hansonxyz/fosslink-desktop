/**
 * Database Schema
 *
 * Single authoritative location for table definitions.
 * No migrations — if schema changes, wipe and recreate from phone sync.
 *
 * SCHEMA_HASH is auto-computed from the SQL content below. Any change to
 * table definitions, columns, indexes, etc. automatically triggers a DB
 * wipe on next startup. No manual version bumps needed.
 */

import { createHash } from 'node:crypto';

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS conversations (
  thread_id INTEGER PRIMARY KEY,
  addresses TEXT NOT NULL,
  snippet TEXT,
  date INTEGER NOT NULL,
  read INTEGER NOT NULL DEFAULT 1,
  unread_count INTEGER NOT NULL DEFAULT 0,
  locally_read_at INTEGER,
  full_sync_complete INTEGER NOT NULL DEFAULT 0,
  full_sync_date INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_conversations_date ON conversations(date DESC);

CREATE TABLE IF NOT EXISTS messages (
  _id INTEGER PRIMARY KEY,
  thread_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  body TEXT,
  date INTEGER NOT NULL,
  type INTEGER NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  sub_id INTEGER NOT NULL DEFAULT 0,
  event INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_thread_date ON messages(thread_id, date);
CREATE INDEX IF NOT EXISTS idx_messages_thread_type ON messages(thread_id, type);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date);

CREATE TABLE IF NOT EXISTS attachments (
  part_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  unique_identifier TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  filename TEXT,
  file_size INTEGER,
  downloaded INTEGER NOT NULL DEFAULT 0,
  local_path TEXT,
  thumbnail_path TEXT,
  PRIMARY KEY (part_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);

CREATE TABLE IF NOT EXISTS contacts (
  uid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone_numbers TEXT NOT NULL,
  photo_path TEXT,
  photo_mime TEXT,
  emails TEXT,
  addresses TEXT,
  organization TEXT,
  notes TEXT,
  birthday TEXT,
  nickname TEXT,
  account_type TEXT,
  account_name TEXT,
  timestamp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  app_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  time INTEGER NOT NULL,
  dismissable INTEGER NOT NULL DEFAULT 0,
  silent INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notifications_time ON notifications(time DESC);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  op_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

/** SHA-256 hash of SCHEMA_SQL (first 16 hex chars). Changes automatically when schema changes. */
export const SCHEMA_HASH = createHash('sha256').update(SCHEMA_SQL).digest('hex').substring(0, 16);
