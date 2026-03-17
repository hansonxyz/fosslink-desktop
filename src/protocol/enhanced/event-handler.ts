/**
 * Real-Time Event Handler
 *
 * Processes fosslink.sms.event packets pushed by the phone in real-time.
 *
 * Message events (received/sent):
 * 1. Phone detects new message via ContentObserver
 * 2. Phone sends fosslink.sms.event { event, eventId, messages[] }
 * 3. Desktop processes messages via SmsHandler.handleMessages() (idempotent upsert)
 *
 * State events (read/deleted/thread_deleted):
 * 1. Phone detects state change via ContentObserver diffing
 * 2. Phone sends fosslink.sms.event { event, eventId, threadId/messageIds }
 * 3. Desktop updates local DB accordingly
 *
 * All events are acknowledged via fosslink.sms.event_ack (batched with 100ms debounce).
 */

import { createLogger } from '../../utils/logger.js';
import type { Logger } from '../../utils/logger.js';
import type { SmsHandler } from '../standard/sms-handler.js';
import type { DatabaseService } from '../../database/database.js';
import type { DeviceConnection } from '../../network/ws-server.js';
import type { ProtocolMessage } from '../../network/packet.js';
import {
  MSG_EVENT_ACK,
} from '../../network/packet.js';

export interface EventHandlerOptions {
  smsHandler: SmsHandler;
  db: DatabaseService;
  getConnection: () => DeviceConnection | undefined;
}

export interface EventInfo {
  type: string;
  eventId: string;
  threadId: number;
  messageCount: number;
}

type EventCallback = (event: EventInfo) => void;

/** Debounce window for batching event acks */
const ACK_DEBOUNCE_MS = 100;

export class EventHandler {
  private smsHandler: SmsHandler;
  private db: DatabaseService;
  private getConnection: () => DeviceConnection | undefined;
  private logger: Logger;

  private destroyed = false;
  private pendingAckIds: string[] = [];
  private ackTimer: ReturnType<typeof setTimeout> | undefined;
  private eventCallbacks: EventCallback[] = [];

  constructor(options: EventHandlerOptions) {
    this.smsHandler = options.smsHandler;
    this.db = options.db;
    this.getConnection = options.getConnection;
    this.logger = createLogger('event-handler');
  }

  /**
   * Handle incoming fosslink.sms.event packet.
   * Routes to message handler or state handler based on event type.
   */
  handleEvent(packet: ProtocolMessage, connection: DeviceConnection): void {
    if (this.destroyed) return;

    const event = packet.body['event'] as string | undefined;
    const eventId = packet.body['eventId'] as string | undefined;

    if (!eventId) {
      this.logger.warn('protocol.event', 'Received event without eventId, ignoring');
      return;
    }

    this.logger.info('protocol.event', 'Received event', {
      event: event ?? 'unknown',
      eventId,
    });

    // Route based on event type
    if (event === 'read') {
      this.handleReadEvent(packet, eventId);
    } else if (event === 'deleted') {
      this.handleDeletedEvent(packet, eventId);
    } else if (event === 'thread_deleted') {
      this.handleThreadDeletedEvent(packet, eventId);
    } else {
      // Message events (received/sent) — existing behavior
      this.handleMessageEvent(packet, connection, event, eventId);
    }

    // Queue ack (batched)
    this.queueAck(eventId);
  }

  /**
   * Register a callback for received events.
   */
  onEventReceived(cb: EventCallback): void {
    this.eventCallbacks.push(cb);
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.destroyed = true;
    this.flushAcks();
    if (this.ackTimer) {
      clearTimeout(this.ackTimer);
      this.ackTimer = undefined;
    }
    this.eventCallbacks = [];
  }

  // --- Event type handlers ---

  private handleMessageEvent(
    packet: ProtocolMessage,
    connection: DeviceConnection,
    event: string | undefined,
    eventId: string,
  ): void {
    const messages = packet.body['messages'] as unknown[] | undefined;

    if (!Array.isArray(messages)) {
      this.logger.warn('protocol.event', 'Received event without messages array', { eventId });
      return;
    }

    this.logger.info('protocol.event', 'Processing message event', {
      event: event ?? 'unknown',
      eventId,
      messageCount: messages.length,
    });

    // Delegate message processing to the standard SMS handler (idempotent upsert)
    if (messages.length > 0) {
      this.smsHandler.handleMessages(
        { ...packet, body: { messages } },
        connection,
      );
    }

    // Determine the primary threadId from the first message
    const firstMsg = messages[0] as Record<string, unknown> | undefined;
    const threadId = (firstMsg?.['thread_id'] as number) ?? 0;

    this.fireEventReceived({
      type: event ?? 'unknown',
      eventId,
      threadId,
      messageCount: messages.length,
    });
  }

  private handleReadEvent(packet: ProtocolMessage, eventId: string): void {
    const threadId = packet.body['threadId'] as number | undefined;
    if (threadId === undefined) {
      this.logger.warn('protocol.event', 'Read event missing threadId', { eventId });
      return;
    }

    this.db.markThreadLocallyRead(threadId);
    this.logger.info('protocol.event', 'Thread marked as read from phone', { threadId, eventId });

    this.fireEventReceived({ type: 'read', eventId, threadId, messageCount: 0 });
  }

  private handleDeletedEvent(packet: ProtocolMessage, eventId: string): void {
    const messageIds = packet.body['messageIds'] as number[] | undefined;
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      this.logger.warn('protocol.event', 'Deleted event missing messageIds', { eventId });
      return;
    }

    for (const messageId of messageIds) {
      this.smsHandler.deleteMessage(messageId);
    }
    this.logger.info('protocol.event', 'Messages deleted from phone', {
      count: messageIds.length,
      messageIds,
      eventId,
    });

    this.fireEventReceived({ type: 'deleted', eventId, threadId: 0, messageCount: messageIds.length });
  }

  private handleThreadDeletedEvent(packet: ProtocolMessage, eventId: string): void {
    const threadId = packet.body['threadId'] as number | undefined;
    if (threadId === undefined) {
      this.logger.warn('protocol.event', 'Thread deleted event missing threadId', { eventId });
      return;
    }

    this.smsHandler.deleteConversation(threadId);
    this.logger.info('protocol.event', 'Thread deleted from phone', { threadId, eventId });

    this.fireEventReceived({ type: 'thread_deleted', eventId, threadId, messageCount: 0 });
  }

  // --- Ack batching ---

  private queueAck(eventId: string): void {
    this.pendingAckIds.push(eventId);

    // Reset debounce timer
    if (this.ackTimer) {
      clearTimeout(this.ackTimer);
    }

    this.ackTimer = setTimeout(() => {
      this.flushAcks();
    }, ACK_DEBOUNCE_MS);
  }

  private flushAcks(): void {
    if (this.pendingAckIds.length === 0) return;

    const eventIds = [...this.pendingAckIds];
    this.pendingAckIds = [];

    const conn = this.getConnection();
    if (!conn) {
      this.logger.warn('protocol.event', 'Cannot send event_ack: not connected', {
        eventIds,
      });
      return;
    }

    conn.send(MSG_EVENT_ACK, { eventIds });

    this.logger.debug('protocol.event', 'Sent event_ack', {
      count: eventIds.length,
      eventIds,
    });
  }

  private fireEventReceived(event: EventInfo): void {
    for (const cb of this.eventCallbacks) {
      cb(event);
    }
  }
}
