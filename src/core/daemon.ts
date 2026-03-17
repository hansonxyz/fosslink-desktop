/**
 * Daemon Lifecycle (v2)
 *
 * Coordinates startup and shutdown of the daemon process:
 * data directory creation, configuration loading, logger
 * initialization, state machine management, PID file handling,
 * signal handling, and network service wiring.
 *
 * v2 replaces TCP/TLS with WebSocket:
 * - WsServer (WSS) for device connections
 * - WsDiscoveryService for UDP broadcast/listen
 * - MessageRouter for incoming WebSocket messages
 * - Direct handler registration (no adapter layer)
 * - Shared-secret pairing (no RSA certificate exchange)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { ErrorCode, DaemonError } from './errors.js';
import { StateMachine, AppState } from './state-machine.js';
import { loadConfig } from '../config/config.js';
import type { DaemonConfig } from '../config/config.js';
import {
  initializeLogger,
  createLogger,
  shutdownLogger,
  resetLogger,
} from '../utils/logger.js';
import type { Logger } from '../utils/logger.js';
import { getDataDir, getConfigPath, getTrustedCertsDir, getSocketPath, getAttachmentsDir, getContactPhotosDir } from '../utils/paths.js';
import { DatabaseService } from '../database/database.js';
import {
  loadOrCreateDeviceId,
  loadOrCreateCertificate,
} from '../utils/crypto.js';
import { getCertificatePath, getPrivateKeyPath } from '../utils/paths.js';
import { loadKnownDevices, saveKnownDevice } from '../config/known-devices.js';
import { WsServer, WS_PORT } from '../network/ws-server.js';
import type { DeviceConnection } from '../network/ws-server.js';
import { WsDiscoveryService } from '../network/ws-discovery.js';
import { PairingHandler } from '../protocol/pairing-handler.js';
import { MessageRouter } from '../protocol/packet-router.js';
import {
  MSG_PAIR_REQUEST,
  MSG_PAIR_CONFIRM,
  MSG_PAIR_REJECT,
  MSG_UNPAIR,
  MSG_SETTINGS,
  MSG_SMS_MESSAGES,
  MSG_SMS_ATTACHMENT_FILE,
  MSG_SMS_SEND_STATUS,
  MSG_BATTERY,
  MSG_BATTERY_REQUEST,
  MSG_NOTIFICATION,
  MSG_SYNC_BATCH,
  MSG_SYNC_COMPLETE,
  MSG_EVENT,
  MSG_URL_SHARE,
  MSG_CONTACTS_UIDS_RESPONSE,
  MSG_CONTACTS_VCARDS_RESPONSE,
  MSG_STORAGE_REQUEST,
  MSG_STORAGE_ANALYSIS,
  MSG_CONTACTS_MIGRATION_SCAN,
  MSG_CONTACTS_MIGRATION_SCAN_RESPONSE,
  MSG_CONTACTS_MIGRATION_EXECUTE,
  MSG_CONTACTS_MIGRATION_EXECUTE_RESPONSE,
  MSG_FS_STAT_RESPONSE,
  MSG_FS_READDIR_RESPONSE,
  MSG_FS_READ_RESPONSE,
  MSG_FS_WRITE_RESPONSE,
  MSG_FS_MKDIR_RESPONSE,
  MSG_FS_DELETE_RESPONSE,
  MSG_FS_RENAME_RESPONSE,
  MSG_GALLERY_SCAN_RESPONSE,
  MSG_GALLERY_THUMBNAIL_RESPONSE,
  MSG_GALLERY_MEDIA_EVENT,
  MSG_FS_WATCH_RESPONSE,
  MSG_FS_UNWATCH_RESPONSE,
  MSG_FS_WATCH_EVENT,
  CLIENT_VERSION,
} from '../network/packet.js';
import { IpcServer } from '../ipc/server.js';
import { registerHandlers, registerNotifications } from '../ipc/handlers.js';
import { createNotification } from '../ipc/json-rpc.js';
import { SmsHandler } from '../protocol/standard/sms-handler.js';
import { ContactsHandler } from '../protocol/standard/contacts-handler.js';
import { NotificationHandler } from '../protocol/standard/notification-handler.js';
import { EnhancedSyncHandler } from '../protocol/enhanced/enhanced-sync-handler.js';
import { EventHandler } from '../protocol/enhanced/event-handler.js';
import { GalleryEventHandler } from '../protocol/enhanced/gallery-event-handler.js';
import { FsWatchEventHandler } from '../protocol/enhanced/fs-watch-event-handler.js';
import { FilesystemHandler } from '../protocol/enhanced/filesystem-handler.js';
import { WebdavServer } from '../webdav/webdav-server.js';
import { GalleryHandler } from '../gallery/gallery-handler.js';
import type { GalleryItem } from '../gallery/gallery-handler.js';

export interface DaemonOptions {
  dataDir?: string;
  configPath?: string;
  /** Force logging to daemon.log file (for embedded mode where stdout is lost) */
  logToFile?: boolean;
  /** Override daemon log file path (e.g. to write to a network share) */
  logFilePath?: string;
}

export interface StartOptions {
  /** Skip PID file management (for embedded mode) */
  skipPidFile?: boolean;
  /** Skip SIGTERM/SIGINT signal handlers (for embedded mode) */
  skipSignalHandlers?: boolean;
  /** Skip IPC server startup (for embedded mode where host handles IPC) */
  skipIpcServer?: boolean;
  /** Skip keepalive interval (for embedded mode where host keeps process alive) */
  skipKeepalive?: boolean;
}

