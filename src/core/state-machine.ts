/**
 * Application State Machine
 *
 * Single source of truth for application state. All state transitions
 * are validated against the transition map. Invalid transitions throw.
 *
 * States: INIT, DISCONNECTED, DISCOVERING, PAIRING, CONNECTED, SYNCING, READY, ERROR
 */

import { ErrorCode, StateError } from './errors.js';
import type { Logger } from '../utils/logger.js';
import { createLogger } from '../utils/logger.js';

export enum AppState {
  INIT = 'INIT',
  DISCONNECTED = 'DISCONNECTED',
  DISCOVERING = 'DISCOVERING',
  PAIRING = 'PAIRING',
  CONNECTED = 'CONNECTED',
  SYNCING = 'SYNCING',
  READY = 'READY',
  ERROR = 'ERROR',
}

export interface StateContext {
  deviceId?: string;
  deviceName?: string;
  errorCode?: ErrorCode;
  errorMessage?: string;
  previousState?: AppState;
  syncPhase?: 'conversations' | 'messages' | 'contacts' | 'attachments';
  pairingDeviceId?: string;
  pairingDeviceName?: string;
  peerClientType?: string;
  peerClientVersion?: string;
  peerMinPeerVersion?: string;
  versionCompatible?: boolean;
  peerTooOld?: boolean;
  selfTooOld?: boolean;
  peerRootEnabled?: boolean;
  peerStorageTotalBytes?: number;
  peerStorageFreeBytes?: number;
  lastTransitionTime: number;
  uptime: number;
}

export interface StateTransition {
  from: AppState;
  to: AppState;
  context: Readonly<StateContext>;
  timestamp: number;
}

export type StateListener = (transition: StateTransition) => void;

// Valid state transitions
const TRANSITION_MAP = new Map<AppState, Set<AppState>>([
  [AppState.INIT, new Set<AppState>([AppState.DISCONNECTED, AppState.ERROR])],
  [AppState.DISCONNECTED, new Set<AppState>([AppState.DISCOVERING, AppState.ERROR])],
  [AppState.DISCOVERING, new Set<AppState>([AppState.PAIRING, AppState.CONNECTED, AppState.DISCONNECTED, AppState.ERROR])],
  [AppState.PAIRING, new Set<AppState>([AppState.CONNECTED, AppState.DISCONNECTED, AppState.ERROR])],
  [AppState.CONNECTED, new Set<AppState>([AppState.SYNCING, AppState.DISCONNECTED, AppState.ERROR])],
  [AppState.SYNCING, new Set<AppState>([AppState.READY, AppState.CONNECTED, AppState.DISCONNECTED, AppState.ERROR])],
  [AppState.READY, new Set<AppState>([AppState.SYNCING, AppState.DISCONNECTED, AppState.ERROR])],
  [AppState.ERROR, new Set<AppState>([AppState.DISCONNECTED, AppState.INIT])],
]);

const MAX_HISTORY = 50;

export class StateMachine {
  private state: AppState = AppState.INIT;
  private context: StateContext;
  private listeners = new Set<StateListener>();
  private history: StateTransition[] = [];
  private startTime: number;
  private logger: Logger;
  private destroyed = false;

  constructor() {
    this.startTime = Date.now();
    this.context = {
      lastTransitionTime: this.startTime,
      uptime: 0,
    };
    this.logger = createLogger('state-machine');
  }

  getState(): AppState {
    return this.state;
  }

  getContext(): Readonly<StateContext> {
    return Object.freeze({ ...this.context });
  }

  canTransition(to: AppState): boolean {
    const allowed = TRANSITION_MAP.get(this.state);
    return allowed !== undefined && allowed.has(to);
  }

  transition(to: AppState, contextUpdates?: Partial<StateContext>): void {
    const from = this.state;

    if (!this.canTransition(to)) {
      throw new StateError(
        ErrorCode.STATE_INVALID_TRANSITION,
        `Invalid state transition: ${from} -> ${to}`,
        { from, to },
      );
    }

    const now = Date.now();

    // Build new context
    const newContext: StateContext = {
      ...this.context,
      ...contextUpdates,
      lastTransitionTime: now,
      uptime: now - this.startTime,
    };

    // Transitioning to ERROR: save previousState
    if (to === AppState.ERROR) {
      newContext.previousState = from;
    }

    // Transitioning away from ERROR: clear error fields
    if (from === AppState.ERROR) {
      newContext.errorCode = undefined;
      newContext.errorMessage = undefined;
      newContext.previousState = undefined;
    }

    // Transitioning to DISCONNECTED: clear device and pairing fields
    if (to === AppState.DISCONNECTED) {
      newContext.deviceId = undefined;
      newContext.deviceName = undefined;
      newContext.pairingDeviceId = undefined;
      newContext.pairingDeviceName = undefined;
      newContext.syncPhase = undefined;
      newContext.peerMinPeerVersion = undefined;
      newContext.versionCompatible = undefined;
      newContext.peerTooOld = undefined;
      newContext.selfTooOld = undefined;
    }

    this.state = to;
    this.context = newContext;

    const transition: StateTransition = {
      from,
      to,
      context: Object.freeze({ ...newContext }),
      timestamp: now,
    };

    // Add to history ring buffer
    this.history.push(transition);
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }

    this.logger.info('core.state', 'State transition', {
      from,
      to,
      ...(contextUpdates ?? {}),
    });

    // Notify listeners
    if (!this.destroyed) {
      for (const listener of this.listeners) {
        listener(transition);
      }
    }
  }

  /**
   * Update context without changing state. Notifies listeners so the GUI updates.
   */
  updateContext(contextUpdates: Partial<StateContext>): void {
    const now = Date.now();
    this.context = {
      ...this.context,
      ...contextUpdates,
      lastTransitionTime: now,
      uptime: now - this.startTime,
    };

    const transition: StateTransition = {
      from: this.state,
      to: this.state,
      context: Object.freeze({ ...this.context }),
      timestamp: now,
    };

    this.logger.debug('core.state', 'Context updated', contextUpdates);

    if (!this.destroyed) {
      for (const listener of this.listeners) {
        listener(transition);
      }
    }
  }

  onTransition(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getHistory(limit?: number): readonly StateTransition[] {
    if (limit !== undefined && limit < this.history.length) {
      return [...this.history.slice(-limit)];
    }
    return [...this.history];
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }
}
