/**
 * Enhanced Sync Handler
 *
 * Replaces the silence-timeout SyncOrchestrator for FossLink-to-FossLink
 * connections. Uses explicit batch sync protocol:
 *
 * 1. Desktop sends fosslink.sms.sync_start { lastSyncTimestamp }
 * 2. Phone sends fosslink.sms.sync_batch { messages[], batchIndex, totalBatches }
 * 3. Desktop acks each batch with fosslink.sms.sync_ack { batchIndex, latestTimestamp }
 * 4. Phone sends fosslink.sms.sync_complete { messageCount, latestTimestamp }
 * 5. Desktop persists latestTimestamp, transitions to READY
 *
 * Contacts sync still uses the standard contacts handler (Phase 4 scope).
 * Falls back to standard sync if no response within 60 seconds.
 */

import { createLogger } from '../../utils/logger.js';
import type { Logger } from '../../utils/logger.js';
import type { StateMachine } from '../../core/state-machine.js';
import { AppState } from '../../core/state-machine.js';
import type { DaemonConfig } from '../../config/config.js';
import type { DatabaseService } from '../../database/database.js';
import type { SmsHandler } from '../standard/sms-handler.js';
import type { ContactsHandler } from '../standard/contacts-handler.js';
import type { DeviceConnection } from '../../network/ws-server.js';
import type { ProtocolMessage } from '../../network/packet.js';
import {
  MSG_SYNC_START,
  MSG_SYNC_ACK,
} from '../../network/packet.js';

export interface EnhancedSyncOptions {
  smsHandler: SmsHandler;
  contactsHandler: ContactsHandler;
  db: DatabaseService;
  stateMachine: StateMachine;
  config: DaemonConfig;
  getConnection: () => DeviceConnection | undefined;
}

type SyncCallback = () => void;
type SyncProgressCallback = (batchIndex: number, totalBatches: number) => void;

/** Safety timeout: if no batch arrives within this time after sync_start, consider sync stalled.
 *  Full syncs (lastSyncTimestamp=0) can take 2-3 minutes on phones with many messages. */
const SYNC_TIMEOUT_MS = 300_000;

export class EnhancedSyncHandler {
  private smsHandler: SmsHandler;
  private contactsHandler: ContactsHandler;
  private db: DatabaseService;
  private stateMachine: StateMachine;
  private config: DaemonConfig;
  private getConnection: () => DeviceConnection | undefined;
  private logger: Logger;

  private syncing = false;
  private destroyed = false;
  private safetyTimer: ReturnType<typeof setTimeout> | undefined;
  private resyncInterval: ReturnType<typeof setInterval> | undefined;
  /** Tracks whether we've already attempted an empty-DB recovery this session */
  private recoveryAttempted = false;

  private syncStartedCallbacks: SyncCallback[] = [];
  private syncProgressCallbacks: SyncProgressCallback[] = [];
  private syncCompleteCallbacks: SyncCallback[] = [];

  constructor(options: EnhancedSyncOptions) {
    this.smsHandler = options.smsHandler;
    this.contactsHandler = options.contactsHandler;
    this.db = options.db;
    this.stateMachine = options.stateMachine;
    this.config = options.config;
    this.getConnection = options.getConnection;
    this.logger = createLogger('enhanced-sync');
  }

  /**
   * Start an enhanced sync cycle. Sends fosslink.sms.sync_start to phone.
   */
  startSync(): void {
    if (this.destroyed) return;

    if (this.syncing) {
      this.logger.debug('protocol.enhanced-sync', 'Sync already in progress');
      return;
    }

    if (!this.stateMachine.canTransition(AppState.SYNCING)) {
      this.logger.warn('protocol.enhanced-sync', 'Cannot start sync from current state', {
        state: this.stateMachine.getState(),
      });
      return;
    }

    const conn = this.getConnection();
    if (!conn) {
      this.logger.warn('protocol.enhanced-sync', 'Cannot start sync: not connected');
      return;
    }

    this.syncing = true;
    this.clearResyncInterval();

    this.stateMachine.transition(AppState.SYNCING, { syncPhase: 'contacts' });
    this.logger.info('protocol.enhanced-sync', 'Enhanced sync started');
    this.fireSyncStarted();

    // Request contacts in parallel (same as standard sync)
    this.contactsHandler.requestAllUidsTimestamps();

    // Send enhanced sync_start with last known timestamp
    const lastSyncStr = this.db.getSyncState('lastSync');
    const lastSyncTimestamp = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;

    conn.send(MSG_SYNC_START, { lastSyncTimestamp });

    this.logger.info('protocol.enhanced-sync', 'Sent sync_start', { lastSyncTimestamp });

    // Start safety timeout
    this.resetSafetyTimer();
  }

