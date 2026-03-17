import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PairingHandler } from '../../../src/protocol/pairing-handler.js';
import type { DeviceConnection } from '../../../src/network/ws-server.js';
import type { ProtocolMessage } from '../../../src/network/packet.js';
import {
  resetLogger,
  initializeLogger,
  shutdownLogger,
} from '../../../src/utils/logger.js';
import { PassThrough } from 'node:stream';

function createMockConnection(
  deviceId: string,
  deviceName = 'TestPhone',
): DeviceConnection {
  return {
    deviceId,
    deviceName,
    ws: {} as DeviceConnection['ws'],
    connected: true,
    send: vi.fn(),
    close: vi.fn(),
  };
}

describe('PairingHandler', () => {
  let logStream: PassThrough;
  let handler: PairingHandler;
  let trustedDevicesDir: string;
  let tmpDir: string;

  const phoneDeviceId = 'test-phone-device-id';

  beforeEach(() => {
    resetLogger();
    logStream = new PassThrough();
    initializeLogger({ level: 'debug', stream: logStream });

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pairing-test-'));
    trustedDevicesDir = path.join(tmpDir, 'trusted_devices');

    handler = new PairingHandler({
      trustedDevicesDir,
      pairingTimeout: 500, // Short timeout for tests
    });
  });

  afterEach(async () => {
    handler.cleanup();
    await shutdownLogger();
    resetLogger();
    logStream.destroy();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('creates trustedDevicesDir if it does not exist', () => {
      const newDir = path.join(tmpDir, 'newly_created');
      expect(fs.existsSync(newDir)).toBe(false);

      new PairingHandler({ trustedDevicesDir: newDir }).cleanup();

      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.statSync(newDir).isDirectory()).toBe(true);
    });
  });

  describe('requestPairing', () => {
    it('sends MSG_PAIR_CODE with 6-digit code and returns verificationKey', () => {
      const conn = createMockConnection(phoneDeviceId);
      const result = handler.requestPairing(conn);

      // verificationKey is a 6-digit code
      expect(result.verificationKey).toMatch(/^\d{6}$/);

      // Should have called send with pair_code
      expect(conn.send).toHaveBeenCalledTimes(1);
      expect(conn.send).toHaveBeenCalledWith('fosslink.pair_code', {
        code: result.verificationKey,
      });
    });

    it('throws if device is already paired', () => {
      // Write a trusted device JSON file
      fs.writeFileSync(
        path.join(trustedDevicesDir, `${phoneDeviceId}.json`),
        JSON.stringify({ deviceId: phoneDeviceId, deviceName: 'TestPhone', pairedAt: Date.now() }),
      );

      const conn = createMockConnection(phoneDeviceId);
      expect(() => handler.requestPairing(conn)).toThrow('Already paired');
    });
  });

  describe('handlePairingMessage — pair_confirm with correct code', () => {
    it('stores trusted device, sends MSG_PAIR_ACCEPT, and fires result callback', () => {
      const conn = createMockConnection(phoneDeviceId);
      const { verificationKey } = handler.requestPairing(conn);

      const results: Array<{ deviceId: string; success: boolean; code?: string }> = [];
      handler.onPairingResult((deviceId, success, code) => {
        results.push({ deviceId, success, code });
      });

      const confirmMsg: ProtocolMessage = {
        type: 'fosslink.pair_confirm',
        body: { code: verificationKey },
      };
      handler.handlePairingMessage(confirmMsg, conn);

      // Callback fired with success
      expect(results).toHaveLength(1);
      expect(results[0]!.deviceId).toBe(phoneDeviceId);
      expect(results[0]!.success).toBe(true);
      expect(results[0]!.code).toBe(verificationKey);

      // Trusted device JSON stored on disk
      const jsonPath = path.join(trustedDevicesDir, `${phoneDeviceId}.json`);
      expect(fs.existsSync(jsonPath)).toBe(true);
      const stored = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      expect(stored.deviceId).toBe(phoneDeviceId);
      expect(stored.deviceName).toBe('TestPhone');
      expect(typeof stored.pairedAt).toBe('number');

      // Sent pair_code (from requestPairing) + pair_accept (from confirm)
      expect(conn.send).toHaveBeenCalledTimes(2);
      expect(conn.send).toHaveBeenLastCalledWith('fosslink.pair_accept', {
        deviceId: phoneDeviceId,
      });
    });
  });

  describe('handlePairingMessage — pair_confirm with wrong code', () => {
    it('sends MSG_PAIR_REJECT and fires failure callback', () => {
      const conn = createMockConnection(phoneDeviceId);
      handler.requestPairing(conn);

      const results: Array<{ deviceId: string; success: boolean }> = [];
      handler.onPairingResult((deviceId, success) => {
        results.push({ deviceId, success });
      });

      const confirmMsg: ProtocolMessage = {
        type: 'fosslink.pair_confirm',
        body: { code: '000000' }, // Wrong code
      };
      handler.handlePairingMessage(confirmMsg, conn);

      // Callback fired with failure
      expect(results).toHaveLength(1);
      expect(results[0]!.success).toBe(false);

      // Sent pair_code + pair_reject
      expect(conn.send).toHaveBeenCalledTimes(2);
      expect(conn.send).toHaveBeenLastCalledWith('fosslink.pair_reject', {
        reason: 'code_mismatch',
      });

      // No trusted device stored
      expect(handler.isPaired(phoneDeviceId)).toBe(false);
    });
  });

  describe('handlePairingMessage — pair_reject', () => {
    it('clears pending pairing and fires failure callback', () => {
      const conn = createMockConnection(phoneDeviceId);
      handler.requestPairing(conn);

      const results: Array<{ deviceId: string; success: boolean }> = [];
      handler.onPairingResult((deviceId, success) => {
        results.push({ deviceId, success });
      });

      const rejectMsg: ProtocolMessage = {
        type: 'fosslink.pair_reject',
        body: {},
      };
      handler.handlePairingMessage(rejectMsg, conn);

      expect(results).toHaveLength(1);
      expect(results[0]!.deviceId).toBe(phoneDeviceId);
      expect(results[0]!.success).toBe(false);

      // No trusted device stored
      expect(handler.isPaired(phoneDeviceId)).toBe(false);
    });
  });

  describe('handlePairingMessage — unpair', () => {
    it('removes trusted device file', () => {
      // Pre-create a trusted device
      fs.writeFileSync(
        path.join(trustedDevicesDir, `${phoneDeviceId}.json`),
        JSON.stringify({ deviceId: phoneDeviceId, deviceName: 'TestPhone', pairedAt: Date.now() }),
      );
      expect(handler.isPaired(phoneDeviceId)).toBe(true);

      const unpairedDevices: string[] = [];
      handler.onUnpaired((deviceId) => {
        unpairedDevices.push(deviceId);
      });

      const conn = createMockConnection(phoneDeviceId);
      const unpairMsg: ProtocolMessage = {
        type: 'fosslink.unpair',
        body: {},
      };
      handler.handlePairingMessage(unpairMsg, conn);

      // Device should be removed
      expect(handler.isPaired(phoneDeviceId)).toBe(false);
      expect(fs.existsSync(path.join(trustedDevicesDir, `${phoneDeviceId}.json`))).toBe(false);

      // Unpaired callback fired
      expect(unpairedDevices).toHaveLength(1);
      expect(unpairedDevices[0]).toBe(phoneDeviceId);
    });
  });

  describe('isPaired', () => {
    it('returns true when .json file exists', () => {
      fs.writeFileSync(
        path.join(trustedDevicesDir, `${phoneDeviceId}.json`),
        JSON.stringify({ deviceId: phoneDeviceId, deviceName: 'TestPhone', pairedAt: Date.now() }),
      );
      expect(handler.isPaired(phoneDeviceId)).toBe(true);
    });

    it('returns false for unknown device', () => {
      expect(handler.isPaired('nonexistent-device')).toBe(false);
    });
  });

  describe('unpair', () => {
    it('removes .json file and sends MSG_UNPAIR when connection is provided', () => {
      // Pre-create trusted device
      fs.writeFileSync(
        path.join(trustedDevicesDir, `${phoneDeviceId}.json`),
        JSON.stringify({ deviceId: phoneDeviceId, deviceName: 'TestPhone', pairedAt: Date.now() }),
      );

      const conn = createMockConnection(phoneDeviceId);

      const unpairedDevices: string[] = [];
      handler.onUnpaired((deviceId) => {
        unpairedDevices.push(deviceId);
      });

      handler.unpair(phoneDeviceId, conn);

      // Should send MSG_UNPAIR
      expect(conn.send).toHaveBeenCalledWith('fosslink.unpair', {
        deviceId: phoneDeviceId,
      });

      // File removed
      expect(handler.isPaired(phoneDeviceId)).toBe(false);
      expect(fs.existsSync(path.join(trustedDevicesDir, `${phoneDeviceId}.json`))).toBe(false);

      // Unpaired callback fired
      expect(unpairedDevices).toEqual([phoneDeviceId]);
    });

    it('removes .json file without sending when no connection provided', () => {
      fs.writeFileSync(
        path.join(trustedDevicesDir, `${phoneDeviceId}.json`),
        JSON.stringify({ deviceId: phoneDeviceId, deviceName: 'TestPhone', pairedAt: Date.now() }),
      );

      handler.unpair(phoneDeviceId);

      expect(handler.isPaired(phoneDeviceId)).toBe(false);
    });
  });

  describe('pairing timeout', () => {
    it('fires failure callback and sends MSG_PAIR_REJECT after timeout', async () => {
      const conn = createMockConnection(phoneDeviceId);
      handler.requestPairing(conn);

      const result = await new Promise<{ deviceId: string; success: boolean }>((resolve) => {
        handler.onPairingResult((deviceId, success) => {
          resolve({ deviceId, success });
        });
      });

      expect(result.deviceId).toBe(phoneDeviceId);
      expect(result.success).toBe(false);

      // Should have sent pair_code (initial) + pair_reject (timeout)
      expect(conn.send).toHaveBeenCalledTimes(2);
      expect(conn.send).toHaveBeenLastCalledWith('fosslink.pair_reject', {
        reason: 'timeout',
      });
    });
  });

  describe('loadTrustedDevices', () => {
    it('returns device IDs from .json files', () => {
      const deviceA = 'device-aaa';
      const deviceB = 'device-bbb';
      fs.writeFileSync(
        path.join(trustedDevicesDir, `${deviceA}.json`),
        JSON.stringify({ deviceId: deviceA, deviceName: 'PhoneA', pairedAt: Date.now() }),
      );
      fs.writeFileSync(
        path.join(trustedDevicesDir, `${deviceB}.json`),
        JSON.stringify({ deviceId: deviceB, deviceName: 'PhoneB', pairedAt: Date.now() }),
      );

      const devices = handler.loadTrustedDevices();
      expect(devices).toHaveLength(2);
      expect(devices).toContain(deviceA);
      expect(devices).toContain(deviceB);
    });

    it('returns empty array when no trusted devices exist', () => {
      const devices = handler.loadTrustedDevices();
      expect(devices).toHaveLength(0);
    });

    it('includes legacy .pem files in loaded devices', () => {
      fs.writeFileSync(
        path.join(trustedDevicesDir, `legacy-device.pem`),
        'fake-cert-content',
      );

      const devices = handler.loadTrustedDevices();
      expect(devices).toContain('legacy-device');
    });
  });
});
