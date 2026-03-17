/**
 * IPC Method Handlers
 *
 * Maps JSON-RPC method names to daemon operations. Registers both
 * request handlers (client → daemon) and notification wiring
 * (daemon events → broadcast to all clients).
 *
 * Provides reusable createMethodMap() and wireNotifications() for
 * both IPC server mode (standalone daemon) and embedded mode (Electron).
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createLogger } from '../utils/logger.js';
import { IpcServer } from './server.js';
import { createNotification } from './json-rpc.js';
import type { Daemon } from '../core/daemon.js';
import type { OutgoingAttachment } from '../protocol/standard/sms-handler.js';
import {
  loadKnownDevices,
  saveKnownDevice,
  removeKnownDevice,
} from '../config/known-devices.js';
import {
  MSG_FINDMYPHONE,
  MSG_DIAL,
  MSG_URL_SHARE,
  MSG_OPEN_APP_STORE,
} from '../network/packet.js';
import { getContactPhotosDir, getAttachmentsDir } from '../utils/paths.js';

const log = createLogger('ipc-handlers');

export type MethodHandler = (params?: Record<string, unknown>) => Promise<unknown>;
export type NotificationEmitter = (method: string, params: Record<string, unknown>) => void;

/**
 * Create a map of method name → handler function.
 * Used by both IPC server (standalone) and DaemonBridge (embedded).
 */
