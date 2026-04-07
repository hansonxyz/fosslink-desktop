/**
 * Filesystem Watch Event Handler
 *
 * Processes fosslink.fs.watch_event packets pushed by the phone in real-time
 * when files are created, deleted, or modified in watched directories.
 *
 * Events are acknowledged via fosslink.fs.watch_event_ack (batched with 100ms debounce).
 */

import { createLogger } from '../../utils/logger.js';
import type { Logger } from '../../utils/logger.js';
import type { DeviceConnection } from '../../network/ws-server.js';
import type { ProtocolMessage } from '../../network/packet.js';
import { MSG_FS_WATCH_EVENT_ACK } from '../../network/packet.js';

export interface FsWatchEvent {
  eventId: string;
  watchPath: string;
  path: string;
  filename: string;
  event: 'created' | 'deleted' | 'modified';
  isDir: boolean;
  size: number;
  mtime: number;
}

export interface FsWatchEventHandlerOptions {
  getConnection: () => DeviceConnection | undefined;
}

type WatchEventCallback = (event: FsWatchEvent) => void;

/** Debounce window for batching event acks */
const ACK_DEBOUNCE_MS = 100;

export class FsWatchEventHandler {
  private getConnection: () => DeviceConnection | undefined;
  private logger: Logger;

  private destroyed = false;
  private pendingAckIds: string[] = [];
  private ackTimer: ReturnType<typeof setTimeout> | undefined;
  private eventCallbacks: WatchEventCallback[] = [];

  constructor(options: FsWatchEventHandlerOptions) {
    this.getConnection = options.getConnection;
    this.logger = createLogger('fs-watch-event-handler');
  }

  /**
   * Handle incoming fosslink.fs.watch_event packet.
   */
  handleEvent(packet: ProtocolMessage, _connection: DeviceConnection): void {
    if (this.destroyed) return;

    const eventId = packet.body['eventId'] as string | undefined;
    if (!eventId) {
      this.logger.warn('protocol.fs-watch', 'Received watch event without eventId, ignoring');
      return;
    }

    const watchEvent: FsWatchEvent = {
      eventId,
      watchPath: packet.body['watchPath'] as string,
      path: packet.body['path'] as string,
      filename: packet.body['filename'] as string,
      event: packet.body['event'] as FsWatchEvent['event'],
      isDir: packet.body['isDir'] === true,
      size: (packet.body['size'] as number) ?? 0,
      mtime: (packet.body['mtime'] as number) ?? 0,
    };

    this.logger.debug('protocol.fs-watch', 'Received watch event', {
      event: watchEvent.event,
      path: watchEvent.path,
      watchPath: watchEvent.watchPath,
    });

    this.fireEvent(watchEvent);
    this.queueAck(eventId);
  }

  /**
   * Register a callback for filesystem watch events.
   */
  onEvent(cb: WatchEventCallback): void {
    this.eventCallbacks.push(cb);
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.destroyed = true;
    this.flushAcks();
    this.clearPendingAcks();
    this.eventCallbacks = [];
  }

  clearPendingAcks(): void {
    this.pendingAckIds = [];
    if (this.ackTimer) {
      clearTimeout(this.ackTimer);
      this.ackTimer = undefined;
    }
  }

  // --- Ack batching ---

  private queueAck(eventId: string): void {
    this.pendingAckIds.push(eventId);

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
      this.logger.warn('protocol.fs-watch', 'Cannot send watch_event_ack: not connected', {
        eventIds,
      });
      return;
    }

    conn.send(MSG_FS_WATCH_EVENT_ACK, { eventIds });

    this.logger.debug('protocol.fs-watch', 'Sent watch_event_ack', {
      count: eventIds.length,
    });
  }

  private fireEvent(event: FsWatchEvent): void {
    for (const cb of this.eventCallbacks) {
      cb(event);
    }
  }
}