export interface DaemonStatus {
  state: AppState;
  pid: number;
  uptime: number;
  config: DaemonConfig;
}

type BatteryCallback = (charge: number, charging: boolean) => void;
type UrlShareCallback = (url: string) => void;

/** Pairing message types that route to the pairing handler */
const PAIRING_TYPES = [MSG_PAIR_REQUEST, MSG_PAIR_CONFIRM, MSG_PAIR_REJECT, MSG_UNPAIR];

export class Daemon {
  private stateMachine: StateMachine | undefined;
  private config: DaemonConfig | undefined;
  private logger: Logger | undefined;
  private dataDir: string | undefined;
  private pidPath: string | undefined;
  private keepaliveInterval: ReturnType<typeof setInterval> | undefined;
  private stopped = false;
  private started = false;

  // Network (v2 — WebSocket)
  private deviceId: string | undefined;
  private wsServer: WsServer | undefined;
  private discoveryService: WsDiscoveryService | undefined;
  private pairingHandler: PairingHandler | undefined;
  private messageRouter: MessageRouter | undefined;

  // IPC server
  private ipcServer: IpcServer | undefined;

  // Database
  private databaseService: DatabaseService | undefined;

  // Protocol handlers (no adapter layer — always enhanced)
  private smsHandler: SmsHandler | undefined;
  private contactsHandler: ContactsHandler | undefined;
  private notificationHandler: NotificationHandler | undefined;
  private enhancedSyncHandler: EnhancedSyncHandler | undefined;
  private eventHandler: EventHandler | undefined;
  private filesystemHandler: FilesystemHandler | undefined;
  private galleryHandler: GalleryHandler | undefined;
  private galleryEventHandler: GalleryEventHandler | undefined;
  private fsWatchEventHandler: FsWatchEventHandler | undefined;
  private webdavServer: WebdavServer | undefined;
  private webdavDisconnectTimer: ReturnType<typeof setTimeout> | undefined;

  // Battery state (in-memory only)
  private batteryCharge = -1;
  private batteryCharging = false;
  private batteryCallbacks: BatteryCallback[] = [];

  // URL sharing
  private urlShareCallbacks: UrlShareCallback[] = [];

  // Storage analysis pending request
  private storageAnalysisResolve: ((data: Record<string, unknown>) => void) | undefined;
  private storageAnalysisReject: ((err: Error) => void) | undefined;
  private storageAnalysisTimeout: ReturnType<typeof setTimeout> | undefined;

  // Contact migration pending request
  private contactMigrationResolve: ((data: Record<string, unknown>) => void) | undefined;
  private contactMigrationReject: ((err: Error) => void) | undefined;
  private contactMigrationTimeout: ReturnType<typeof setTimeout> | undefined;

  // Reconnect timers for known devices
  private reconnectTimers = new Map<string, ReturnType<typeof setInterval>>();

  // Track whether initial sync has been done this session
  private sessionSynced = false;

