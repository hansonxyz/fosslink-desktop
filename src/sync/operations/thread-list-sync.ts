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
  addresses: string | string[];  // phone sends JSONArray (string[]) after v1.5.0 Android
  snippet: string;
  snippetDate: number;
  unreadCount: number;
}

/** Normalize phone addresses to a JSON array string for DB storage. */
function normalizeAddresses(raw: string | string[]): string {
  if (Array.isArray(raw)) {
    return JSON.stringify(raw);
  }
  // Already a JSON array string? Parse and re-serialize to normalize.
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return JSON.stringify(parsed);
  } catch { /* not JSON */ }
  // Plain string (single number) — wrap in array
  return JSON.stringify([raw]);
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
        addresses: normalizeAddresses(thread.addresses),
        snippet: thread.snippet,
        date: thread.snippetDate,
        read: thread.unreadCount === 0 ? 1 : 0,
        unread_count: thread.unreadCount,
        locally_read_at: null,
        has_outgoing: 0,
      });
      added++;
    } else if (thread.snippetDate > existing.date) {
      // Phone has newer data — update everything
      db.upsertConversation({
        thread_id: thread.threadId,
        addresses: normalizeAddresses(thread.addresses),
        snippet: thread.snippet,
        date: thread.snippetDate,
        read: thread.unreadCount === 0 ? 1 : 0,
        unread_count: thread.unreadCount,
        locally_read_at: existing.locally_read_at,
        has_outgoing: existing.has_outgoing,
      });
      updated++;
    } else if (normalizeAddresses(thread.addresses) !== existing.addresses) {
      // Addresses corrected on phone side — update addresses only, preserve local state
      db.upsertConversation({
        ...existing,
        addresses: normalizeAddresses(thread.addresses),
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
