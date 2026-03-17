import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  loadKnownDevices,
  saveKnownDevice,
  removeKnownDevice,
} from '../../../src/config/known-devices.js';
import type { KnownDevice } from '../../../src/config/known-devices.js';

describe('known-devices', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xyz-known-'));
    filePath = path.join(tmpDir, 'known_devices.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const device1: KnownDevice = {
    deviceId: 'abc123',
    deviceName: 'Pixel 7',
    address: '192.168.68.10',
    port: 1716,
  };

  const device2: KnownDevice = {
    deviceId: 'def456',
    deviceName: 'Galaxy S24',
    address: '192.168.68.20',
    port: 1716,
  };

  describe('loadKnownDevices', () => {
    it('returns empty array when file does not exist', () => {
      const devices = loadKnownDevices(filePath);
      expect(devices).toEqual([]);
    });

    it('returns empty array when file contains non-array JSON', () => {
      fs.writeFileSync(filePath, '{"not": "array"}', 'utf-8');
      const devices = loadKnownDevices(filePath);
      expect(devices).toEqual([]);
    });

    it('loads saved devices', () => {
      fs.writeFileSync(filePath, JSON.stringify([device1]), 'utf-8');
      const devices = loadKnownDevices(filePath);
      expect(devices).toHaveLength(1);
      expect(devices[0]).toEqual(device1);
    });
  });

  describe('saveKnownDevice', () => {
    it('creates file and saves device when file does not exist', () => {
      saveKnownDevice(device1, filePath);
      const devices = loadKnownDevices(filePath);
      expect(devices).toHaveLength(1);
      expect(devices[0]).toEqual(device1);
    });

    it('appends a new device', () => {
      saveKnownDevice(device1, filePath);
      saveKnownDevice(device2, filePath);
      const devices = loadKnownDevices(filePath);
      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual(device1);
      expect(devices[1]).toEqual(device2);
    });

    it('upserts existing device by deviceId', () => {
      saveKnownDevice(device1, filePath);

      const updated: KnownDevice = {
        ...device1,
        address: '10.0.0.5',
        port: 1720,
      };
      saveKnownDevice(updated, filePath);

      const devices = loadKnownDevices(filePath);
      expect(devices).toHaveLength(1);
      expect(devices[0]!.address).toBe('10.0.0.5');
      expect(devices[0]!.port).toBe(1720);
    });
  });

  describe('removeKnownDevice', () => {
    it('removes a device by deviceId', () => {
      saveKnownDevice(device1, filePath);
      saveKnownDevice(device2, filePath);

      removeKnownDevice(device1.deviceId, filePath);
      const devices = loadKnownDevices(filePath);
      expect(devices).toHaveLength(1);
      expect(devices[0]!.deviceId).toBe(device2.deviceId);
    });

    it('is a no-op when device does not exist', () => {
      saveKnownDevice(device1, filePath);
      removeKnownDevice('nonexistent', filePath);
      const devices = loadKnownDevices(filePath);
      expect(devices).toHaveLength(1);
    });

    it('is a no-op when file does not exist', () => {
      // Should not throw
      removeKnownDevice('nonexistent', filePath);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });
});