export function createMethodMap(daemon: Daemon): Map<string, MethodHandler> {
  const methods = new Map<string, MethodHandler>();

  methods.set('daemon.status', async () => {
    return daemon.getStatus();
  });

  methods.set('daemon.stop', async () => {
    // Defer stop so the caller gets a response first
    setTimeout(() => { void daemon.stop(); }, 100);
    return { ok: true };
  });

  methods.set('state.get', async () => {
    return { state: daemon.getStateMachine().getState() };
  });

  methods.set('state.context', async () => {
    return daemon.getStateMachine().getContext();
  });

  methods.set('state.history', async (params) => {
    const limit = (params?.['limit'] as number | undefined) ?? undefined;
    return daemon.getStateMachine().getHistory(limit);
  });

  methods.set('devices.discovered', async () => {
    const devices = daemon.getDiscoveryService().getDiscoveredDevices();
    return Array.from(devices.values());
  });

  methods.set('devices.paired', async () => {
    return daemon.getPairingHandler().loadTrustedDevices();
  });

  methods.set('devices.connected', async () => {
    return daemon.getWsServer().getConnectedDevices();
  });

  methods.set('devices.connect', async (params) => {
    const address = params?.['address'] as string | undefined;
    if (!address) {
      throw new Error('Missing required parameter: address');
    }
    const port = (params?.['port'] as number | undefined) ?? 1716;

    const discoveryService = daemon.getDiscoveryService();
    const wsServer = daemon.getWsServer();

    // Send connect request so the phone connects back to our WebSocket server
    discoveryService.sendConnectRequest(address, port);

    // Wait for a connection to establish (up to 10 seconds)
    const result = await new Promise<{ deviceId: string; deviceName: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection to ${address}:${port} timed out — phone did not connect back`));
      }, 10000);

      const onConnect = (conn: { deviceId: string; deviceName: string }) => {
        clearTimeout(timeout);
        resolve({ deviceId: conn.deviceId, deviceName: conn.deviceName });
      };

      wsServer.onConnection(onConnect);
    });

    // Save to known devices
    saveKnownDevice({
      deviceId: result.deviceId,
      deviceName: result.deviceName,
      address,
      port,
    });

    return result;
  });

  methods.set('devices.known', async () => {
    return loadKnownDevices();
  });

  methods.set('devices.forget', async (params) => {
    const deviceId = params?.['deviceId'] as string | undefined;
    if (!deviceId) {
      throw new Error('Missing required parameter: deviceId');
    }
    removeKnownDevice(deviceId);
    return { ok: true };
  });

  methods.set('pair.request', async (params) => {
    const deviceId = params?.['deviceId'] as string | undefined;
    if (!deviceId) {
      throw new Error('Missing required parameter: deviceId');
    }

    const wsServer = daemon.getWsServer();
    const pairingHandler = daemon.getPairingHandler();

    // Check if already connected
    const connection = wsServer.getConnection(deviceId);

    if (connection) {
      return pairingHandler.requestPairing(connection);
    }

    // Not connected — find in discovered devices and trigger connection
    const discoveryService = daemon.getDiscoveryService();
    const discovered = discoveryService.getDiscoveredDevices().get(deviceId);

    if (!discovered) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    // Send directed discovery to trigger phone to connect to us
    const result = await new Promise<{ verificationKey: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection to device ${deviceId} timed out`));
      }, 10000);

      wsServer.onConnection((conn) => {
        if (conn.deviceId === deviceId) {
          clearTimeout(timeout);
          try {
            const pairResult = pairingHandler.requestPairing(conn);
            resolve(pairResult);
          } catch (err) {
            reject(err);
          }
        }
      });

      discoveryService.sendConnectRequest(discovered.address);
    });

    return result;
  });

  methods.set('pair.pending', async () => {
    return daemon.getPairingHandler().getPendingIncoming();
  });

  methods.set('pair.accept', async (params) => {
    const deviceId = params?.['deviceId'] as string | undefined;
    if (!deviceId) {
      throw new Error('Missing required parameter: deviceId');
    }

    daemon.getPairingHandler().acceptIncomingPairing(deviceId);
    return { ok: true };
  });

  methods.set('pair.reject', async (params) => {
    const deviceId = params?.['deviceId'] as string | undefined;
    if (!deviceId) {
      throw new Error('Missing required parameter: deviceId');
    }

    daemon.getPairingHandler().rejectIncomingPairing(deviceId);
    return { ok: true };
  });

  methods.set('pair.unpair', async (params) => {
    const deviceId = params?.['deviceId'] as string | undefined;
    if (!deviceId) {
      throw new Error('Missing required parameter: deviceId');
    }

    const wsServer = daemon.getWsServer();
    const pairingHandler = daemon.getPairingHandler();
    const connection = wsServer.getConnection(deviceId);

    pairingHandler.unpair(deviceId, connection);
    removeKnownDevice(deviceId);
    return { ok: true };
  });

  // --- SMS methods ---

  methods.set('sms.conversations', async () => {
    return daemon.getDatabaseService().getAllConversations();
  });

  methods.set('sms.messages', async (params) => {
    const threadId = params?.['threadId'] as number | undefined;
    if (threadId === undefined) {
      throw new Error('Missing required parameter: threadId');
    }
    return daemon.getDatabaseService().getThreadMessages(threadId);
  });

  methods.set('sms.request_thread', async (params) => {
    const threadId = params?.['threadId'] as number | undefined;
    if (threadId === undefined) {
      throw new Error('Missing required parameter: threadId');
    }
    const rangeStartTimestamp = params?.['rangeStartTimestamp'] as number | undefined;
    daemon.getSmsHandler().requestConversation(threadId, rangeStartTimestamp);
    return { ok: true };
  });

  methods.set('sms.send', async (params) => {
    const address = params?.['address'] as string | undefined;
    const body = params?.['body'] as string | undefined;
    const attachmentPaths = params?.['attachments'] as Array<{
      filePath: string;
      fileName: string;
      mimeType: string;
    }> | undefined;

    if (!address) {
      throw new Error('Missing required parameter: address');
    }
    if (!body && (!attachmentPaths || attachmentPaths.length === 0)) {
      throw new Error('Message must have body text or attachments');
    }

    let outgoingAttachments: OutgoingAttachment[] = [];
    if (attachmentPaths && attachmentPaths.length > 0) {
      outgoingAttachments = await Promise.all(
        attachmentPaths.map(async (att) => {
          const fileBuffer = await readFile(att.filePath);
          return {
            fileName: att.fileName,
            base64EncodedFile: fileBuffer.toString('base64'),
            mimeType: att.mimeType,
          };
        }),
      );
    }

    const queueId = daemon.getSmsHandler().queueMessage(address, body ?? '', outgoingAttachments);
    return { queueId };
  });

  methods.set('sms.cancel_send', async (params) => {
    const queueId = params?.['queueId'] as string | undefined;
    if (!queueId) {
      throw new Error('Missing required parameter: queueId');
    }
    const cancelled = daemon.getSmsHandler().cancelSend(queueId);
    return { cancelled };
  });

  methods.set('sms.request_sync', async () => {
    daemon.startSync();
    return { ok: true };
  });

  methods.set('sms.mark_thread_read', async (params) => {
    const threadId = params?.['threadId'] as number | undefined;
    if (threadId === undefined) {
      throw new Error('Missing required parameter: threadId');
    }
    daemon.getDatabaseService().markThreadLocallyRead(threadId);
    // Sync to phone if root enabled
    const ctx = daemon.getStateMachine().getContext();
    if (ctx.peerRootEnabled) {
      daemon.getSmsHandler().markReadOnPhone(threadId);
    }
    return { ok: true };
  });

  methods.set('sms.thread_attachments', async (params) => {
    const threadId = params?.['threadId'] as number | undefined;
    if (threadId === undefined) {
      throw new Error('Missing required parameter: threadId');
    }
    return daemon.getDatabaseService().getAttachmentsForThread(threadId);
  });

  methods.set('sms.attachment_path', async (params) => {
    const partId = params?.['partId'] as number | undefined;
    const messageId = params?.['messageId'] as number | undefined;
    if (partId === undefined || messageId === undefined) {
      throw new Error('Missing required parameters: partId, messageId');
    }
    const att = daemon.getDatabaseService().getAttachment(partId, messageId);
    if (!att || !att.local_path) return null;
    return { localPath: att.local_path, mimeType: att.mime_type };
  });

  methods.set('sms.attachment_thumbnail_path', async (params) => {
    const partId = params?.['partId'] as number | undefined;
    const messageId = params?.['messageId'] as number | undefined;
    if (partId === undefined || messageId === undefined) {
      throw new Error('Missing required parameters: partId, messageId');
    }
    const att = daemon.getDatabaseService().getAttachment(partId, messageId);
    if (!att || !att.thumbnail_path) return null;
    return { thumbnailPath: att.thumbnail_path, mimeType: 'image/webp' };
  });

  methods.set('sms.get_attachment', async (params) => {
    const partId = params?.['partId'] as number | undefined;
    const messageId = params?.['messageId'] as number | undefined;
    if (messageId === undefined) {
      throw new Error('Missing required parameter: messageId');
    }

    log.info('ipc.attachment', 'sms.get_attachment called', { partId, messageId });

    // If partId provided, download specific attachment
    if (partId !== undefined) {
      const localPath = await daemon.getSmsHandler().downloadAttachment(partId, messageId);
      const att = daemon.getDatabaseService().getAttachment(partId, messageId);
      log.info('ipc.attachment', 'sms.get_attachment completed', { partId, messageId, localPath });
      return {
        attachments: [{
          partId,
          localPath,
          mimeType: att?.mime_type ?? 'application/octet-stream',
          fileSize: att?.file_size ?? null,
        }],
      };
    }

    // No partId: download all attachments for the message
    const attachments = daemon.getDatabaseService().getAttachmentsForMessage(messageId);
    if (attachments.length === 0) {
      throw new Error(`No attachments found for message ${messageId}`);
    }

    log.info('ipc.attachment', 'Downloading all attachments for message', { messageId, count: attachments.length });
    const results = [];
    for (const att of attachments) {
      const localPath = await daemon.getSmsHandler().downloadAttachment(att.part_id, messageId);
      const updated = daemon.getDatabaseService().getAttachment(att.part_id, messageId);
      results.push({
        partId: att.part_id,
        localPath,
        mimeType: updated?.mime_type ?? att.mime_type,
        fileSize: updated?.file_size ?? att.file_size ?? null,
      });
    }
    log.info('ipc.attachment', 'sms.get_attachment completed (all)', { messageId, count: results.length });
    return { attachments: results };
  });

  methods.set('sms.delete_message', async (params) => {
    const messageId = params?.['messageId'] as number | undefined;
    if (messageId === undefined) {
      throw new Error('Missing required parameter: messageId');
    }
    daemon.getSmsHandler().deleteMessage(messageId);
    // Sync to phone if root enabled
    const ctx = daemon.getStateMachine().getContext();
    if (ctx.peerRootEnabled) {
      daemon.getSmsHandler().deleteOnPhone(messageId);
    }
    return { deleted: true };
  });

  methods.set('sms.delete_conversation', async (params) => {
    const threadId = params?.['threadId'] as number | undefined;
    if (threadId === undefined) {
      throw new Error('Missing required parameter: threadId');
    }
    daemon.getSmsHandler().deleteConversation(threadId);
    // Sync to phone if root enabled
    const ctx = daemon.getStateMachine().getContext();
    if (ctx.peerRootEnabled) {
      daemon.getSmsHandler().deleteThreadOnPhone(threadId);
    }
    return { deleted: true };
  });

  // --- Contacts methods ---

  methods.set('contacts.list', async () => {
    return daemon.getDatabaseService().getAllContacts();
  });

  methods.set('contacts.search', async (params) => {
    const query = params?.['query'] as string | undefined;
    if (!query) {
      throw new Error('Missing required parameter: query');
    }
    const all = daemon.getDatabaseService().getAllContacts();
    const lower = query.toLowerCase();
    return all.filter((c) => c.name.toLowerCase().includes(lower));
  });

  methods.set('contacts.photo_path', async (params) => {
    const uid = params?.['uid'] as string | undefined;
    if (!uid) {
      throw new Error('Missing required parameter: uid');
    }
    const contact = daemon.getDatabaseService().getContact(uid);
    if (!contact || !contact.photo_path) return null;
    return {
      localPath: path.join(getContactPhotosDir(), contact.photo_path),
      mimeType: contact.photo_mime ?? 'image/jpeg',
    };
  });

  // --- Notifications methods ---

  methods.set('notifications.list', async (params) => {
    const limit = (params?.['limit'] as number | undefined) ?? 50;
    return daemon.getDatabaseService().getRecentNotifications(limit);
  });

  // --- Find My Phone ---

  methods.set('phone.ring', async () => {
    const devices = daemon.getWsServer().getConnectedDevices();
    if (devices.length === 0) {
      throw new Error('No device connected');
    }
    const conn = daemon.getWsServer().getConnection(devices[0]!.deviceId);
    if (!conn) {
      throw new Error('No device connected');
    }
    conn.send(MSG_FINDMYPHONE, {});
    return { ok: true };
  });

  // --- Dial Phone Number ---

  methods.set('phone.dial', async (params) => {
    const phoneNumber = params?.['phoneNumber'] as string | undefined;
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new Error('Missing required parameter: phoneNumber');
    }
    const devices = daemon.getWsServer().getConnectedDevices();
    if (devices.length === 0) {
      throw new Error('No device connected');
    }
    const conn = daemon.getWsServer().getConnection(devices[0]!.deviceId);
    if (!conn) {
      throw new Error('No device connected');
    }
    conn.send(MSG_DIAL, { phoneNumber });
    log.info('ipc.dial', 'Sent dial request to phone', { phoneNumber });
    return { ok: true };
  });

  // --- Battery ---

  methods.set('device.battery', async () => {
    return daemon.getBattery();
  });

  // --- URL Sharing ---

  methods.set('url.share', async (params) => {
    const url = params?.['url'] as string | undefined;
    if (!url || typeof url !== 'string') {
      throw new Error('Missing required parameter: url');
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('URL must start with http:// or https://');
    }
    const devices = daemon.getWsServer().getConnectedDevices();
    if (devices.length === 0) {
      throw new Error('No device connected');
    }
    const conn = daemon.getWsServer().getConnection(devices[0]!.deviceId);
    if (!conn) {
      throw new Error('No device connected');
    }
    conn.send(MSG_URL_SHARE, { url });
    log.info('ipc.url', 'Shared URL to phone', { url });
    return { ok: true };
  });

  // --- Open App Store (version compatibility) ---

  methods.set('device.open_app_store', async () => {
    const devices = daemon.getWsServer().getConnectedDevices();
    if (devices.length === 0) {
      throw new Error('No device connected');
    }
    const conn = daemon.getWsServer().getConnection(devices[0]!.deviceId);
    if (!conn) {
      throw new Error('No device connected');
    }
    conn.send(MSG_OPEN_APP_STORE, { packageName: 'xyz.hanson.fosslink' });
    log.info('ipc.version', 'Sent open_app_store to phone');
    return { ok: true };
  });

  // --- Storage Analysis ---

  methods.set('storage.analyze', async () => {
    return await daemon.requestStorageAnalysis();
  });

  // --- Contact Migration ---

  methods.set('contacts.migration_scan', async () => {
    return await daemon.requestContactMigrationScan();
  });

  methods.set('contacts.migration_execute', async (params) => {
    const rawContactIds = params?.['rawContactIds'] as number[] | undefined;
    const targetAccount = params?.['targetAccount'] as string | undefined;
    if (!rawContactIds || !targetAccount) {
      throw new Error('Missing required parameters: rawContactIds, targetAccount');
    }
    return await daemon.requestContactMigrationExecute(rawContactIds, targetAccount);
  });

  // --- WebDAV / Filesystem Mount ---

  methods.set('webdav.start', async () => {
    return await daemon.startWebdav();
  });

  methods.set('webdav.stop', async () => {
    await daemon.stopWebdav();
    return { ok: true };
  });

  methods.set('webdav.status', async () => {
    return daemon.getWebdavStatus();
  });

  // --- Gallery ---

  methods.set('gallery.scan', async () => {
    return { items: await daemon.requestGalleryScan() };
  });

  methods.set('gallery.thumbnail', async (params) => {
    const filePath = params?.['path'] as string | undefined;
    if (!filePath) throw new Error('Missing required parameter: path');
    return await daemon.requestGalleryThumbnail(filePath);
  });

  methods.set('gallery.download', async (params) => {
    const filePath = params?.['path'] as string | undefined;
    const expectedSize = (params?.['expectedSize'] as number) ?? 0;
    if (!filePath) throw new Error('Missing required parameter: path');
    const localPath = await daemon.downloadGalleryFile(filePath, expectedSize);
    return { localPath };
  });

  methods.set('gallery.open', async () => {
    daemon.openGallery();
    return { ok: true };
  });

  methods.set('gallery.close', async () => {
    daemon.closeGallery();
    return { ok: true };
  });

  // --- Filesystem watch ---

  methods.set('fs.watch', async (params) => {
    const dirPath = params?.['path'] as string | undefined;
    if (!dirPath) throw new Error('Missing required parameter: path');
    await daemon.watchPath(dirPath);
    return { ok: true };
  });

  methods.set('fs.unwatch', async (params) => {
    const dirPath = params?.['path'] as string | undefined;
    if (!dirPath) throw new Error('Missing required parameter: path');
    await daemon.unwatchPath(dirPath);
    return { ok: true };
  });

  // --- Resync ---

  methods.set('sms.resync_all', async () => {
    // Clear all data including sync_state (forces full sync)
    daemon.getDatabaseService().clearAllData();
    log.info('ipc.resync', 'Cleared all database data');

    // Delete downloaded attachment files
    const attachDir = getAttachmentsDir();
    fs.rmSync(attachDir, { recursive: true, force: true });
    log.info('ipc.resync', 'Deleted attachment files', { dir: attachDir });

    // Start fresh sync (lastSyncTimestamp will be 0 → full sync)
    daemon.startSync();
    log.info('ipc.resync', 'Started full resync');
    return { ok: true };
  });

  // --- Debug methods ---

  methods.set('debug.thread_info', async (params) => {
    const threadId = params?.['threadId'] as number | undefined;
    if (threadId === undefined) {
      throw new Error('Missing required parameter: threadId');
    }
    const db = daemon.getDatabaseService();
    const messages = db.getThreadMessages(threadId);
    const conversation = db.getConversation(threadId);
    const connected = daemon.getWsServer().getConnectedDevices();
    return {
      threadId,
      messageCount: messages.length,
      messageIds: messages.map((m) => m._id),
      oldestDate: messages.length > 0 ? messages[0]!.date : null,
      newestDate: messages.length > 0 ? messages[messages.length - 1]!.date : null,
      conversationExists: conversation !== null,
      connectedDevices: connected.length,
    };
  });

  return methods;
}

