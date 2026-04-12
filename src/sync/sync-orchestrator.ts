/**
 * Sync Orchestrator
 *
 * State machine + operation queue that drives the entire sync lifecycle.
 * Coordinates thread sync, contact sync, message sync, and on-demand
 * thread sync when the user opens a conversation.
 *
 * States: DISCONNECTED → CONNECTED → THREAD_SYNC → MESSAGE_SYNC → READY
 *
 * All operations are sequential — one at a time. Priority interrupts
 * (user opens a thread) pause the current queue, run the priority op,
 * then resume.
 */

import type { QueryClient } from './query-client.js';
import type { EventListener } from './event-listener.js';
import type { DatabaseService, ConversationRow } from '../database/database.js';
import { threadListSync } from './operations/thread-list-sync.js';
import { contactSync } from './operations/contact-sync.js';
import { quickMessageSync } from './operations/quick-message-sync.js';
import { fullThreadSync } from './operations/full-thread-sync.js';
import { debugConsole } from './debug-console.js';

// --- Types ---

export type OrchestratorState = 'disconnected' | 'connected' | 'thread_sync' | 'message_sync' | 'ready';

type NotifyCallback = (method: string, params: Record<string, unknown>) => void;

interface SyncOperation {
  name: string;
  /** If true, the UI shows "Syncing..." while this operation is active or queued. */
  showSyncing: boolean;
  run: () => Promise<void>;
}

export interface OrchestratorProgress {
  state: OrchestratorState;
  phase: string;
  percent: number | null;
  currentThread: string | null;
  /** True when any active or queued operation has showSyncing set. */
  syncing: boolean;
  /** Thread IDs that still have a pending or in-progress background full sync. */
  pendingSyncThreadIds: number[];
}

// --- Constants ---

