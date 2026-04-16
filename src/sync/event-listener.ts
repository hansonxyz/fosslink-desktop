/**
 * Event Listener
 *
 * Processes real-time events from the phone (new messages, deletes,
 * thread deletes, contact changes). Applies them to the database
 * immediately, independent of the sync orchestrator.
 *
 * When a sync operation is in progress, flags affected threads for
 * post-sync resync. When no sync is active, events are the
 * authoritative update — no flagging needed.
 *
 * Currently processes the existing fosslink.sms.event format.
 * Will be updated to fosslink.event in Phase 6.
 */

import type { DatabaseService, MessageRow, AttachmentRow } from '../database/database.js';
import type { ProtocolMessage } from '../network/packet.js';
import { debugConsole } from './debug-console.js';

type NotifyCallback = (method: string, params: Record<string, unknown>) => void;

interface MessageFromEvent {
  _id: number;
  thread_id: number;
  addresses?: Array<{ address?: string }>;
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
  }>;
}

export class EventListener {
  private db: DatabaseService;
  private notify: NotifyCallback;
  private flaggedThreads = new Set<number>();
  private syncActive = false;

  constructor(db: DatabaseService, notify: NotifyCallback) {
    this.db = db;
    this.notify = notify;
  }

  /** Mark sync as active — events will flag threads for post-sync resync. */
  setSyncActive(active: boolean): void {
    this.syncActive = active;
  }

  /** Get and clear the set of thread IDs flagged for resync. */
  getAndClearFlaggedThreads(): number[] {
    const ids = [...this.flaggedThreads];
    this.flaggedThreads.clear();
    return ids;
  }


  /**
   * Handle an incoming fosslink.sms.event packet.
   * Applies to DB immediately and emits IPC notifications.
   */
  handleEvent(msg: ProtocolMessage): void {
    const eventType = msg.body['event'] as string;
    const eventId = msg.body['eventId'] as string | undefined;

    switch (eventType) {
      case 'received':
      case 'sent':
        this.handleNewMessages(msg, eventType);
        break;
      case 'deleted':
        this.handleDeleted(msg);
        break;
      case 'thread_deleted':
        this.handleThreadDeleted(msg);
        break;
      case 'read':
        this.handleRead(msg);
        break;
      default:
        debugConsole.log('transport', 'event', `Unknown event type: ${eventType} (${eventId})`);
    }
  }

  private handleNewMessages(msg: ProtocolMessage, eventType: string): void {
    const messages = msg.body['messages'] as MessageFromEvent[] | undefined;
    if (!messages || messages.length === 0) return;

    const threadIds = new Set<number>();

    for (const m of messages) {
      const address = m.addresses?.[0]?.address ?? '';
      const row: MessageRow = {
        _id: m._id,
        thread_id: m.thread_id,
        address,
        body: m.body,
        date: m.date,
        type: m.type,
        read: m.read,
        sub_id: m.sub_id,
        event: m.event,
      };

      this.db.upsertMessage(row);
      threadIds.add(m.thread_id);

      // Handle attachments
      if (m.attachments && m.attachments.length > 0) {
        for (const att of m.attachments) {
          const attRow: AttachmentRow = {
            part_id: att.part_id,
            message_id: m._id,
            unique_identifier: String(att.unique_identifier),
            mime_type: att.mime_type,
            filename: att.filename ?? null,
            file_size: null,
            downloaded: 0,
            local_path: null,
            thumbnail_path: null,
          };
          this.db.upsertAttachment(attRow);
        }
      }

      // Update conversation snippet if this message is newer
      const conv = this.db.getConversation(m.thread_id);
      if (conv) {
        if (m.date > conv.date) {
          this.db.upsertConversation({
            ...conv,
            snippet: m.body ?? (m.attachments?.length ? '[Attachment]' : ''),
            date: m.date,
            unread_count: eventType === 'received' ? conv.unread_count + 1 : conv.unread_count,
          });
        }
      } else {
        // New thread — create it
        this.db.upsertConversation({
          thread_id: m.thread_id,
          addresses: JSON.stringify([address]),
          snippet: m.body ?? '',
          date: m.date,
          read: eventType === 'received' ? 0 : 1,
          unread_count: eventType === 'received' ? 1 : 0,
          locally_read_at: null,
          has_outgoing: m.type === 2 ? 1 : 0,
          full_sync_complete: 0,
          full_sync_date: 0,
        });
      }
    }

    debugConsole.log('query', 'event',
      `Event: ${messages.length} ${eventType} message(s) in thread(s) ${[...threadIds].join(', ')}`);

    // Flag threads for resync if sync is active
    if (this.syncActive) {
      for (const id of threadIds) {
        this.flaggedThreads.add(id);
      }
    }

    // Notify UI
    for (const threadId of threadIds) {
      this.notify('sms.messages', { threadId, newestDate: messages[messages.length - 1]?.date });
    }
    this.notify('sms.conversations_updated', {});
  }

  private handleDeleted(msg: ProtocolMessage): void {
    const messageIds = msg.body['messageIds'] as number[] | undefined;
    if (!messageIds || messageIds.length === 0) return;

    this.db.deleteMessagesByIds(messageIds);

    debugConsole.log('query', 'event', `Event: ${messageIds.length} message(s) deleted`);

    this.notify('sms.messages', {});
    this.notify('sms.conversations_updated', {});
  }

  private handleThreadDeleted(msg: ProtocolMessage): void {
    const threadId = msg.body['threadId'] as number | undefined;
    if (threadId === undefined) return;

    this.db.deleteConversation(threadId);

    debugConsole.log('query', 'event', `Event: thread ${threadId} deleted`);

    this.notify('sms.conversations_updated', {});
  }

  private handleRead(msg: ProtocolMessage): void {
    const threadId = msg.body['threadId'] as number | undefined;
    if (threadId === undefined) return;

    // Update unread count to 0 for this thread
    const conv = this.db.getConversation(threadId);
    if (conv && conv.unread_count > 0) {
      this.db.upsertConversation({
        ...conv,
        read: 1,
        unread_count: 0,
      });
    }

    debugConsole.log('transport', 'event', `Event: thread ${threadId} marked read on phone`);
  }
}