/**
 * Wire daemon events to a notification emitter.
 * Used by both IPC server (standalone) and DaemonBridge (embedded).
 */
export function wireNotifications(daemon: Daemon, emit: NotificationEmitter): void {
  // State machine transitions
  daemon.getStateMachine().onTransition((transition) => {
    emit('state.changed', {
      from: transition.from as string,
      to: transition.to as string,
      context: transition.context as unknown as Record<string, unknown>,
      timestamp: transition.timestamp,
    });
  });

  // Device discovery events
  const discoveryService = daemon.getDiscoveryService();

  discoveryService.onDeviceFound((device) => {
    emit('device.found', device as unknown as Record<string, unknown>);
  });

  discoveryService.onDeviceLost((deviceId) => {
    emit('device.lost', { deviceId });
  });

  // Connection events
  const wsServer = daemon.getWsServer();

  wsServer.onConnection((connection) => {
    emit('device.connected', {
      deviceId: connection.deviceId,
      deviceName: connection.deviceName,
      rootEnabled: connection.rootEnabled ?? false,
    });
    // Flush any queued sends now that phone is connected
    daemon.getSmsHandler().flushSendQueue();
  });

  wsServer.onDisconnection((deviceId) => {
    emit('device.disconnected', { deviceId });
  });

  // Incoming pairing requests
  daemon.getPairingHandler().onIncomingPairing((request) => {
    emit('pairing.incoming', request as unknown as Record<string, unknown>);
  });

  // Pairing code generated (for GUI to display)
  daemon.getPairingHandler().onPairingCode((deviceId, deviceName, code) => {
    emit('pairing.code', { deviceId, deviceName, code });
  });

  // Pairing events
  daemon.getPairingHandler().onPairingResult((deviceId, success, verificationKey) => {
    const params: Record<string, unknown> = { deviceId, success };
    if (verificationKey) {
      params['verificationKey'] = verificationKey;
    }
    emit('pairing.result', params);
  });

  // SMS events
  daemon.getSmsHandler().onMessages((threadId, messages) => {
    const newestDate = messages.reduce((max, m) => Math.max(max, m.date), 0);
    emit('sms.messages', {
      threadId,
      count: messages.length,
      newestDate,
    });
  });

  daemon.getSmsHandler().onConversationsUpdated((conversations) => {
    emit('sms.conversations_updated', {
      count: conversations.length,
    });
  });

  daemon.getSmsHandler().onAttachmentDownloaded((partId, messageId, localPath) => {
    emit('sms.attachment_downloaded', {
      partId,
      messageId,
      localPath,
    });
  });

  daemon.getSmsHandler().onSendStatus((queueId, status) => {
    emit('sms.send_status', { queueId, status });
  });

  // Contact events
  daemon.getContactsHandler().onContactsUpdated((contacts) => {
    emit('contacts.updated', {
      count: contacts.length,
    });
  });

  // Notification events
  daemon.getNotificationHandler().onNotificationReceived((notif) => {
    emit('notification.received', {
      id: notif.id,
      appName: notif.app_name,
      title: notif.title,
      text: notif.text,
    });
  });

  daemon.getNotificationHandler().onNotificationDismissed((id) => {
    emit('notification.dismissed', { id });
  });

  // Battery updates
  daemon.onBattery((charge, charging) => {
    emit('device.battery', { charge, charging });
  });

  // Sync events
  daemon.getEnhancedSyncHandler().onSyncStarted(() => {
    emit('sync.started', { phase: 'enhanced', mode: 'batch' });
  });

  daemon.getEnhancedSyncHandler().onSyncProgress((batchIndex, totalBatches) => {
    const percent = totalBatches > 0 ? Math.round((batchIndex + 1) / totalBatches * 100) : 0;
    emit('sync.progress', { batchIndex, totalBatches, percent });
  });

  daemon.getEnhancedSyncHandler().onSyncComplete(() => {
    emit('sync.completed', { mode: 'enhanced' });
  });

  // Real-time event notifications
  daemon.getEventHandler().onEventReceived((event) => {
    emit('sms.event', {
      type: event.type,
      eventId: event.eventId,
      threadId: event.threadId,
      messageCount: event.messageCount,
    });
  });

  // Gallery media events from phone
  daemon.getGalleryEventHandler().onItemsAdded((items) => {
    emit('gallery.items_added', { items });
  });

  // Filesystem watch events from phone
  daemon.getFsWatchEventHandler().onEvent((event) => {
    emit('fs.watch_event', { ...event });
  });

  // URL share from phone
  daemon.onUrlShare((url) => {
    emit('url.shared', { url });
  });
}

/**
 * Register method handlers on an IPC server.
 * Uses createMethodMap internally — standalone daemon mode.
 */
export function registerHandlers(server: IpcServer, daemon: Daemon): void {
  const methods = createMethodMap(daemon);
  for (const [name, handler] of methods) {
    server.registerMethod(name, handler);
  }
  log.debug('ipc.handlers', 'Method handlers registered');
}

/**
 * Register notification wiring on an IPC server.
 * Uses wireNotifications internally — standalone daemon mode.
 */
export function registerNotifications(server: IpcServer, daemon: Daemon): void {
  wireNotifications(daemon, (method, params) => {
    server.broadcast(createNotification(method, params));
  });
  log.debug('ipc.handlers', 'Notification wiring registered');
}
