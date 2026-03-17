/**
 * Notification Protocol Handler
 *
 * Handles incoming phone notifications. Notifications can be:
 * - New notification: upsert to DB, fire onNotificationReceived
 * - Cancelled notification: delete from DB, fire onNotificationDismissed
 *
 * Packet body fields:
 * - id: string — notification identifier
 * - appName: string — source app
 * - ticker: string — brief text
 * - title: string — notification title
 * - text: string — notification body
 * - time: string/number — timestamp
 * - isClearable: boolean — can be dismissed
 * - isCancel: boolean — this is a cancellation
 * - silent: boolean — silent notification
 */

import { createLogger } from '../../utils/logger.js';
import type { Logger } from '../../utils/logger.js';
import type { ProtocolMessage } from '../../network/packet.js';
import type { DeviceConnection } from '../../network/ws-server.js';
import type { DatabaseService, NotificationRow } from '../../database/database.js';

export interface NotificationHandlerOptions {
  db: DatabaseService;
}

type NotificationReceivedCallback = (notif: NotificationRow) => void;
type NotificationDismissedCallback = (id: string) => void;

export class NotificationHandler {
  private db: DatabaseService;
  private logger: Logger;
  private receivedCallbacks: NotificationReceivedCallback[] = [];
  private dismissedCallbacks: NotificationDismissedCallback[] = [];

  constructor(options: NotificationHandlerOptions) {
    this.db = options.db;
    this.logger = createLogger('notification-handler');
  }

  /**
   * Handle incoming notification packet.
   */
  handleNotification(packet: ProtocolMessage, _connection: DeviceConnection): void {
    const body = packet.body;
    const id = body['id'] as string | undefined;

    if (!id) {
      this.logger.warn('protocol.notification', 'Notification packet missing id');
      return;
    }

    // Cancellation — remove notification
    if (body['isCancel'] === true) {
      this.db.deleteNotification(id);
      this.logger.debug('protocol.notification', 'Notification dismissed', { id });
      this.fireDismissed(id);
      return;
    }

    const appName = (body['appName'] as string) ?? '';
    const title = (body['title'] as string) ?? '';
    const text = (body['text'] as string) ?? (body['ticker'] as string) ?? '';
    const time = typeof body['time'] === 'number'
      ? body['time']
      : (typeof body['time'] === 'string' ? parseInt(body['time'], 10) : Date.now());
    const dismissable = body['isClearable'] === true ? 1 : 0;
    const silent = body['silent'] === true ? 1 : 0;

    const row: NotificationRow = {
      id,
      app_name: appName,
      title,
      text,
      time: isNaN(time) ? Date.now() : time,
      dismissable,
      silent,
    };

    this.db.upsertNotification(row);
    this.logger.info('protocol.notification', 'Notification received', {
      id,
      appName,
      title: title.substring(0, 50),
    });

    this.fireReceived(row);
  }

  // --- Callbacks ---

  onNotificationReceived(cb: NotificationReceivedCallback): void {
    this.receivedCallbacks.push(cb);
  }

  onNotificationDismissed(cb: NotificationDismissedCallback): void {
    this.dismissedCallbacks.push(cb);
  }

  private fireReceived(notif: NotificationRow): void {
    for (const cb of this.receivedCallbacks) {
      cb(notif);
    }
  }

  private fireDismissed(id: string): void {
    for (const cb of this.dismissedCallbacks) {
      cb(id);
    }
  }
}
