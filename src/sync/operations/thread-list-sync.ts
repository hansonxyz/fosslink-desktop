/**
 * Thread List Sync Operation
 *
 * Queries threads.list from phone, diffs against local DB:
 * - New threads: insert
 * - Deleted threads: remove from DB
 * - Updated threads: update snippet/date if phone has newer data
 *
 * Returns diff stats.
 */

import type { QueryClient } from '../query-client.js';
import type { DatabaseService } from '../../database/database.js';
import { debugConsole } from '../debug-console.js';

interface ThreadFromPhone {
  threadId: number;
  addresses: string;
  snippet: string;
  snippetDate: number;
  unreadCount: number;
}

export interface ThreadListSyncResult {
  added: number;
  removed: number;
  updated: number;
  total: number;
}

export async function threadListSync(
  queryClient: QueryClient,
  db: DatabaseService,
): Promise<ThreadListSyncResult> {
  debugConsole.narrative('Synchronizing thread list...');

  const phoneThreads = (await queryClient.query('threads.list')) as ThreadFromPhone[];

  const localThreadIds = new Set(db.getAllThreadIds());
  const phoneThreadIds = new Set(phoneThreads.map(t => t.threadId));

  let added = 0;
  let updated = 0;
  let removed = 0;

  // Upsert threads from phone
  for (const thread of phoneThreads) {
    const existing = db.getConversation(thread.threadId);

    if (!existing) {
      // New thread
      db.upsertConversation({
        thread_id: thread.threadId,
        addresses: thread.addresses,
        snippet: thread.snippet,
        date: thread.snippetDate,
        read: thread.unreadCount === 0 ? 1 : 0,
        unread_count: thread.unreadCount,
        locally_read_at: null,
        has_outgoing: 0,
      });
      added++;
    } else if (thread.snippetDate > existing.date) {
      // Phone has newer data
      db.upsertConversation({
        thread_id: thread.threadId,
        addresses: thread.addresses,
        snippet: thread.snippet,
        date: thread.snippetDate,
        read: thread.unreadCount === 0 ? 1 : 0,
        unread_count: thread.unreadCount,
        locally_read_at: existing.locally_read_at,
        has_outgoing: existing.has_outgoing,
      });
      updated++;
    }
  }

  // Delete threads that no longer exist on phone
  for (const localId of localThreadIds) {
    if (!phoneThreadIds.has(localId)) {
      db.deleteConversation(localId);
      removed++;
    }
  }

  debugConsole.narrative(
    `Thread list synced — ${phoneThreads.length} threads (${added} new, ${removed} deleted, ${updated} updated)`,
  );

  return { added, removed, updated, total: phoneThreads.length };
}
