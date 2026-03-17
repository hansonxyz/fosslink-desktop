import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { NotificationHandler } from '../../../src/protocol/standard/notification-handler.js';
import { DatabaseService } from '../../../src/database/database.js';
import type { NotificationRow } from '../../../src/database/database.js';
import type { ProtocolMessage } from '../../../src/network/packet.js';
import type { DeviceConnection } from '../../../src/network/ws-server.js';
import { initializeLogger, resetLogger } from '../../../src/utils/logger.js';

function createMockConnection(): DeviceConnection {
  return {
    deviceId: 'test-device-id-12345678901234567890',
    deviceName: 'Test Phone',
    ws: {} as any,
    connected: true,
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as DeviceConnection;
}

describe('NotificationHandler', () => {
  let tmpDir: string;
  let db: DatabaseService;
  let connection: DeviceConnection;
  let handler: NotificationHandler;

  beforeEach(() => {
    initializeLogger({ level: 'error', pretty: false });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notif-handler-test-'));
    db = new DatabaseService(path.join(tmpDir, 'test.db'));
    db.open();
    connection = createMockConnection();
    handler = new NotificationHandler({ db });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    resetLogger();
  });

  describe('handleNotification', () => {
    it('should persist a new notification', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.notification',
        body: {
          id: 'notif-1',
          appName: 'Messages',
          title: 'New Message',
          text: 'Hello from phone',
          time: 1700000000000,
          isClearable: true,
          silent: false,
        },
      };

      handler.handleNotification(packet, connection);

      const notifs = db.getRecentNotifications(10);
      expect(notifs).toHaveLength(1);
      expect(notifs[0]!.id).toBe('notif-1');
      expect(notifs[0]!.app_name).toBe('Messages');
      expect(notifs[0]!.title).toBe('New Message');
      expect(notifs[0]!.text).toBe('Hello from phone');
      expect(notifs[0]!.dismissable).toBe(1);
      expect(notifs[0]!.silent).toBe(0);
    });

    it('should handle cancellation (isCancel=true)', () => {
      // First, add a notification
      const addPacket: ProtocolMessage = {
        type: 'fosslink.notification',
        body: { id: 'notif-1', appName: 'App', title: 'Test', text: 'Test', time: 1700000000000 },
      };
      handler.handleNotification(addPacket, connection);
      expect(db.getRecentNotifications(10)).toHaveLength(1);

      // Cancel it
      const cancelPacket: ProtocolMessage = {
        type: 'fosslink.notification',
        body: { id: 'notif-1', isCancel: true },
      };
      handler.handleNotification(cancelPacket, connection);
      expect(db.getRecentNotifications(10)).toHaveLength(0);
    });

    it('should handle silent notification', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.notification',
        body: {
          id: 'notif-1',
          appName: 'System',
          title: 'Background',
          text: 'Silent update',
          time: 1700000000000,
          silent: true,
        },
      };

      handler.handleNotification(packet, connection);

      const notifs = db.getRecentNotifications(10);
      expect(notifs).toHaveLength(1);
      expect(notifs[0]!.silent).toBe(1);
    });

    it('should handle missing optional fields', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.notification',
        body: {
          id: 'notif-1',
          time: 1700000000000,
        },
      };

      handler.handleNotification(packet, connection);

      const notifs = db.getRecentNotifications(10);
      expect(notifs).toHaveLength(1);
      expect(notifs[0]!.app_name).toBe('');
      expect(notifs[0]!.title).toBe('');
      expect(notifs[0]!.text).toBe('');
    });

    it('should use ticker as fallback for text', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.notification',
        body: {
          id: 'notif-1',
          appName: 'App',
          ticker: 'Ticker text here',
          time: 1700000000000,
        },
      };

      handler.handleNotification(packet, connection);

      const notifs = db.getRecentNotifications(10);
      expect(notifs[0]!.text).toBe('Ticker text here');
    });

    it('should handle string time field', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.notification',
        body: {
          id: 'notif-1',
          appName: 'App',
          time: '1700000000000',
        },
      };

      handler.handleNotification(packet, connection);

      const notifs = db.getRecentNotifications(10);
      expect(notifs[0]!.time).toBe(1700000000000);
    });

    it('should ignore packets without id', () => {
      const packet: ProtocolMessage = {
        type: 'fosslink.notification',
        body: { appName: 'App', title: 'No ID' },
      };

      handler.handleNotification(packet, connection);
      expect(db.getRecentNotifications(10)).toHaveLength(0);
    });

    it('should update existing notification on re-upsert', () => {
      const packet1: ProtocolMessage = {
        type: 'fosslink.notification',
        body: { id: 'notif-1', appName: 'App', title: 'Original', time: 1700000000000 },
      };
      handler.handleNotification(packet1, connection);
      expect(db.getRecentNotifications(10)[0]!.title).toBe('Original');

      const packet2: ProtocolMessage = {
        type: 'fosslink.notification',
        body: { id: 'notif-1', appName: 'App', title: 'Updated', time: 1700000001000 },
      };
      handler.handleNotification(packet2, connection);

      const notifs = db.getRecentNotifications(10);
      expect(notifs).toHaveLength(1);
      expect(notifs[0]!.title).toBe('Updated');
    });
  });

  describe('callbacks', () => {
    it('should fire onNotificationReceived', () => {
      let received: NotificationRow | undefined;
      handler.onNotificationReceived((notif) => { received = notif; });

      const packet: ProtocolMessage = {
        type: 'fosslink.notification',
        body: { id: 'notif-1', appName: 'App', title: 'Test', text: 'Body', time: 1700000000000 },
      };

      handler.handleNotification(packet, connection);

      expect(received).toBeDefined();
      expect(received!.id).toBe('notif-1');
      expect(received!.title).toBe('Test');
    });

    it('should fire onNotificationDismissed for cancellations', () => {
      let dismissedId: string | undefined;
      handler.onNotificationDismissed((id) => { dismissedId = id; });

      // Add then cancel
      handler.handleNotification({
        type: 'fosslink.notification',
        body: { id: 'notif-1', appName: 'App', title: 'Test', time: 1700000000000 },
      }, connection);

      handler.handleNotification({
        type: 'fosslink.notification',
        body: { id: 'notif-1', isCancel: true },
      }, connection);

      expect(dismissedId).toBe('notif-1');
    });

    it('should not fire onNotificationReceived for cancellations', () => {
      let receivedCount = 0;
      handler.onNotificationReceived(() => { receivedCount++; });

      // Add one notification
      handler.handleNotification({
        type: 'fosslink.notification',
        body: { id: 'notif-1', appName: 'App', title: 'Test', time: 1700000000000 },
      }, connection);
      expect(receivedCount).toBe(1);

      // Cancel — should not fire received
      handler.handleNotification({
        type: 'fosslink.notification',
        body: { id: 'notif-1', isCancel: true },
      }, connection);
      expect(receivedCount).toBe(1);
    });
  });
});
