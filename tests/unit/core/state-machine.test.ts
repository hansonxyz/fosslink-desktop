import { describe, it, expect, beforeEach } from 'vitest';
import { AppState, StateMachine } from '../../../src/core/state-machine.js';
import type { StateTransition } from '../../../src/core/state-machine.js';
import { StateError, ErrorCode } from '../../../src/core/errors.js';

describe('StateMachine', () => {
  let sm: StateMachine;

  beforeEach(() => {
    sm = new StateMachine();
  });

  describe('initial state', () => {
    it('starts in INIT state', () => {
      expect(sm.getState()).toBe(AppState.INIT);
    });

    it('has initial context with lastTransitionTime', () => {
      const ctx = sm.getContext();
      expect(ctx.lastTransitionTime).toBeGreaterThan(0);
    });

    it('has empty history', () => {
      expect(sm.getHistory()).toHaveLength(0);
    });
  });

  describe('valid transitions', () => {
    it('INIT -> DISCONNECTED succeeds', () => {
      sm.transition(AppState.DISCONNECTED);
      expect(sm.getState()).toBe(AppState.DISCONNECTED);
    });

    it('INIT -> ERROR succeeds', () => {
      sm.transition(AppState.ERROR, {
        errorCode: ErrorCode.DAEMON_INIT_FAILED,
        errorMessage: 'init failed',
      });
      expect(sm.getState()).toBe(AppState.ERROR);
    });

    it('DISCONNECTED -> DISCOVERING succeeds', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      expect(sm.getState()).toBe(AppState.DISCOVERING);
    });

    it('DISCOVERING -> PAIRING succeeds', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.PAIRING, {
        pairingDeviceId: 'abc',
        pairingDeviceName: 'Phone',
      });
      expect(sm.getState()).toBe(AppState.PAIRING);
    });

    it('DISCOVERING -> CONNECTED succeeds', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED, {
        deviceId: 'abc',
        deviceName: 'Phone',
      });
      expect(sm.getState()).toBe(AppState.CONNECTED);
    });

    it('DISCOVERING -> DISCONNECTED succeeds', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.DISCONNECTED);
      expect(sm.getState()).toBe(AppState.DISCONNECTED);
    });

    it('PAIRING -> CONNECTED succeeds', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.PAIRING);
      sm.transition(AppState.CONNECTED, { deviceId: 'abc', deviceName: 'Phone' });
      expect(sm.getState()).toBe(AppState.CONNECTED);
    });

    it('PAIRING -> DISCONNECTED succeeds', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.PAIRING);
      sm.transition(AppState.DISCONNECTED);
      expect(sm.getState()).toBe(AppState.DISCONNECTED);
    });

    it('CONNECTED -> SYNCING succeeds', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED, { deviceId: 'abc', deviceName: 'Phone' });
      sm.transition(AppState.SYNCING, { syncPhase: 'conversations' });
      expect(sm.getState()).toBe(AppState.SYNCING);
    });

    it('SYNCING -> READY succeeds', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED, { deviceId: 'abc', deviceName: 'Phone' });
      sm.transition(AppState.SYNCING);
      sm.transition(AppState.READY);
      expect(sm.getState()).toBe(AppState.READY);
    });

    it('SYNCING -> CONNECTED succeeds (sync retry)', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED, { deviceId: 'abc', deviceName: 'Phone' });
      sm.transition(AppState.SYNCING);
      sm.transition(AppState.CONNECTED);
      expect(sm.getState()).toBe(AppState.CONNECTED);
    });

    it('READY -> SYNCING succeeds (re-sync)', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED, { deviceId: 'abc', deviceName: 'Phone' });
      sm.transition(AppState.SYNCING);
      sm.transition(AppState.READY);
      sm.transition(AppState.SYNCING, { syncPhase: 'messages' });
      expect(sm.getState()).toBe(AppState.SYNCING);
    });

    it('READY -> DISCONNECTED succeeds', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED);
      sm.transition(AppState.SYNCING);
      sm.transition(AppState.READY);
      sm.transition(AppState.DISCONNECTED);
      expect(sm.getState()).toBe(AppState.DISCONNECTED);
    });

    it('ERROR -> DISCONNECTED succeeds (recovery)', () => {
      sm.transition(AppState.ERROR, {
        errorCode: ErrorCode.DAEMON_INIT_FAILED,
        errorMessage: 'test',
      });
      sm.transition(AppState.DISCONNECTED);
      expect(sm.getState()).toBe(AppState.DISCONNECTED);
    });

    it('ERROR -> INIT succeeds (full reset)', () => {
      sm.transition(AppState.ERROR);
      sm.transition(AppState.INIT);
      expect(sm.getState()).toBe(AppState.INIT);
    });
  });

  describe('invalid transitions', () => {
    it('INIT -> READY throws StateError', () => {
      expect(() => sm.transition(AppState.READY)).toThrow(StateError);
    });

    it('INIT -> SYNCING throws StateError', () => {
      expect(() => sm.transition(AppState.SYNCING)).toThrow(StateError);
    });

    it('DISCONNECTED -> READY throws StateError', () => {
      sm.transition(AppState.DISCONNECTED);
      expect(() => sm.transition(AppState.READY)).toThrow(StateError);
    });

    it('READY -> INIT throws StateError', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED);
      sm.transition(AppState.SYNCING);
      sm.transition(AppState.READY);
      expect(() => sm.transition(AppState.INIT)).toThrow(StateError);
    });

    it('transition to same state throws StateError', () => {
      expect(() => sm.transition(AppState.INIT)).toThrow(StateError);
    });

    it('error includes from and to details', () => {
      try {
        sm.transition(AppState.READY);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(StateError);
        const stateErr = err as StateError;
        expect(stateErr.code).toBe(ErrorCode.STATE_INVALID_TRANSITION);
        expect(stateErr.details).toEqual({ from: AppState.INIT, to: AppState.READY });
      }
    });
  });

  describe('context management', () => {
    it('context updates are applied on transition', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED, {
        deviceId: 'test-device-123',
        deviceName: 'Pixel 7',
      });
      const ctx = sm.getContext();
      expect(ctx.deviceId).toBe('test-device-123');
      expect(ctx.deviceName).toBe('Pixel 7');
    });

    it('ERROR state records previousState', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.ERROR, {
        errorCode: ErrorCode.NETWORK_TIMEOUT,
        errorMessage: 'discovery timed out',
      });
      const ctx = sm.getContext();
      expect(ctx.previousState).toBe(AppState.DISCOVERING);
      expect(ctx.errorCode).toBe(ErrorCode.NETWORK_TIMEOUT);
      expect(ctx.errorMessage).toBe('discovery timed out');
    });

    it('transitioning from ERROR clears error fields', () => {
      sm.transition(AppState.ERROR, {
        errorCode: ErrorCode.NETWORK_TIMEOUT,
        errorMessage: 'timeout',
      });
      sm.transition(AppState.DISCONNECTED);
      const ctx = sm.getContext();
      expect(ctx.errorCode).toBeUndefined();
      expect(ctx.errorMessage).toBeUndefined();
      expect(ctx.previousState).toBeUndefined();
    });

    it('transitioning to DISCONNECTED clears device fields', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED, {
        deviceId: 'abc',
        deviceName: 'Phone',
      });
      sm.transition(AppState.DISCONNECTED);
      const ctx = sm.getContext();
      expect(ctx.deviceId).toBeUndefined();
      expect(ctx.deviceName).toBeUndefined();
    });

    it('lastTransitionTime is updated on transition', () => {
      const before = Date.now();
      sm.transition(AppState.DISCONNECTED);
      const ctx = sm.getContext();
      expect(ctx.lastTransitionTime).toBeGreaterThanOrEqual(before);
    });

    it('getContext returns a frozen copy', () => {
      const ctx = sm.getContext();
      expect(Object.isFrozen(ctx)).toBe(true);
    });
  });

  describe('listeners', () => {
    it('onTransition listener is called on transition', () => {
      const transitions: StateTransition[] = [];
      sm.onTransition((t) => transitions.push(t));

      sm.transition(AppState.DISCONNECTED);

      expect(transitions).toHaveLength(1);
      expect(transitions[0]!.from).toBe(AppState.INIT);
      expect(transitions[0]!.to).toBe(AppState.DISCONNECTED);
    });

    it('multiple listeners all receive notifications', () => {
      let count1 = 0;
      let count2 = 0;
      sm.onTransition(() => count1++);
      sm.onTransition(() => count2++);

      sm.transition(AppState.DISCONNECTED);

      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    it('unsubscribe stops callbacks', () => {
      let count = 0;
      const unsub = sm.onTransition(() => count++);

      sm.transition(AppState.DISCONNECTED);
      expect(count).toBe(1);

      unsub();
      sm.transition(AppState.DISCOVERING);
      expect(count).toBe(1);
    });

    it('transition data includes context', () => {
      const transitions: StateTransition[] = [];
      sm.onTransition((t) => transitions.push(t));

      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED, {
        deviceId: 'dev123',
        deviceName: 'Phone',
      });

      expect(transitions).toHaveLength(3);
      expect(transitions[2]!.context.deviceId).toBe('dev123');
    });
  });

  describe('canTransition', () => {
    it('returns true for valid transition', () => {
      expect(sm.canTransition(AppState.DISCONNECTED)).toBe(true);
    });

    it('returns false for invalid transition', () => {
      expect(sm.canTransition(AppState.READY)).toBe(false);
    });

    it('does not change state', () => {
      sm.canTransition(AppState.DISCONNECTED);
      expect(sm.getState()).toBe(AppState.INIT);
    });
  });

  describe('history', () => {
    it('records transitions', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);

      const history = sm.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]!.from).toBe(AppState.INIT);
      expect(history[0]!.to).toBe(AppState.DISCONNECTED);
      expect(history[1]!.from).toBe(AppState.DISCONNECTED);
      expect(history[1]!.to).toBe(AppState.DISCOVERING);
    });

    it('getHistory(1) limits to 1 entry', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);

      const history = sm.getHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0]!.to).toBe(AppState.DISCOVERING);
    });

    it('returns a copy, not internal reference', () => {
      sm.transition(AppState.DISCONNECTED);
      const h1 = sm.getHistory();
      const h2 = sm.getHistory();
      expect(h1).not.toBe(h2);
    });
  });

  describe('full paths', () => {
    it('happy path: INIT -> DISCONNECTED -> DISCOVERING -> CONNECTED -> SYNCING -> READY', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED, { deviceId: 'abc', deviceName: 'Phone' });
      sm.transition(AppState.SYNCING, { syncPhase: 'conversations' });
      sm.transition(AppState.READY);
      expect(sm.getState()).toBe(AppState.READY);
      expect(sm.getHistory()).toHaveLength(5);
    });

    it('error recovery: CONNECTED -> ERROR -> DISCONNECTED -> DISCOVERING', () => {
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      sm.transition(AppState.CONNECTED);
      sm.transition(AppState.ERROR, {
        errorCode: ErrorCode.NETWORK_TIMEOUT,
        errorMessage: 'lost connection',
      });
      sm.transition(AppState.DISCONNECTED);
      sm.transition(AppState.DISCOVERING);
      expect(sm.getState()).toBe(AppState.DISCOVERING);
    });
  });

  describe('destroy', () => {
    it('prevents further listener notifications', () => {
      let count = 0;
      sm.onTransition(() => count++);

      sm.transition(AppState.DISCONNECTED);
      expect(count).toBe(1);

      sm.destroy();
      sm.transition(AppState.DISCOVERING);
      expect(count).toBe(1);
    });
  });
});
