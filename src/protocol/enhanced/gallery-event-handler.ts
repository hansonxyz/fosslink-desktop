/**
 * Gallery Event Handler
 *
 * Processes fosslink.gallery.media_event packets pushed by the phone in real-time
 * when new photos or videos are added to the device.
 *
 * Events are acknowledged via fosslink.gallery.media_event_ack (batched with 100ms debounce).
 */

import { createLogger } from '../../utils/logger.js';
import type { Logger } from '../../utils/logger.js';
import type { DeviceConnection } from '../../network/ws-server.js';
import type { ProtocolMessage } from '../../network/packet.js';
import { MSG_GALLERY_MEDIA_EVENT_ACK } from '../../network/packet.js';

export interface GalleryMediaItem {
  path: string;
  filename: string;
  folder: string;
  mtime: number;
  size: number;
  mimeType: string;
  isHidden: boolean;
  kind: 'image' | 'video';
}

export interface GalleryEventHandlerOptions {
  getConnection: () => DeviceConnection | undefined;
}

type ItemsAddedCallback = (items: GalleryMediaItem[]) => void;

/** Debounce window for batching event acks */
const ACK_DEBOUNCE_MS = 100;

export class GalleryEventHandler {
  private getConnection: () => DeviceConnection | undefined;
  private logger: Logger;

  private destroyed = false;
  private pendingAckIds: string[] = [];
  private ackTimer: ReturnType<typeof setTimeout> | undefined;
  private itemsAddedCallbacks: ItemsAddedCallback[] = [];

  constructor(options: GalleryEventHandlerOptions) {
    this.getConnection = options.getConnection;
    this.logger = createLogger('gallery-event-handler');
  }

  /**
   * Handle incoming fosslink.gallery.media_event packet.
   */
  handleEvent(packet: ProtocolMessage, _connection: DeviceConnection): void {
    if (this.destroyed) return;

    const event = packet.body['event'] as string | undefined;
    const eventId = packet.body['eventId'] as string | undefined;

    if (!eventId) {
      this.logger.warn('protocol.gallery-event', 'Received event without eventId, ignoring');
      return;
    }

    this.logger.info('protocol.gallery-event', 'Received gallery event', {
      event: event ?? 'unknown',
      eventId,
    });

    if (event === 'added') {
      const items = packet.body['items'] as unknown[] | undefined;
      if (Array.isArray(items) && items.length > 0) {
        this.logger.info('protocol.gallery-event', 'New media items', {
          count: items.length,
          eventId,
        });
        this.fireItemsAdded(items as GalleryMediaItem[]);
      }
    }

    this.queueAck(eventId);
  }

  /**
   * Register a callback for new media items.
   */
  onItemsAdded(cb: ItemsAddedCallback): void {
    this.itemsAddedCallbacks.push(cb);
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.destroyed = true;
    this.flushAcks();
    this.clearPendingAcks();
    this.itemsAddedCallbacks = [];
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
      this.logger.warn('protocol.gallery-event', 'Cannot send event_ack: not connected', {
        eventIds,
      });
      return;
    }

    conn.send(MSG_GALLERY_MEDIA_EVENT_ACK, { eventIds });

    this.logger.debug('protocol.gallery-event', 'Sent gallery event_ack', {
      count: eventIds.length,
      eventIds,
    });
  }

  private fireItemsAdded(items: GalleryMediaItem[]): void {
    for (const cb of this.itemsAddedCallbacks) {
      cb(items);
    }
  }
}