  async init(options?: DaemonOptions): Promise<void> {
    // Resolve data directory
    this.dataDir = options?.dataDir ?? getDataDir();
    fs.mkdirSync(this.dataDir, { recursive: true });

    // Load configuration
    const configPath = options?.configPath ?? getConfigPath();
    this.config = loadConfig(configPath);

    // Initialize logger — rotate old logs (keep 3 generations)
    const logPath = options?.logFilePath ?? path.join(this.dataDir, 'daemon.log');
    if (fs.existsSync(logPath)) {
      for (let i = 2; i >= 1; i--) {
        const src = i === 1 ? logPath : `${logPath}.${i}`;
        const dst = `${logPath}.${i + 1}`;
        if (fs.existsSync(src)) {
          fs.renameSync(src, dst);
        }
      }
    }
    const forceFile = options?.logToFile === true;
    const isPretty = !forceFile && process.env['NODE_ENV'] !== 'production';
    initializeLogger({
      level: this.config.daemon.logLevel,
      filePath: forceFile || !isPretty ? logPath : undefined,
      pretty: isPretty,
    });

    this.logger = createLogger('daemon');

    // Create state machine
    this.stateMachine = new StateMachine();

    // Load or create device identity and certificate (cert used for HTTPS/WSS)
    this.deviceId = loadOrCreateDeviceId(this.dataDir);
    const cert = loadOrCreateCertificate(
      getCertificatePath(),
      getPrivateKeyPath(),
      this.deviceId,
    );

    // Create trusted devices directory
    const trustedDevicesDir = getTrustedCertsDir();
    fs.mkdirSync(trustedDevicesDir, { recursive: true });

    // Create network services
    this.wsServer = new WsServer();
    this.discoveryService = new WsDiscoveryService();
    this.pairingHandler = new PairingHandler({
      trustedDevicesDir,
    });
    this.messageRouter = new MessageRouter();

    // --- Register message handlers on router ---

    // Pairing messages
    for (const pairingType of PAIRING_TYPES) {
      this.messageRouter.registerHandler(pairingType, (msg, connection) => {
        this.pairingHandler!.handlePairingMessage(msg, connection);
      });
    }

    // Settings from phone
    this.messageRouter.registerHandler(MSG_SETTINGS, (msg, connection) => {
      const rootEnabled = msg.body['rootEnabled'] === true;
      connection.rootEnabled = rootEnabled;

      const storageTotalBytes = typeof msg.body['storageTotalBytes'] === 'number'
        ? msg.body['storageTotalBytes'] as number : undefined;
      const storageFreeBytes = typeof msg.body['storageFreeBytes'] === 'number'
        ? msg.body['storageFreeBytes'] as number : undefined;

      this.logger!.info('core.daemon', 'Settings update from phone', {
        deviceId: connection.deviceId,
        rootEnabled,
        storageTotalBytes,
        storageFreeBytes,
      });

      if (this.stateMachine!.getState() === AppState.CONNECTED ||
          this.stateMachine!.getState() === AppState.SYNCING ||
          this.stateMachine!.getState() === AppState.READY) {
        const contextUpdate: Record<string, unknown> = { peerRootEnabled: rootEnabled };
        if (storageTotalBytes !== undefined) contextUpdate['peerStorageTotalBytes'] = storageTotalBytes;
        if (storageFreeBytes !== undefined) contextUpdate['peerStorageFreeBytes'] = storageFreeBytes;
        this.stateMachine!.updateContext(contextUpdate);
      }
    });

    // --- Wire WebSocket messages → router ---

    this.wsServer.onMessage((msg, connection) => {
      this.messageRouter!.route(msg, connection);
    });

    // --- Wire pairing results → state machine ---

    this.pairingHandler.onPairingResult((deviceId, success) => {
      if (success) {
        this.logger!.info('core.daemon', 'Pairing successful', { deviceId });
        const conn = this.wsServer!.getConnection(deviceId);
        if (this.stateMachine!.canTransition(AppState.CONNECTED)) {
          this.stateMachine!.transition(AppState.CONNECTED, {
            deviceId,
            deviceName: conn?.deviceName,
            peerClientType: 'fosslink',
            peerClientVersion: conn?.clientVersion,
            peerRootEnabled: conn?.rootEnabled,
          });
        }

        // Save to known devices
        if (conn) {
          saveKnownDevice({
            deviceId,
            deviceName: conn.deviceName,
            address: conn.remoteAddress ?? '',
            port: WS_PORT,
          });
        }

        if (this.config!.sync.autoSync && !this.sessionSynced) {
          this.startSync();
        }
      } else {
        this.logger!.info('core.daemon', 'Pairing failed', { deviceId });
        if (this.stateMachine!.canTransition(AppState.DISCONNECTED)) {
          this.stateMachine!.transition(AppState.DISCONNECTED);
        }
        if (this.stateMachine!.canTransition(AppState.DISCOVERING)) {
          this.stateMachine!.transition(AppState.DISCOVERING);
        }
      }
    });

    // --- Wire connections → state machine ---

    this.wsServer.onConnection((connection) => {
      this.logger!.info('core.daemon', 'Device connected', {
        deviceId: connection.deviceId,
        deviceName: connection.deviceName,
        clientVersion: connection.clientVersion,
        remoteAddress: connection.remoteAddress,
      });

      // Register in discovery list so GUI shows the device
      if (connection.remoteAddress) {
        this.discoveryService!.addDevice({
          deviceId: connection.deviceId,
          deviceName: connection.deviceName,
          deviceType: 'phone',
          wsPort: WS_PORT,
          address: connection.remoteAddress,
          clientVersion: connection.clientVersion ?? '0.0.0',
          lastSeen: Date.now(),
        });
      }

      // Clear any reconnect timer
      this.clearReconnectTimer(connection.deviceId);

      // If device is already paired, transition to CONNECTED
      if (this.pairingHandler!.isPaired(connection.deviceId)) {
        if (this.stateMachine!.canTransition(AppState.CONNECTED)) {
          this.stateMachine!.transition(AppState.CONNECTED, {
            deviceId: connection.deviceId,
            deviceName: connection.deviceName,
            peerClientType: 'fosslink',
            peerClientVersion: connection.clientVersion,
            peerRootEnabled: connection.rootEnabled,
          });
        }

        // Re-request contacts on reconnection
        if (this.contactsHandler) {
          this.contactsHandler.requestAllUidsTimestamps();
        }

        // Resume queued attachment downloads
        if (this.smsHandler) {
          this.smsHandler.resumeDownloads();
        }

        // Wire filesystem handler send function
        if (this.filesystemHandler) {
          this.filesystemHandler.setSendFunction((msg) => connection.send(msg.type, msg.body));
        }

        // Wire gallery handler send function
        if (this.galleryHandler) {
          this.galleryHandler.setSendFunction((msg) => connection.send(msg.type, msg.body));
        }

        // Cancel pending WebDAV shutdown (phone reconnected in time)
        if (this.webdavDisconnectTimer) {
          clearTimeout(this.webdavDisconnectTimer);
          this.webdavDisconnectTimer = undefined;
        }

        // Request battery state
        this.requestBattery(connection);

        if (this.config!.sync.autoSync && !this.sessionSynced) {
          this.startSync();
        }

        // Pre-scan gallery file list for instant gallery loading
        if (this.galleryHandler) {
          this.galleryHandler.preScan().catch(() => {});
        }
      } else {
        // Auto-initiate pairing for unpaired devices
        this.logger!.info('core.daemon', 'Auto-initiating pairing for new device', {
          deviceId: connection.deviceId,
          deviceName: connection.deviceName,
        });

        // Transition to PAIRING state so the GUI shows pairing UI
        if (this.stateMachine!.canTransition(AppState.PAIRING)) {
          this.stateMachine!.transition(AppState.PAIRING, {
            deviceId: connection.deviceId,
            deviceName: connection.deviceName,
          });
        }

        try {
          const result = this.pairingHandler!.requestPairing(connection);
          this.logger!.info('core.daemon', 'Pairing code generated', {
            deviceId: connection.deviceId,
            code: result.verificationKey,
          });
        } catch (err) {
          this.logger!.error('core.daemon', 'Failed to initiate pairing', {
            deviceId: connection.deviceId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    });

    // --- Wire unpair → cleanup ---

    this.pairingHandler.onUnpaired((deviceId) => {
      this.logger!.info('core.daemon', 'Device unpaired', { deviceId });
      this.sessionSynced = false;

      const conn = this.wsServer!.getConnection(deviceId);
      if (conn) {
        conn.close();
      }

      // Wipe cached files
      const attachDir = getAttachmentsDir();
      fs.rmSync(attachDir, { recursive: true, force: true });
      const contactPhotosDir = getContactPhotosDir();
      fs.rmSync(contactPhotosDir, { recursive: true, force: true });
      this.logger!.info('core.daemon', 'File caches wiped', { attachDir, contactPhotosDir });

      // Wipe database data
      if (this.databaseService?.isOpen()) {
        this.databaseService.wipeAllData();
        this.logger!.info('core.daemon', 'Database data wiped on unpair');
      }
    });

    // --- Wire disconnections → state machine + reconnect ---

    this.wsServer.onDisconnection((deviceId) => {
      this.logger!.info('core.daemon', 'Device disconnected', { deviceId });

      // Clear filesystem handler send function
      if (this.filesystemHandler) {
        this.filesystemHandler.clearSendFunction();
      }

      // Clear gallery handler send function
      if (this.galleryHandler) {
        this.galleryHandler.clearSendFunction();
      }

      // Stop WebDAV server if phone doesn't reconnect within 10s
      if (this.webdavServer?.isRunning() && !this.webdavDisconnectTimer) {
        this.webdavDisconnectTimer = setTimeout(() => {
          this.webdavDisconnectTimer = undefined;
          if (this.webdavServer?.isRunning()) {
            this.logger!.info('core.daemon', 'Stopping WebDAV server after phone disconnect timeout');
            void this.webdavServer.stop();
            this.webdavServer = undefined;
            this.ipcServer?.broadcast(createNotification('webdav.stopped', {}));
          }
        }, 10_000);
      }

      if (this.stateMachine!.canTransition(AppState.DISCONNECTED)) {
        this.stateMachine!.transition(AppState.DISCONNECTED);
      }
      if (this.stateMachine!.canTransition(AppState.DISCOVERING)) {
        this.stateMachine!.transition(AppState.DISCOVERING);
      }

      this.startReconnectTimer(deviceId);
    });

    // --- Wire discovery → auto-connect trusted devices ---

    this.discoveryService.onDeviceFound((device) => {
      this.logger!.info('core.daemon', 'Device discovered', {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
      });

      if (this.pairingHandler!.isPaired(device.deviceId)) {
        this.logger!.info('core.daemon', 'Auto-connecting to trusted device', {
          deviceId: device.deviceId,
        });
        // Phone should already be connecting to us (it heard our discovery broadcast).
        // But also update known device with latest address info.
        saveKnownDevice({
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          address: device.address,
          port: WS_PORT,
        });
      }
    });

    // --- Start WebSocket server ---

    await this.wsServer.start(
      this.deviceId,
      cert.cert,
      cert.private,
      this.config.kdeConnect.deviceName,
    );

    // Create IPC server
    this.ipcServer = new IpcServer(getSocketPath());

    // Open database
    this.databaseService = new DatabaseService(path.join(this.dataDir, 'fosslink.db'));
    this.databaseService.open();

    // Repair any conversations with corrupted addresses
    const repaired = this.databaseService.repairConversationAddresses();
    if (repaired > 0) {
      this.logger.info('core.daemon', 'Repaired conversation addresses on startup', { count: repaired });
    }

    // --- Create protocol handlers ---

    const getConnection = () => {
      const devices = this.wsServer!.getConnectedDeviceIds();
      if (devices.length === 0) return undefined;
      return this.wsServer!.getConnection(devices[0]!);
    };

    this.smsHandler = new SmsHandler({
      db: this.databaseService,
      getConnection,
      getCert: () => cert.cert,
      getKey: () => cert.private,
    });

    this.contactsHandler = new ContactsHandler({
      db: this.databaseService,
      getConnection,
      contactPhotosDir: getContactPhotosDir(),
    });

    this.notificationHandler = new NotificationHandler({
      db: this.databaseService,
    });

    this.enhancedSyncHandler = new EnhancedSyncHandler({
      smsHandler: this.smsHandler,
      contactsHandler: this.contactsHandler,
      db: this.databaseService,
      stateMachine: this.stateMachine,
      config: this.config,
      getConnection,
    });

    this.eventHandler = new EventHandler({
      smsHandler: this.smsHandler,
      db: this.databaseService,
      getConnection,
    });

    this.galleryEventHandler = new GalleryEventHandler({
      getConnection,
    });

    this.fsWatchEventHandler = new FsWatchEventHandler({
      getConnection,
    });

    this.filesystemHandler = new FilesystemHandler();
    this.galleryHandler = new GalleryHandler();

    // Merge real-time gallery events into the pre-scanned cache
    this.galleryEventHandler.onItemsAdded((items) => {
      this.galleryHandler!.mergeItems(items);
    });

    // Wire sync completion to session tracking
    this.enhancedSyncHandler.onSyncComplete(() => {
      this.sessionSynced = true;
      this.logger!.info('core.daemon', 'Session sync completed');
    });

    // --- Register protocol handlers on router ---

    // SMS messages (incoming from phone)
    this.messageRouter.registerHandler(MSG_SMS_MESSAGES, (msg, conn) => {
      this.smsHandler!.handleMessages(msg, conn);
    });
    this.messageRouter.registerHandler(MSG_SMS_ATTACHMENT_FILE, (msg, conn) => {
      this.smsHandler!.handleAttachmentFile(msg, conn);
    });
    this.messageRouter.registerHandler(MSG_SMS_SEND_STATUS, (msg) => {
      this.smsHandler!.handleSendStatusResponse(msg);
    });

    // Notifications
    this.messageRouter.registerHandler(MSG_NOTIFICATION, (msg, conn) => {
      this.notificationHandler!.handleNotification(msg, conn);
    });

    // Battery
    this.messageRouter.registerHandler(MSG_BATTERY, (msg) => {
      const charge = typeof msg.body['currentCharge'] === 'number' ? msg.body['currentCharge'] as number : -1;
      const charging = msg.body['isCharging'] === true;
      if (charge !== this.batteryCharge || charging !== this.batteryCharging) {
        this.batteryCharge = charge;
        this.batteryCharging = charging;
        for (const cb of this.batteryCallbacks) {
          cb(charge, charging);
        }
      }
    });

    // Enhanced sync
    this.messageRouter.registerHandler(MSG_SYNC_BATCH, (msg, conn) => {
      this.enhancedSyncHandler!.handleSyncBatch(msg, conn);
    });
    this.messageRouter.registerHandler(MSG_SYNC_COMPLETE, (msg) => {
      this.enhancedSyncHandler!.handleSyncComplete(msg);
    });

    // Real-time events
    this.messageRouter.registerHandler(MSG_EVENT, (msg, conn) => {
      this.eventHandler!.handleEvent(msg, conn);
    });

    // Contact sync responses
    this.messageRouter.registerHandler(MSG_CONTACTS_UIDS_RESPONSE, (msg, conn) => {
      this.contactsHandler!.handleUidsResponse(msg, conn);
    });
    this.messageRouter.registerHandler(MSG_CONTACTS_VCARDS_RESPONSE, (msg, conn) => {
      this.contactsHandler!.handleVcardsResponse(msg, conn);
    });

    // URL sharing from phone
    this.messageRouter.registerHandler(MSG_URL_SHARE, (msg) => {
      const url = msg.body['url'];
      if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
        this.logger!.info('core.daemon', 'URL share received from phone', { url });
        for (const cb of this.urlShareCallbacks) {
          cb(url);
        }
      }
    });

    // Filesystem responses from phone
    const fsResponseTypes = [
      MSG_FS_STAT_RESPONSE, MSG_FS_READDIR_RESPONSE, MSG_FS_READ_RESPONSE,
      MSG_FS_WRITE_RESPONSE, MSG_FS_MKDIR_RESPONSE, MSG_FS_DELETE_RESPONSE,
      MSG_FS_RENAME_RESPONSE,
    ];
    for (const fsType of fsResponseTypes) {
      this.messageRouter.registerHandler(fsType, (msg) => {
        this.filesystemHandler!.handleResponse(msg);
      });
    }

    // Gallery responses from phone
    for (const galleryType of [MSG_GALLERY_SCAN_RESPONSE, MSG_GALLERY_THUMBNAIL_RESPONSE]) {
      this.messageRouter.registerHandler(galleryType, (msg) => {
        this.galleryHandler!.handleResponse(msg);
      });
    }

    // Gallery real-time media events from phone
    this.messageRouter.registerHandler(MSG_GALLERY_MEDIA_EVENT, (msg, conn) => {
      this.galleryEventHandler!.handleEvent(msg, conn);
    });

    // Filesystem watch responses from phone
    for (const fsWatchType of [MSG_FS_WATCH_RESPONSE, MSG_FS_UNWATCH_RESPONSE]) {
      this.messageRouter.registerHandler(fsWatchType, (msg) => {
        this.filesystemHandler!.handleResponse(msg);
      });
    }

    // Filesystem watch events from phone (real-time file changes)
    this.messageRouter.registerHandler(MSG_FS_WATCH_EVENT, (msg, conn) => {
      this.fsWatchEventHandler!.handleEvent(msg, conn);
    });

    // Storage analysis response from phone
    this.messageRouter.registerHandler(MSG_STORAGE_ANALYSIS, (msg) => {
      this.logger!.info('core.daemon', 'Storage analysis received from phone');
      if (this.storageAnalysisResolve) {
        if (this.storageAnalysisTimeout) {
          clearTimeout(this.storageAnalysisTimeout);
          this.storageAnalysisTimeout = undefined;
        }
        this.storageAnalysisResolve(msg.body);
        this.storageAnalysisResolve = undefined;
        this.storageAnalysisReject = undefined;
      }
    });

    // Contact migration responses from phone
    this.messageRouter.registerHandler(MSG_CONTACTS_MIGRATION_SCAN_RESPONSE, (msg) => {
      if (this.contactMigrationResolve) {
        if (this.contactMigrationTimeout) clearTimeout(this.contactMigrationTimeout);
        this.contactMigrationResolve(msg.body);
        this.contactMigrationResolve = undefined;
        this.contactMigrationReject = undefined;
        this.contactMigrationTimeout = undefined;
      }
    });

    this.messageRouter.registerHandler(MSG_CONTACTS_MIGRATION_EXECUTE_RESPONSE, (msg) => {
      if (this.contactMigrationResolve) {
        if (this.contactMigrationTimeout) clearTimeout(this.contactMigrationTimeout);
        this.contactMigrationResolve(msg.body);
        this.contactMigrationResolve = undefined;
        this.contactMigrationReject = undefined;
        this.contactMigrationTimeout = undefined;
      }
    });

    this.logger.info('core.daemon', 'Daemon initialized', {
      dataDir: this.dataDir,
      logLevel: this.config.daemon.logLevel,
      deviceId: this.deviceId,
      wsPort: this.wsServer.getPort(),
      clientVersion: CLIENT_VERSION,
    });
  }

  async start(options?: StartOptions): Promise<void> {
    if (!this.stateMachine || !this.config || !this.logger || !this.dataDir ||
        !this.deviceId || !this.wsServer || !this.discoveryService) {
      throw new DaemonError(
        ErrorCode.DAEMON_INIT_FAILED,
        'Daemon not initialized. Call init() first.',
      );
    }

    if (this.started) {
      throw new DaemonError(
        ErrorCode.DAEMON_ALREADY_RUNNING,
        'Daemon already started',
      );
    }

    // PID file management
    if (!options?.skipPidFile) {
      this.pidPath = path.join(this.dataDir, 'daemon.pid');
      this.checkStalePid();
      fs.writeFileSync(this.pidPath, String(process.pid), 'utf-8');
    }

    // Register signal handlers
    if (!options?.skipSignalHandlers) {
      const shutdown = () => {
        void this.stop().then(() => process.exit(0));
      };
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    }

    // Transition to DISCONNECTED
    this.stateMachine.transition(AppState.DISCONNECTED);
    this.started = true;

    // Start discovery (broadcasting and listening)
    this.stateMachine.transition(AppState.DISCOVERING);
    this.discoveryService.start(
      this.deviceId,
      this.config.kdeConnect.deviceName,
      this.wsServer.getPort(),
    );

    // Auto-connect to known paired devices via directed UDP discovery
    this.connectKnownDevices();

    // Start IPC server and register handlers
    if (!options?.skipIpcServer) {
      if (this.ipcServer) {
        registerHandlers(this.ipcServer, this);
        registerNotifications(this.ipcServer, this);
        await this.ipcServer.start();
      }
    }

    // Keepalive to prevent Node from exiting
    if (!options?.skipKeepalive) {
      this.keepaliveInterval = setInterval(() => {}, 60000);
    }

    this.logger.info('core.daemon', 'Daemon started', {
      pid: process.pid,
      state: this.stateMachine.getState(),
    });
  }

  async stop(): Promise<void> {
    if (this.stopped) {
      return;
    }
    this.stopped = true;

    if (this.logger) {
      this.logger.info('core.daemon', 'Daemon shutting down');
    }

    // Stop IPC server
    if (this.ipcServer) {
      await this.ipcServer.stop();
    }

    // Stop discovery
    if (this.discoveryService) {
      this.discoveryService.stop();
    }

    // Stop WebSocket server
    if (this.wsServer) {
      await this.wsServer.stop();
    }

    // Stop WebDAV server
    if (this.webdavDisconnectTimer) {
      clearTimeout(this.webdavDisconnectTimer);
      this.webdavDisconnectTimer = undefined;
    }
    if (this.webdavServer) {
      await this.webdavServer.stop();
    }

    // Shutdown protocol handlers
    if (this.filesystemHandler) {
      this.filesystemHandler.destroy();
    }
    if (this.galleryHandler) {
      this.galleryHandler.destroy();
    }
    if (this.fsWatchEventHandler) {
      this.fsWatchEventHandler.destroy();
    }
    if (this.eventHandler) {
      this.eventHandler.destroy();
    }
    if (this.enhancedSyncHandler) {
      this.enhancedSyncHandler.destroy();
    }

    // Clear reconnect timers
    for (const [, timer] of this.reconnectTimers) {
      clearInterval(timer);
    }
    this.reconnectTimers.clear();

    // Close database
    if (this.databaseService) {
      this.databaseService.close();
    }

    // Cleanup pairing handler timers
    if (this.pairingHandler) {
      this.pairingHandler.cleanup();
    }

    // Clear keepalive
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = undefined;
    }

    // Remove PID file
    if (this.pidPath) {
      try {
        if (fs.existsSync(this.pidPath)) {
          fs.unlinkSync(this.pidPath);
        }
      } catch {
        // Best effort cleanup
      }
    }

    // Destroy state machine
    if (this.stateMachine) {
      this.stateMachine.destroy();
    }

    // Flush and reset logger
    await shutdownLogger();
    resetLogger();
  }

  // --- Public accessors ---

  getStatus(): DaemonStatus {
    if (!this.stateMachine || !this.config) {
      throw new DaemonError(
        ErrorCode.DAEMON_NOT_RUNNING,
        'Daemon not initialized',
      );
    }

    return {
      state: this.stateMachine.getState(),
      pid: process.pid,
      uptime: this.stateMachine.getContext().uptime,
      config: this.config,
    };
  }

  getStateMachine(): StateMachine {
    if (!this.stateMachine) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.stateMachine;
  }

  getConfig(): DaemonConfig {
    if (!this.config) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.config;
  }

  getWsServer(): WsServer {
    if (!this.wsServer) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.wsServer;
  }

  getDiscoveryService(): WsDiscoveryService {
    if (!this.discoveryService) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.discoveryService;
  }

  getPairingHandler(): PairingHandler {
    if (!this.pairingHandler) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.pairingHandler;
  }

  getDatabaseService(): DatabaseService {
    if (!this.databaseService) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.databaseService;
  }

  getSmsHandler(): SmsHandler {
    if (!this.smsHandler) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.smsHandler;
  }

  getContactsHandler(): ContactsHandler {
    if (!this.contactsHandler) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.contactsHandler;
  }

  getNotificationHandler(): NotificationHandler {
    if (!this.notificationHandler) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.notificationHandler;
  }

  getEnhancedSyncHandler(): EnhancedSyncHandler {
    if (!this.enhancedSyncHandler) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.enhancedSyncHandler;
  }

  getEventHandler(): EventHandler {
    if (!this.eventHandler) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.eventHandler;
  }

  getGalleryEventHandler(): GalleryEventHandler {
    if (!this.galleryEventHandler) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.galleryEventHandler;
  }

  getFsWatchEventHandler(): FsWatchEventHandler {
    if (!this.fsWatchEventHandler) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.fsWatchEventHandler;
  }

  // --- WebDAV / Filesystem ---

  getFilesystemHandler(): FilesystemHandler {
    if (!this.filesystemHandler) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.filesystemHandler;
  }

  async startWebdav(): Promise<{ port: number; url: string }> {
    if (this.webdavServer?.isRunning()) {
      return { port: this.webdavServer.getPort(), url: this.webdavServer.getMountUrl() };
    }

    if (!this.filesystemHandler) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }

    this.webdavServer = new WebdavServer({ fs: this.filesystemHandler });
    const { port } = await this.webdavServer.start();
    this.logger!.info('core.daemon', 'WebDAV server started', { port });
    return { port, url: this.webdavServer.getMountUrl() };
  }

  async stopWebdav(): Promise<void> {
    if (this.webdavServer) {
      await this.webdavServer.stop();
      this.webdavServer = undefined;
      this.logger!.info('core.daemon', 'WebDAV server stopped');
    }
  }

  getWebdavStatus(): { running: boolean; port: number; url: string } {
    if (this.webdavServer?.isRunning()) {
      return { running: true, port: this.webdavServer.getPort(), url: this.webdavServer.getMountUrl() };
    }
    return { running: false, port: 0, url: '' };
  }

  // --- Gallery ---

  getGalleryHandler(): GalleryHandler {
    if (!this.galleryHandler) {
      throw new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'Daemon not initialized');
    }
    return this.galleryHandler;
  }

