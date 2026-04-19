/**
 * Quick Message Sync Operation
 *
 * Syncs messages for a single thread within a time window.
 * Used for the background Phase 3 sync (recent messages only).
 * Upserts messages, deduplicates by _id.
 */

import type { QueryClient } from '../query-client.js';
import type { DatabaseService } from '../../database/database.js';
import type { MessageRow, AttachmentRow } from '../../database/database.js';
import { debugConsole } from '../debug-console.js';

interface MessageFromPhone {
  _id: number;
  thread_id: number;
  address: string;
  body: string | null;
  date: number;
  type: number;
  read: number;
  sub_id: number;
  event: number;
  attachments?: Array<{
    part_id: number;
    unique_identifier: number | string;
    mime_type: string;
    filename?: string;
    encoded_thumbnail?: string;
  }>;
}

export interface QuickMessageSyncResult {
  threadId: number;
  messagesSynced: number;
}

export async function quickMessageSync(
  queryClient: QueryClient,
  db: DatabaseService,
  threadId: number,
  sinceDateMs: number,
): Promise<QuickMessageSyncResult> {
  const daysAgo = Math.round((Date.now() - sinceDateMs) / 86_400_000);
  const conv = db.getConversation(threadId);
  const threadName = conv?.addresses ?? String(threadId);

  debugConsole.narrative(`Syncing thread ${threadId} (${threadName}) — messages since ${daysAgo} days ago`);

  const messages = (await queryClient.query('threads.messages', {
    threadId,
    sinceDate: sinceDateMs,
  })) as MessageFromPhone[];

  let synced = 0;

  for (const msg of messages) {
    const row: MessageRow = {
      _id: msg._id,
      thread_id: msg.thread_id,
      address: msg.address ?? '',
      body: msg.body,
      date: msg.date,
      type: msg.type,
      read: msg.read,
      sub_id: msg.sub_id,
      event: msg.event,
    };

    db.upsertMessage(row);

    // Handle attachments
    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        const attRow: AttachmentRow = {
          part_id: att.part_id,
          message_id: msg._id,
          unique_identifier: String(att.unique_identifier),
          mime_type: att.mime_type,
          filename: att.filename ?? null,
          file_size: null,
          downloaded: 0,
          local_path: null,
          thumbnail_path: null,
        };
        db.upsertAttachment(attRow);
      }
    }

    synced++;
  }

  // Update conversation snippet and has_outgoing if we found newer messages
  if (messages.length > 0) {
    const newest = messages[messages.length - 1]!;
    const convNow = db.getConversation(threadId);
    const hasOutgoing = messages.some((m) => m.type === 2) ? 1 : 0;
    if (convNow && newest.date >= convNow.date) {
      db.upsertConversation({
        ...convNow,
        snippet: newest.body ?? (newest.attachments?.length ? '[Attachment]' : ''),
        date: newest.date,
        has_outgoing: Math.max(convNow.has_outgoing, hasOutgoing),
      });
    } else if (convNow && hasOutgoing && !convNow.has_outgoing) {
      db.upsertConversation({ ...convNow, has_outgoing: 1 });
    }
  }

  debugConsole.narrative(`Thread ${threadId} synced — ${synced} messages`);

  return { threadId, messagesSynced: synced };
}
