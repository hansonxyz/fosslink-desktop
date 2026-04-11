/**
 * Full Thread Sync Operation
 *
 * Syncs the entire message history for a single thread.
 * Uses Option B delete detection: tracks all seen message _ids
 * during the sync, then deletes any local messages not seen
 * (they were deleted on the phone).
 *
 * After completion, marks the thread as fully synced in the DB.
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

export interface FullThreadSyncResult {
  threadId: number;
  messagesSynced: number;
  messagesDeleted: number;
}

export async function fullThreadSync(
  queryClient: QueryClient,
  db: DatabaseService,
  threadId: number,
): Promise<FullThreadSyncResult> {
  const conv = db.getConversation(threadId);
  const threadName = conv?.addresses ?? String(threadId);

  debugConsole.narrative(`Synchronizing full history of thread ${threadId} (${threadName})...`);

  // Query all messages (no date filter)
  const messages = (await queryClient.query('threads.messages', {
    threadId,
  })) as MessageFromPhone[];

  // Track seen IDs for delete detection (Option B)
  const seenIds = new Set<number>();
  let synced = 0;

  for (const msg of messages) {
    seenIds.add(msg._id);

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

  // Delete detection: find local messages not in the phone's result
  const localIds = db.getMessageIdsForThread(threadId);
  const deletedIds: number[] = [];
  for (const localId of localIds) {
    if (!seenIds.has(localId)) {
      deletedIds.push(localId);
    }
  }

  if (deletedIds.length > 0) {
    db.deleteMessagesByIds(deletedIds);
    debugConsole.log('query', 'sync', `Deleted ${deletedIds.length} messages no longer on phone`);
  }

  // Mark thread as fully synced
  db.markThreadFullySynced(threadId);

  debugConsole.narrative(
    `Thread ${threadId} full sync complete — ${synced} messages` +
    (deletedIds.length > 0 ? `, ${deletedIds.length} deleted` : ''),
  );

  return { threadId, messagesSynced: synced, messagesDeleted: deletedIds.length };
}
