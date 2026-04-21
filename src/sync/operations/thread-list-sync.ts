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

/** Phone-number key for deduplication: last 10 digits (handles +1/1- prefix
 *  variants), or all digits if shorter. */
function phoneKey(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/** Dedupe addresses that refer to the same person in different formats
 *  (e.g. "5551234567", "+15551234567", "(555) 123-4567"). Keeps the first
 *  occurrence of each normalized number. */
function dedupeAddresses(addresses: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const addr of addresses) {
    const key = phoneKey(addr);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    result.push(addr);
  }
  return result;
}

/** Normalize phone addresses to a JSON array string for DB storage. */
function normalizeAddresses(raw: string | string[]): string {
  let arr: string[];
  if (Array.isArray(raw)) {
    arr = raw;
  } else {
    // Already a JSON array string? Parse.
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { /* not JSON */ }
    arr = Array.isArray(parsed) ? (parsed as string[]) : [raw];
  }
  return JSON.stringify(dedupeAddresses(arr));
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