const STALE_THRESHOLD_MS = 6 * 24 * 60 * 60 * 1000; // 6 days
const MAX_QUICK_SYNC_WINDOW_MS = 90 * 24 * 60 * 60 * 1000; // 3 months
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export class SyncOrchestrator {
  private queryClient: QueryClient;
  private eventListener: EventListener;
  private db: DatabaseService;
  private notify: NotifyCallback;

  private _state: OrchestratorState = 'disconnected';
  private queue: SyncOperation[] = [];
  private currentOp: SyncOperation | null = null;
  private aborted = false;
  private paused = false;
  private running = false;

  // Progress tracking
  private currentThreadName: string | null = null;

  // Background full sync progress — total is set once when queued, never reset during interrupts
  private bgFullSyncTotal = 0;
  private bgFullSyncCompleted = 0;

  // Priority thread sync
  private priorityThreadId: number | null = null;

  // Currently open thread (for count verification on reconnect)
  private openThreadId: number | null = null;

  // State transition history for debug
  private stateHistory: Array<{ from: string; to: string; time: number }> = [];

  constructor(
    queryClient: QueryClient,
    eventListener: EventListener,
    db: DatabaseService,
    notify: NotifyCallback,
  ) {
    this.queryClient = queryClient;
    this.eventListener = eventListener;
    this.db = db;
    this.notify = notify;
  }

  // --- Public API ---

  get state(): OrchestratorState {
    return this._state;
  }

  get progress(): OrchestratorProgress {
    const anySyncing = (this.currentOp?.showSyncing ?? false) ||
      this.queue.some(op => op.showSyncing);

    // Background full sync percentage: completed / peak total
    const percent = this.bgFullSyncTotal > 0
      ? Math.round((this.bgFullSyncCompleted / this.bgFullSyncTotal) * 100)
      : null;

    // Collect thread IDs with pending background full syncs
    const pendingIds: number[] = [];
    if (this.currentOp?.name.startsWith('bg_full_sync_')) {
      pendingIds.push(parseInt(this.currentOp.name.replace('bg_full_sync_', ''), 10));
    }
    for (const op of this.queue) {
      if (op.name.startsWith('bg_full_sync_')) {
        pendingIds.push(parseInt(op.name.replace('bg_full_sync_', ''), 10));
      }
    }

    return {
      state: this._state,
      phase: this.currentOp?.name ?? '',
      percent,
      currentThread: this.currentThreadName,
      syncing: anySyncing,
      pendingSyncThreadIds: pendingIds,
    };
  }

  /** Called when a phone connects (after pairing/identity exchange). */
  onConnected(): void {
    this.setState('connected');
    this.aborted = false;
    this.paused = false;

    debugConsole.narrative('Phone connected — starting sync');

    // Mark stale threads (fully synced > 6 days ago)
    const staleCount = this.db.markStaleThreads(STALE_THRESHOLD_MS);
    if (staleCount > 0) {
      debugConsole.narrative(`Marked ${staleCount} threads as stale (>6 days since last full sync)`);
    }

    // Queue the sync phases
    this.queue.length = 0;
    this.queue.push({ name: 'thread_sync', showSyncing: true, run: () => this.runThreadSync() });
    this.queue.push({ name: 'contact_sync', showSyncing: true, run: () => this.runContactSync() });
    this.queue.push({ name: 'message_sync', showSyncing: true, run: () => this.runBatchMessageSync() });

    // If a thread was open during disconnect, verify its count after syncs complete
    if (this.openThreadId !== null) {
      this.queueCountVerification(this.openThreadId);
    }

    // Tell event listener that sync is starting
    this.eventListener.setSyncActive(true);

    this.drainQueue();
  }

  /** Called when the phone disconnects. */
  onDisconnected(): void {
    this.aborted = true;
    this.queue.length = 0;
    this.currentOp = null;
    this.bgFullSyncTotal = 0;
    this.bgFullSyncCompleted = 0;
    this.currentThreadName = null;
    this.priorityThreadId = null;
    this.eventListener.setSyncActive(false);
    this.setState('disconnected');

    debugConsole.narrative('Phone disconnected');
  }

  /** Called when the user opens a thread. */
  onThreadOpened(threadId: number): void {
    this.openThreadId = threadId;
    if (this._state === 'disconnected') return;

    const conv = this.db.getConversation(threadId);
    if (!conv) return;

    const threadName = conv.addresses ?? String(threadId);

    // Remove any pending background full sync for this thread (avoid duplicate work)
    this.queue = this.queue.filter(op => op.name !== `bg_full_sync_${threadId}`);

    // Check if thread needs full sync
    const needsFullSync = conv.full_sync_complete === 0;
    // Check if thread is stale (was fully synced but > 6 days ago)
    const isStale = conv.full_sync_complete === 1 &&
      conv.full_sync_date > 0 &&
      (Date.now() - conv.full_sync_date) > STALE_THRESHOLD_MS;

    if (needsFullSync) {
      debugConsole.narrative(`User opened thread ${threadId} (${threadName}) — full sync required (never synced)`);
      this.priorityThreadId = threadId;
      this.insertPriorityOp({
        name: `full_thread_sync_${threadId}`,
        showSyncing: true, // First-time full sync — user expects incomplete data
        run: () => this.runFullThreadSync(threadId, true),
      });
    } else if (isStale) {
      debugConsole.narrative(`User opened thread ${threadId} (${threadName}) — silent resync (stale)`);
      this.priorityThreadId = threadId;
      this.insertPriorityOp({
        name: `stale_resync_${threadId}`,
        showSyncing: false, // Silent — user already has recent messages
        run: () => this.runFullThreadSync(threadId, false),
      });
    } else {
      // Thread is current — do a quick 1-week sync, then verify count after all syncs settle
      debugConsole.log('query', 'sync', `Thread ${threadId} opened — quick sync + count verification`);
      const sinceDate = Date.now() - ONE_WEEK_MS;
      this.queue.unshift({
        name: `quick_sync_${threadId}`,
        showSyncing: false,
        run: async () => {
          await quickMessageSync(this.queryClient, this.db, threadId, sinceDate);
          this.notify('sms.messages', { threadId });
        },
      });
      // Count verification appended to end — runs after all in-flight syncs complete
      this.queueCountVerification(threadId);
      if (!this.running) this.drainQueue();
    }
  }

  /** Called when user leaves a thread. Aborts priority sync if it was for that thread. */
  onThreadClosed(): void {
    this.openThreadId = null;
    if (this.priorityThreadId !== null) {
      const wasId = this.priorityThreadId;
      this.priorityThreadId = null;
      // If we're currently running the priority op for this thread, abort it
      if (this.currentOp?.name.includes(`_${wasId}`)) {
        debugConsole.log('query', 'sync', `Thread ${wasId} closed — aborting priority sync`);
        this.aborted = true;
      }
    }
  }

  /** Full resync: wipe state and restart. */
  resync(): void {
    this.aborted = true;
    this.queue.length = 0;
    this.currentOp = null;
    this.eventListener.setSyncActive(false);

    // The caller (daemon.resync) handles DB wipe. We just restart the sequence.
    setTimeout(() => {
      this.aborted = false;
      this.onConnected();
    }, 100);
  }

  /** Pause the queue (debug). */
  pause(): void {
    this.paused = true;
    debugConsole.narrative('Orchestrator paused');
  }

  /** Resume the queue (debug). */
  resume(): void {
    this.paused = false;
    debugConsole.narrative('Orchestrator resumed');
    if (!this.running) this.drainQueue();
  }

  /** Abort current operation (debug). */
  abort(): void {
    this.aborted = true;
    debugConsole.narrative('Current operation aborted');
  }

  /** Get state transition history (debug). */
  getStateHistory(): Array<{ from: string; to: string; time: number }> {
    return [...this.stateHistory];
  }

  /** Get queue info (debug). */
  getQueueInfo(): { current: string | null; queued: string[] } {
    return {
      current: this.currentOp?.name ?? null,
      queued: this.queue.map(op => op.name),
    };
  }

  // --- Internal ---

  private setState(state: OrchestratorState): void {
    const from = this._state;
    this._state = state;
    this.stateHistory.push({ from, to: state, time: Date.now() });
    // Keep history bounded
    if (this.stateHistory.length > 50) this.stateHistory.shift();

    // Notify UI of state change
    this.emitProgress();
  }

  private emitProgress(): void {
    this.notify('sync.orchestrator.progress', this.progress as unknown as Record<string, unknown>);
  }

  private async drainQueue(): Promise<void> {
    if (this.running || this.paused) return;
    this.running = true;

    while (this.queue.length > 0 && !this.paused) {
      const op = this.queue.shift()!;
      this.currentOp = op;
      this.aborted = false;
      this.emitProgress();

      try {
        await op.run();
      } catch (err) {
        if (!this.aborted) {
          debugConsole.log('query', 'error',
            `Operation ${op.name} failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      this.currentOp = null;
      this.emitProgress();

      if (this.aborted) {
        // If aborted, don't continue queue (disconnect or priority interrupt)
        break;
      }
    }

    this.running = false;

    // If we finished all ops and weren't disconnected, we're ready
    if (this.queue.length === 0 && this._state !== 'disconnected' && !this.paused) {
      // Check for threads flagged by real-time events during sync
      const flaggedThreads = this.eventListener.getAndClearFlaggedThreads();
      if (flaggedThreads.length > 0) {
        debugConsole.narrative(`Processing ${flaggedThreads.length} thread(s) flagged during sync`);
        for (const threadId of flaggedThreads) {
          const conv = this.db.getConversation(threadId);
          const window = this.getQuickSyncWindow(conv);
          this.queue.push({
            name: `flagged_sync_${threadId}`,
            showSyncing: false,
            run: async () => {
              await quickMessageSync(this.queryClient, this.db, threadId, Date.now() - window);
              this.notify('sms.messages', { threadId });
              this.notify('sms.conversations_updated', {});
            },
          });
        }
        // Recurse to process flagged threads
        void this.drainQueue();
        return;
      }

      this.eventListener.setSyncActive(false);
      this.setState('ready');
      debugConsole.narrative('Ready');
      this.notify('sms.conversations_updated', {});
    }
  }

  private insertPriorityOp(op: SyncOperation): void {
    // Abort current operation if running
    if (this.running) {
      this.aborted = true;
    }

    // Insert at front of queue
    this.queue.unshift(op);

    // Restart queue processing after current op yields
    if (!this.running) {
      this.drainQueue();
    } else {
      // The abort will cause drainQueue's loop to break, then we restart
      setTimeout(() => {
        this.aborted = false;
        if (!this.running) this.drainQueue();
      }, 50);
    }
  }

  // --- Sync phase implementations ---

  private async runThreadSync(): Promise<void> {
    this.setState('thread_sync');
    await threadListSync(this.queryClient, this.db);

    // Flush pending operations queued while disconnected
    await this.flushPendingOperations();

    // Sync filter list from phone
    debugConsole.narrative('Synchronizing filter list...');
    const filterItems = await this.queryClient.query('filter.list');
    const numbers = (filterItems as Array<{ number: string }>).map(i => i.number);
    this.notify('filter.list_synced', { numbers });
    debugConsole.narrative(`Filter list synced — ${numbers.length} numbers`);

    // Sync read overrides from phone
    debugConsole.narrative('Synchronizing read state...');
    const readItems = await this.queryClient.query('read.list');
    const overrides = readItems as Array<{ threadId: number; readAt: number }>;
    for (const { threadId, readAt } of overrides) {
      const conv = this.db.getConversation(threadId);
      if (conv && (conv.locally_read_at === null || readAt > conv.locally_read_at)) {
        this.db.markThreadLocallyRead(threadId);
      }
    }
    debugConsole.narrative(`Read state synced — ${overrides.length} overrides`);

    this.notify('sms.conversations_updated', {});
  }

  /** Flush pending operations that were queued while disconnected. */
  private async flushPendingOperations(): Promise<void> {
    const ops = this.db.getPendingOperations();
    if (ops.length === 0) return;

    debugConsole.narrative(`Flushing ${ops.length} pending operations...`);

    for (const op of ops) {
      try {
        if (op.op_type === 'filter.set') {
          await this.queryClient.query('filter.set', op.payload);
        } else if (op.op_type === 'read.set') {
          await this.queryClient.query('read.set', op.payload);
        }
        this.db.removePendingOperation(op.id);
      } catch (err) {
        debugConsole.log('query', 'error',
          `Failed to flush operation ${op.op_type}: ${err instanceof Error ? err.message : String(err)}`);
        break; // Stop on first failure — will retry on next connect
      }
    }

    debugConsole.narrative('Pending operations flushed');
  }

  private async runContactSync(): Promise<void> {
    await contactSync(this.queryClient, this.db);
    this.notify('contacts.updated', {});
  }

  private async runBatchMessageSync(): Promise<void> {
    this.setState('message_sync');

    const conversations = this.db.getAllConversations();
    const now = Date.now();

    // Determine if initial sync has ever been completed
    const initialComplete = this.db.getSyncState('initial_sync_complete') === '1';

    // Filter to threads with activity in the last month (or all on first sync)
    const threadsToSync = conversations.filter(c => {
      if (!initialComplete) return (now - c.date) < ONE_MONTH_MS;
      return (now - c.date) < ONE_MONTH_MS;
    });

    // Sort by most recent first
    threadsToSync.sort((a, b) => b.date - a.date);

    debugConsole.narrative(
      `Synchronizing messages — ${threadsToSync.length} threads with activity in last month`,
    );

    for (const conv of threadsToSync) {
      if (this.aborted) break;

      const window = this.getQuickSyncWindow(conv);
      const sinceDate = now - window;
      this.currentThreadName = conv.addresses ?? String(conv.thread_id);

      await quickMessageSync(this.queryClient, this.db, conv.thread_id, sinceDate);
      this.notify('sms.messages', { threadId: conv.thread_id });
    }

    if (!this.aborted) {
      // Mark initial sync as complete
      if (!initialComplete) {
        this.db.setSyncState('initial_sync_complete', '1');
        this.db.setSyncState('initial_sync_date', String(now));
        debugConsole.narrative('Initial sync complete');
      }

      this.currentThreadName = null;
      debugConsole.narrative('Quick sync complete');
      this.notify('sms.conversations_updated', {});

      // Queue background full syncs for threads that still need one
      this.queueBackgroundFullSyncs();
    }
  }

  /**
   * Queue individual full thread syncs for all threads that haven't been
   * fully synced yet (or are stale). Each is a separate queue entry so
   * they're individually abortable when the user opens a thread.
   * Sorted by most recent message first.
   *
   * Sets bgFullSyncTotal once — this total is never reduced during
   * priority interrupts so the progress percentage appears continuous.
   */
  private queueBackgroundFullSyncs(): void {
    const conversations = this.db.getAllConversations();
    const needsFullSync = conversations.filter(c => c.full_sync_complete === 0);

    if (needsFullSync.length === 0) return;

    // Sort by most recent message first
    needsFullSync.sort((a, b) => b.date - a.date);

    // Set the peak total — this number stays fixed for progress calculation
    this.bgFullSyncTotal = needsFullSync.length;
    this.bgFullSyncCompleted = 0;

    debugConsole.narrative(
      `Synchronizing full history — ${needsFullSync.length} threads (most recent first)`,
    );

    for (const conv of needsFullSync) {
      const threadId = conv.thread_id;
      this.queue.push({
        name: `bg_full_sync_${threadId}`,
        showSyncing: true,
        run: async () => {
          await fullThreadSync(this.queryClient, this.db, threadId);
          this.bgFullSyncCompleted++;
          this.notify('sms.messages', { threadId });
        },
      });
    }
  }

  private async runFullThreadSync(threadId: number, showBanner: boolean): Promise<void> {
    if (showBanner) {
      this.notify('sync.thread_sync_start', { threadId });
    }

    await fullThreadSync(this.queryClient, this.db, threadId);

    // Count this toward background full sync progress if bg syncs are in progress
    if (this.bgFullSyncTotal > 0 && this.bgFullSyncCompleted < this.bgFullSyncTotal) {
      this.bgFullSyncCompleted++;
    }

    this.notify('sms.messages', { threadId });
    this.notify('sms.conversations_updated', {});

    if (showBanner) {
      this.notify('sync.thread_sync_complete', { threadId });
    }
  }

  /**
   * Queue a count verification for a thread at the end of the queue.
   * Runs after all in-flight syncs complete. If the local message count
   * doesn't match the phone's, marks the thread for background full sync.
   */
  private queueCountVerification(threadId: number): void {
    // Don't duplicate if already queued
    if (this.queue.some(op => op.name === `count_verify_${threadId}`)) return;

    this.queue.push({
      name: `count_verify_${threadId}`,
      showSyncing: false,
      run: () => this.verifyThreadCount(threadId),
    });
  }

  private async verifyThreadCount(threadId: number): Promise<void> {
    const conv = this.db.getConversation(threadId);
    if (!conv) return;

    const threadName = conv.addresses ?? String(threadId);

    const result = await this.queryClient.query('threads.count', { threadIds: [threadId] });
    const counts = result as Array<{ threadId: number; count: number }>;
    if (counts.length === 0) return;

    const phoneCount = counts[0]!.count;
    const localIds = this.db.getMessageIdsForThread(threadId);
    const localCount = localIds.size;

    if (phoneCount !== localCount) {
      debugConsole.narrative(
        `Thread ${threadId} (${threadName}) count mismatch: local=${localCount}, phone=${phoneCount} — marking for full sync`,
      );
      this.db.markThreadStale(threadId);

      // Kick the background sync queue if it's not already running
      if (!this.queue.some(op => op.name === `bg_full_sync_${threadId}`)) {
        this.queue.push({
          name: `bg_full_sync_${threadId}`,
          showSyncing: this.bgFullSyncTotal > 0, // Match current sync indicator state
          run: async () => {
            await fullThreadSync(this.queryClient, this.db, threadId);
            if (this.bgFullSyncTotal > 0 && this.bgFullSyncCompleted < this.bgFullSyncTotal) {
              this.bgFullSyncCompleted++;
            }
            this.notify('sms.messages', { threadId });
          },
        });
        if (!this.running) void this.drainQueue();
      }
    } else {
      debugConsole.log('query', 'sync',
        `Thread ${threadId} (${threadName}) count verified: ${localCount} messages`);
    }
  }

  /** Calculate the quick-sync window for a thread. */
  private getQuickSyncWindow(conv: ConversationRow | undefined): number {
    if (!conv || conv.full_sync_date === 0) {
      return ONE_WEEK_MS; // Never synced → 1 week
    }
    const timeSinceSync = Date.now() - conv.full_sync_date;
    return Math.min(
      Math.max(ONE_WEEK_MS, timeSinceSync),
      MAX_QUICK_SYNC_WINDOW_MS,
    );
  }
}