  /**
   * Handle incoming fosslink.sms.sync_batch packet.
   * Delegates message processing to SmsHandler, sends ack.
   */
  handleSyncBatch(packet: ProtocolMessage, connection: DeviceConnection): void {
    if (!this.syncing) {
      // Auto-recover: phone sent a batch but we weren't syncing (e.g. schema wipe
      // recreated DB, or desktop restarted mid-sync). Start sync inline so we
      // don't drop the batch.
      if (!this.destroyed && this.stateMachine.canTransition(AppState.SYNCING)) {
        this.logger.warn('protocol.enhanced-sync', 'Received sync_batch while not syncing — auto-recovering');
        this.syncing = true;
        this.stateMachine.transition(AppState.SYNCING, { syncPhase: 'conversations' });
        this.fireSyncStarted();
        this.contactsHandler.requestAllUidsTimestamps();
      } else {
        this.logger.warn('protocol.enhanced-sync', 'Received sync_batch but cannot start syncing', {
          destroyed: this.destroyed,
          state: this.stateMachine.getState(),
        });
        return;
      }
    }

    const batchIndex = packet.body['batchIndex'] as number;
    const totalBatches = packet.body['totalBatches'] as number;
    const messages = packet.body['messages'] as unknown[];

    this.logger.info('protocol.enhanced-sync', 'Received sync batch', {
      batchIndex,
      totalBatches,
      messageCount: Array.isArray(messages) ? messages.length : 0,
    });

    // Reset safety timer on each batch
    this.resetSafetyTimer();

    // Delegate message processing to the standard SMS handler.
    // The messages are in the same format as standard sms.messages packets.
    if (Array.isArray(messages) && messages.length > 0) {
      this.smsHandler.handleMessages(
        { ...packet, body: { messages } },
        connection,
      );
    }

    // Send ack
    const conn = this.getConnection();
    if (conn) {
      conn.send(MSG_SYNC_ACK, {
        batchIndex,
        latestTimestamp: Date.now(),
      });
    }

    // Fire progress callback
    this.fireSyncProgress(batchIndex, totalBatches);
  }

  /**
   * Handle incoming fosslink.sms.sync_complete packet.
   * Persists sync timestamp and transitions to READY.
   */
  handleSyncComplete(packet: ProtocolMessage): void {
    if (!this.syncing) {
      this.logger.warn('protocol.enhanced-sync', 'Received sync_complete but not syncing');
      return;
    }

    const messageCount = packet.body['messageCount'] as number;
    const latestTimestamp = packet.body['latestTimestamp'] as number;

    this.syncing = false;
    this.clearSafetyTimer();

    // Persist the latest timestamp for next incremental sync
    if (typeof latestTimestamp === 'number' && latestTimestamp > 0) {
      this.db.setSyncState('lastSync', latestTimestamp.toString());
    } else {
      this.db.setSyncState('lastSync', Date.now().toString());
    }

    // Transition to READY
    if (this.stateMachine.canTransition(AppState.READY)) {
      this.stateMachine.transition(AppState.READY);
    }

    this.logger.info('protocol.enhanced-sync', 'Enhanced sync complete', {
      messageCount,
      latestTimestamp,
    });

    this.fireSyncComplete();

    // Recovery: if sync completed but DB is empty, the phone likely sent a delta
    // sync (0 new messages) against a wiped database. Clear lastSync and trigger
    // a full re-sync. Guard with recoveryAttempted to prevent infinite loops.
    if (!this.recoveryAttempted && this.db.getConversationCount() === 0) {
      this.recoveryAttempted = true;
      this.logger.warn('protocol.enhanced-sync', 'Sync completed but database is empty — scheduling full re-sync');
      this.db.setSyncState('lastSync', '0');
      setTimeout(() => {
        if (!this.destroyed) {
          this.startSync();
        }
      }, 2000);
      return;
    }

    this.startResyncInterval();
  }

