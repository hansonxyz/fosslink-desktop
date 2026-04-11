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
import { getContactPhotosDir } from '../utils/paths.js';
import { debugConsole } from '../sync/debug-console.js';
import type { LogLevel } from '../sync/debug-console.js';

const log = createLogger('ipc-handlers');

export type MethodHandler = (params?: Record<string, unknown>) => Promise<unknown>;
export type NotificationEmitter = (method: string, params: Record<string, unknown>) => void;

/**
 * Create a map of method name → handler function.
 * Used by both IPC server (standalone) and DaemonBridge (embedded).
 */
// Module-level emit reference (set by wireNotifications, used by gallery streaming)
let emit: NotificationEmitter;

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

  methods.set('gallery.scan', async (params) => {
    const scope = (params?.['scope'] as string) ?? 'all';
    const gh = daemon.getGalleryHandler();
    gh.scanScope = scope;

    // Wire batch callback for progressive rendering
    gh.onScanBatch = (batchItems, batch, totalBatches) => {
      debugConsole.log('transport', 'gallery', `Gallery batch ${batch}/${totalBatches} (${batchItems.length} items, scope=${scope})`);
      if (emit) {
        emit('gallery.scan.batch', { items: batchItems, batch, totalBatches, scope });
      }
    };

    try {
      const result = await gh.fetchScanDirect();
      return { items: result };
    } finally {
      gh.onScanBatch = null;
    }
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
    daemon.resync();
    return { ok: true };
  });

  // --- Sync orchestrator IPC ---

  methods.set('sync.thread_opened', async (params) => {
    const threadId = params?.['threadId'] as number | undefined;
    if (threadId === undefined) return { ok: false };
    daemon.getSyncOrchestrator()?.onThreadOpened(threadId);
    return { ok: true };
  });

  methods.set('sync.thread_closed', async () => {
    daemon.getSyncOrchestrator()?.onThreadClosed();
    return { ok: true };
  });

  // --- Sync debug console ---

  methods.set('debug.console.entries', async (params) => {
    const level = (params?.['level'] as string) ?? 'narrative';
    return { entries: debugConsole.getEntries(level as LogLevel) };
  });

  methods.set('debug.console.execute', async (params) => {
    const input = params?.['input'] as string;
    if (!input) throw new Error('Missing required parameter: input');
    const output = debugConsole.execute(input);
    return { output };
  });

  // Register debug console commands

  debugConsole.registerCommand('query', 'Run a query: query <resource> [json params]', (args) => {
    const resource = args[0];
    if (!resource) return 'Usage: query <resource> [json params]';

    let params: Record<string, unknown> = {};
    if (args.length > 1) {
      try {
        params = JSON.parse(args.slice(1).join(' '));
      } catch {
        return 'Invalid JSON params';
      }
    }

    const qc = daemon.getQueryClient();
    qc.query(resource, params)
      .then((data) => {
        debugConsole.log('query', 'query', `Result: ${data.length} items`);
        debugConsole.log('trace', 'query', JSON.stringify(data).slice(0, 500));
      })
      .catch((err) => {
        debugConsole.log('query', 'error', `Query failed: ${err instanceof Error ? err.message : String(err)}`);
      });

    return `Sending query: ${resource}`;
  });

  debugConsole.registerCommand('ws', 'Send raw WebSocket JSON: ws <json>', (args) => {
    const json = args.join(' ');
    if (!json) return 'Usage: ws <json>';

    try {
      const msg = JSON.parse(json);
      const wsServer = daemon.getWsServer();
      const deviceIds = wsServer.getConnectedDeviceIds();
      if (deviceIds.length === 0) return 'No device connected';
      const conn = wsServer.getConnection(deviceIds[0]!);
      if (!conn) return 'No device connected';
      conn.send(msg.type, msg.body ?? {});
      return `Sent: ${msg.type}`;
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  });

  // Note: sync and db commands are registered in wireNotifications() where emit is available

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
export function wireNotifications(daemon: Daemon, emitFn: NotificationEmitter): void {
  // Store emit at module level for use by gallery.scan streaming
  emit = emitFn;

  // Set up the notification function on the daemon for EventListener
  daemon.setNotifyFunction((method, params) => emitFn(method, params));

  // Forward debug console entries to GUI in real-time
  debugConsole.onEntry((entry) => {
    emit('debug.console.entry', entry);
  });

  // --- Sync debug commands (need emit for UI refresh notifications) ---

  debugConsole.registerCommand('sync', 'Run sync: sync threads|contacts|messages <id> [--full] [--since=Nd]', (args) => {
    const op = args[0];
    if (!op) return 'Usage: sync threads|contacts|messages <threadId> [--full] [--since=Nd]';

    const qc = daemon.getQueryClient();
    const db = daemon.getDatabaseService();

    if (op === 'threads') {
      import('../sync/operations/thread-list-sync.js').then(({ threadListSync }) =>
        threadListSync(qc, db).then(() => emit('sms.conversations_updated', {}))
      ).catch((err) => {
        debugConsole.log('query', 'error', `Thread sync failed: ${err instanceof Error ? err.message : String(err)}`);
      });
      return 'Starting thread list sync...';
    }

    if (op === 'contacts') {
      import('../sync/operations/contact-sync.js').then(({ contactSync }) =>
        contactSync(qc, db).then(() => emit('contacts.updated', {}))
      ).catch((err) => {
        debugConsole.log('query', 'error', `Contact sync failed: ${err instanceof Error ? err.message : String(err)}`);
      });
      return 'Starting contact sync...';
    }

    if (op === 'messages') {
      const threadIdStr = args[1];
      if (!threadIdStr) return 'Usage: sync messages <threadId> [--full] [--since=Nd]';
      const threadId = parseInt(threadIdStr, 10);
      if (isNaN(threadId)) return 'Invalid threadId';

      const isFull = args.includes('--full');
      const sinceArg = args.find(a => a.startsWith('--since='));
      const sinceDays = sinceArg ? parseInt(sinceArg.replace('--since=', '').replace('d', ''), 10) : 7;

      if (isFull) {
        import('../sync/operations/full-thread-sync.js').then(({ fullThreadSync }) =>
          fullThreadSync(qc, db, threadId).then(() => {
            emit('sms.messages', { threadId });
            emit('sms.conversations_updated', {});
          })
        ).catch((err) => {
          debugConsole.log('query', 'error', `Full sync failed: ${err instanceof Error ? err.message : String(err)}`);
        });
        return `Starting full sync of thread ${threadId}...`;
      } else {
        const sinceDate = Date.now() - (sinceDays * 86_400_000);
        import('../sync/operations/quick-message-sync.js').then(({ quickMessageSync }) =>
          quickMessageSync(qc, db, threadId, sinceDate).then(() => {
            emit('sms.messages', { threadId });
            emit('sms.conversations_updated', {});
          })
        ).catch((err) => {
          debugConsole.log('query', 'error', `Message sync failed: ${err instanceof Error ? err.message : String(err)}`);
        });
        return `Starting ${sinceDays}-day message sync of thread ${threadId}...`;
      }
    }

    return `Unknown sync operation: ${op}. Use: threads, contacts, messages`;
  });

  debugConsole.registerCommand('db', 'Show DB state: db threads|messages <id> [--last=N]', (args) => {
    const what = args[0];
    if (!what) return 'Usage: db threads|messages <threadId> [--last=N]';

    const db = daemon.getDatabaseService();

    if (what === 'threads') {
      const convs = db.getAllConversations();
      const lines = convs.slice(0, 30).map(c => {
        const syncFlag = c.full_sync_complete ? 'SYNCED' : 'pending';
        const date = new Date(c.date).toLocaleDateString();
        return `  ${String(c.thread_id).padEnd(6)} ${(c.addresses ?? '').padEnd(20).slice(0, 20)} ${date.padEnd(12)} ${syncFlag}`;
      });
      return `Threads (${convs.length} total, showing first 30):\n` +
        `  ${'ID'.padEnd(6)} ${'Address'.padEnd(20)} ${'Date'.padEnd(12)} Sync\n` +
        lines.join('\n');
    }

    if (what === 'messages') {
      const threadIdStr = args[1];
      if (!threadIdStr) return 'Usage: db messages <threadId> [--last=N]';
      const threadId = parseInt(threadIdStr, 10);
      if (isNaN(threadId)) return 'Invalid threadId';

      const lastArg = args.find(a => a.startsWith('--last='));
      const lastN = lastArg ? parseInt(lastArg.replace('--last=', ''), 10) : 10;

      const msgs = db.getThreadMessages(threadId);
      const slice = msgs.slice(-lastN);
      const lines = slice.map(m => {
        const date = new Date(m.date).toLocaleString();
        const dir = m.type === 2 ? '→' : '←';
        const body = (m.body ?? '').slice(0, 60).replace(/\n/g, ' ');
        return `  ${dir} ${date}  ${body}`;
      });
      return `Thread ${threadId} (${msgs.length} total, last ${slice.length}):\n` + lines.join('\n');
    }

    return `Unknown: ${what}. Use: threads, messages`;
  });

  // Phase 4: Event listener commands
  debugConsole.registerCommand('subscribe', 'Subscribe to real-time events from phone', () => {
    const wsServer = daemon.getWsServer();
    const deviceIds = wsServer.getConnectedDeviceIds();
    if (deviceIds.length === 0) return 'No device connected';
    const conn = wsServer.getConnection(deviceIds[0]!);
    if (!conn) return 'No device connected';
    conn.send('fosslink.subscribe', {});
    return 'Subscribe request sent — events will appear in log';
  });

  debugConsole.registerCommand('flags', 'Show threads flagged for post-sync resync', () => {
    try {
      const el = daemon.getEventListener();
      const flagged = el.getAndClearFlaggedThreads();
      if (flagged.length === 0) return 'No threads flagged for resync';
      return `Flagged threads (cleared): ${flagged.join(', ')}`;
    } catch {
      return 'EventListener not initialized';
    }
  });

  // Phase 5: Orchestrator commands
  debugConsole.registerCommand('status', 'Show orchestrator state, queue, and connection info', () => {
    const orch = daemon.getSyncOrchestrator();
    if (!orch) return 'Orchestrator not initialized';
    const progress = orch.progress;
    const queue = orch.getQueueInfo();
    const lines = [
      `State: ${progress.state}`,
      `Phase: ${progress.phase || '(idle)'}`,
      progress.percent !== null ? `Progress: ${progress.percent}%` : '',
      progress.currentThread ? `Current thread: ${progress.currentThread}` : '',
      `Current op: ${queue.current ?? '(none)'}`,
      `Queue: ${queue.queued.length > 0 ? queue.queued.join(', ') : '(empty)'}`,
    ].filter(Boolean);
    return lines.join('\n');
  });

  debugConsole.registerCommand('queue', 'Show operation queue', () => {
    const orch = daemon.getSyncOrchestrator();
    if (!orch) return 'Orchestrator not initialized';
    const info = orch.getQueueInfo();
    const lines = [`Current: ${info.current ?? '(none)'}`];
    if (info.queued.length > 0) {
      lines.push(`Queued (${info.queued.length}):`);
      for (const name of info.queued) lines.push(`  ${name}`);
    } else {
      lines.push('Queue: empty');
    }
    return lines.join('\n');
  });

  debugConsole.registerCommand('pause', 'Pause the sync orchestrator', () => {
    daemon.getSyncOrchestrator()?.pause();
    return 'Paused';
  });

  debugConsole.registerCommand('resume', 'Resume the sync orchestrator', () => {
    daemon.getSyncOrchestrator()?.resume();
    return 'Resumed';
  });

  debugConsole.registerCommand('abort', 'Abort the current sync operation', () => {
    daemon.getSyncOrchestrator()?.abort();
    return 'Aborted';
  });

  debugConsole.registerCommand('stale', 'Mark thread(s) as stale: stale <threadId|all>', (args) => {
    const target = args[0];
    if (!target) return 'Usage: stale <threadId|all>';
    const db = daemon.getDatabaseService();

    if (target === 'all') {
      const count = db.markStaleThreads(0); // 0 = mark all as stale
      return `Marked ${count} threads as stale`;
    }

    const threadId = parseInt(target, 10);
    if (isNaN(threadId)) return 'Invalid threadId';
    db.markThreadStale(threadId);
    return `Thread ${threadId} marked as stale`;
  });

  debugConsole.registerCommand('reset', 'Clear all sync state flags', () => {
    const db = daemon.getDatabaseService();
    db.setSyncState('initial_sync_complete', '0');
    db.setSyncState('initial_sync_date', '0');
    const count = db.markStaleThreads(0);
    return `Sync state reset. ${count} threads marked as needing resync.`;
  });

  debugConsole.registerCommand('state', 'Show state machine transition history', () => {
    const orch = daemon.getSyncOrchestrator();
    if (!orch) return 'Orchestrator not initialized';
    const history = orch.getStateHistory();
    if (history.length === 0) return 'No state transitions recorded';
    const lines = history.map(h => {
      const time = new Date(h.time).toLocaleTimeString();
      return `  ${time}  ${h.from} → ${h.to}`;
    });
    return `State history:\n${lines.join('\n')}`;
  });

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