  async requestGalleryScan(): Promise<GalleryItem[]> {
    return this.getGalleryHandler().scan();
  }

  async requestGalleryThumbnail(filePath: string): Promise<{ localPath: string; failed: boolean }> {
    const result = await this.getGalleryHandler().getThumbnail(filePath);
    return { localPath: result.localPath, failed: result.failed };
  }

  async downloadGalleryFile(filePath: string, expectedSize: number): Promise<string> {
    const cache = this.getGalleryHandler()['cache'] as import('../gallery/gallery-cache.js').GalleryCache;
    const cached = cache.getFullFilePath(filePath);
    if (cached) return cached;

    const fs = this.getFilesystemHandler();
    const ext = filePath.substring(filePath.lastIndexOf('.'));
    const chunks: Buffer[] = [];
    let offset = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await fs.read(filePath, offset, 1_048_576);
      chunks.push(result.data);
      offset += result.bytesRead;

      // Broadcast download progress
      if (expectedSize > 0) {
        const progress = Math.min(100, Math.round((offset / expectedSize) * 100));
        this.ipcServer?.broadcast(createNotification('gallery.download_progress', { path: filePath, progress }));
      }

      if (result.eof) break;
    }

    const fullBuffer = Buffer.concat(chunks);
    return cache.storeFullFile(filePath, fullBuffer, ext);
  }

  openGallery(): void {
    this.getGalleryHandler().openGallery();
  }

  closeGallery(): void {
    this.getGalleryHandler().closeGallery();
  }

  // --- Filesystem watch ---

  async watchPath(dirPath: string): Promise<void> {
    await this.getFilesystemHandler().watch(dirPath);
  }

  async unwatchPath(dirPath: string): Promise<void> {
    await this.getFilesystemHandler().unwatch(dirPath);
  }

  // --- Battery ---

  getBattery(): { charge: number; charging: boolean } {
    return { charge: this.batteryCharge, charging: this.batteryCharging };
  }

  onBattery(cb: BatteryCallback): void {
    this.batteryCallbacks.push(cb);
  }

  requestBattery(connection: DeviceConnection): void {
    connection.send(MSG_BATTERY_REQUEST, {});
  }

  // --- URL sharing ---

  onUrlShare(cb: UrlShareCallback): void {
    this.urlShareCallbacks.push(cb);
  }

  // --- Storage analysis ---

  requestStorageAnalysis(): Promise<Record<string, unknown>> {
    const devices = this.wsServer!.getConnectedDeviceIds();
    if (devices.length === 0) {
      return Promise.reject(new Error('No device connected'));
    }
    const conn = this.wsServer!.getConnection(devices[0]!);
    if (!conn) {
      return Promise.reject(new Error('No device connected'));
    }

    // Cancel any pending request
    if (this.storageAnalysisReject) {
      this.storageAnalysisReject(new Error('Cancelled by new request'));
      if (this.storageAnalysisTimeout) {
        clearTimeout(this.storageAnalysisTimeout);
      }
    }

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.storageAnalysisResolve = resolve;
      this.storageAnalysisReject = reject;
      this.storageAnalysisTimeout = setTimeout(() => {
        this.storageAnalysisResolve = undefined;
        this.storageAnalysisReject = undefined;
        this.storageAnalysisTimeout = undefined;
        reject(new Error('Storage analysis timed out (60s)'));
      }, 60000);

      conn.send(MSG_STORAGE_REQUEST, {});
      this.logger!.info('core.daemon', 'Storage analysis requested from phone');
    });
  }

  // --- Contact migration ---

  requestContactMigrationScan(): Promise<Record<string, unknown>> {
    const devices = this.wsServer!.getConnectedDeviceIds();
    if (devices.length === 0) {
      return Promise.reject(new Error('No device connected'));
    }
    const conn = this.wsServer!.getConnection(devices[0]!);
    if (!conn) {
      return Promise.reject(new Error('No device connected'));
    }

    // Cancel any pending request
    if (this.contactMigrationReject) {
      this.contactMigrationReject(new Error('Cancelled by new request'));
      if (this.contactMigrationTimeout) {
        clearTimeout(this.contactMigrationTimeout);
      }
    }

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.contactMigrationResolve = resolve;
      this.contactMigrationReject = reject;
      this.contactMigrationTimeout = setTimeout(() => {
        this.contactMigrationResolve = undefined;
        this.contactMigrationReject = undefined;
        this.contactMigrationTimeout = undefined;
        reject(new Error('Contact migration scan timed out (30s)'));
      }, 30000);

      conn.send(MSG_CONTACTS_MIGRATION_SCAN, {});
      this.logger!.info('core.daemon', 'Contact migration scan requested from phone');
    });
  }

  requestContactMigrationExecute(rawContactIds: number[], targetAccount: string): Promise<Record<string, unknown>> {
    const devices = this.wsServer!.getConnectedDeviceIds();
    if (devices.length === 0) {
      return Promise.reject(new Error('No device connected'));
    }
    const conn = this.wsServer!.getConnection(devices[0]!);
    if (!conn) {
      return Promise.reject(new Error('No device connected'));
    }

    // Cancel any pending request
    if (this.contactMigrationReject) {
      this.contactMigrationReject(new Error('Cancelled by new request'));
      if (this.contactMigrationTimeout) {
        clearTimeout(this.contactMigrationTimeout);
      }
    }

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.contactMigrationResolve = resolve;
      this.contactMigrationReject = reject;
      this.contactMigrationTimeout = setTimeout(() => {
        this.contactMigrationResolve = undefined;
        this.contactMigrationReject = undefined;
        this.contactMigrationTimeout = undefined;
        reject(new Error('Contact migration execute timed out (120s)'));
      }, 120000);

      conn.send(MSG_CONTACTS_MIGRATION_EXECUTE, { rawContactIds, targetAccount });
      this.logger!.info('core.daemon', 'Contact migration execute requested from phone', {
        contactCount: rawContactIds.length,
        targetAccount,
      });
    });
  }

  // --- Sync ---

  startSync(): void {
    if (this.enhancedSyncHandler) {
      this.enhancedSyncHandler.startSync();
    }
  }

  // --- Internal ---

  /**
   * On startup, send directed discovery to known paired devices.
   * The phone will hear our discovery and connect to our WebSocket server.
   */
  private connectKnownDevices(): void {
    const knownDevices = loadKnownDevices();
    if (knownDevices.length === 0) return;

    for (const device of knownDevices) {
      if (this.pairingHandler!.isPaired(device.deviceId)) {
        this.logger!.info('core.daemon', 'Sending discovery to known device', {
          deviceId: device.deviceId,
          address: device.address,
          port: device.port,
        });
        // Send connect request so phone auto-connects to our WebSocket server
        // Don't pass device.port (it's WS port) — let sendConnectRequest use UDP default (1716)
        this.discoveryService!.sendConnectRequest(device.address);
      }
    }
  }

  /**
   * Start a reconnect timer for a known paired device.
   * Sends directed UDP discovery every 15 seconds to trigger
   * the phone to connect to our WebSocket server.
   */
  private startReconnectTimer(deviceId: string): void {
    if (this.reconnectTimers.has(deviceId)) return;

    const knownDevices = loadKnownDevices();
    const known = knownDevices.find((d) => d.deviceId === deviceId);
    if (!known) return;

    if (!this.pairingHandler!.isPaired(deviceId)) return;

    this.logger!.info('core.daemon', 'Starting reconnect timer', {
      deviceId,
      address: known.address,
      intervalMs: 15000,
    });

    const timer = setInterval(() => {
      if (this.stopped) {
        this.clearReconnectTimer(deviceId);
        return;
      }

      if (this.wsServer!.getConnection(deviceId)) {
        this.clearReconnectTimer(deviceId);
        return;
      }

      this.logger!.debug('core.daemon', 'Reconnect attempt via connect request', {
        deviceId,
        address: known.address,
      });
      this.discoveryService!.sendConnectRequest(known.address);
    }, 15000);

    this.reconnectTimers.set(deviceId, timer);
  }

  private clearReconnectTimer(deviceId: string): void {
    const timer = this.reconnectTimers.get(deviceId);
    if (timer) {
      clearInterval(timer);
      this.reconnectTimers.delete(deviceId);
      this.logger?.debug('core.daemon', 'Reconnect timer cleared', { deviceId });
    }
  }

  private checkStalePid(): void {
    if (!this.pidPath || !fs.existsSync(this.pidPath)) {
      return;
    }

    const pidStr = fs.readFileSync(this.pidPath, 'utf-8').trim();
    const pid = parseInt(pidStr, 10);

    if (isNaN(pid)) {
      return;
    }

    try {
      process.kill(pid, 0);
      throw new DaemonError(
        ErrorCode.DAEMON_ALREADY_RUNNING,
        `Daemon already running with PID ${pid}`,
        { pid },
      );
    } catch (err) {
      if (err instanceof DaemonError) {
        throw err;
      }
    }
  }
}