  /**
   * Stop an in-progress sync. Clears all timers.
   */
  stopSync(): void {
    const wasSyncing = this.syncing;
    this.syncing = false;
    this.recoveryAttempted = false;
    this.clearSafetyTimer();
    this.clearResyncInterval();

    if (wasSyncing) {
      this.logger.info('protocol.enhanced-sync', 'Sync stopped');
    }
  }

  /**
   * Clean up all resources. Call on daemon shutdown.
   */
  destroy(): void {
    this.destroyed = true;
    this.stopSync();
    this.syncStartedCallbacks = [];
    this.syncProgressCallbacks = [];
    this.syncCompleteCallbacks = [];
  }

  isSyncing(): boolean {
    return this.syncing;
  }

  // --- Callbacks ---

  onSyncStarted(cb: SyncCallback): void {
    this.syncStartedCallbacks.push(cb);
  }

  onSyncProgress(cb: SyncProgressCallback): void {
    this.syncProgressCallbacks.push(cb);
  }

  onSyncComplete(cb: SyncCallback): void {
    this.syncCompleteCallbacks.push(cb);
  }

  // --- Internal ---

  private resetSafetyTimer(): void {
    this.clearSafetyTimer();

    if (!this.syncing || this.destroyed) return;

    this.safetyTimer = setTimeout(() => {
      this.onSafetyTimeout();
    }, SYNC_TIMEOUT_MS);
  }

  private clearSafetyTimer(): void {
    if (this.safetyTimer) {
      clearTimeout(this.safetyTimer);
      this.safetyTimer = undefined;
    }
  }

  private onSafetyTimeout(): void {
    if (!this.syncing || this.destroyed) return;

    this.logger.warn('protocol.enhanced-sync', 'Safety timeout — no batch received within 5 minutes');

    this.syncing = false;
    this.clearSafetyTimer();

    // Record current time as sync timestamp (best effort)
    this.db.setSyncState('lastSync', Date.now().toString());

    // Transition to READY if possible
    if (this.stateMachine.canTransition(AppState.READY)) {
      this.stateMachine.transition(AppState.READY);
    }

    this.fireSyncComplete();

    // Recovery: if DB is still empty after timeout, force a full re-sync
    if (!this.recoveryAttempted && this.db.getConversationCount() === 0) {
      this.recoveryAttempted = true;
      this.logger.warn('protocol.enhanced-sync', 'Safety timeout with empty database — scheduling full re-sync');
      this.db.setSyncState('lastSync', '0');
      setTimeout(() => {
        if (!this.destroyed) {
          this.startSync();
        }
      }, 2000);
      return;
    }

    this.startResyncInterval();
  }

  private startResyncInterval(): void {
    this.clearResyncInterval();

    if (this.destroyed || !this.config.sync.autoSync) return;

    this.resyncInterval = setInterval(() => {
      if (this.destroyed) {
        this.clearResyncInterval();
        return;
      }

      if (this.stateMachine.getState() === AppState.READY) {
        this.logger.info('protocol.enhanced-sync', 'Periodic re-sync triggered');
        this.startSync();
      }
    }, this.config.sync.syncInterval);
  }

  private clearResyncInterval(): void {
    if (this.resyncInterval) {
      clearInterval(this.resyncInterval);
      this.resyncInterval = undefined;
    }
  }

  private fireSyncStarted(): void {
    for (const cb of this.syncStartedCallbacks) {
      cb();
    }
  }

  private fireSyncProgress(batchIndex: number, totalBatches: number): void {
    for (const cb of this.syncProgressCallbacks) {
      cb(batchIndex, totalBatches);
    }
  }

  private fireSyncComplete(): void {
    for (const cb of this.syncCompleteCallbacks) {
      cb();
    }
  }
}
