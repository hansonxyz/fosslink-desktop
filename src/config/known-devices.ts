/**
 * Known Device Persistence
 *
 * Stores IP-associated devices in a JSON file so the daemon can
 * auto-reconnect on startup without depending on UDP discovery.
 */

import * as fs from 'node:fs';
import { getKnownDevicesPath } from '../utils/paths.js';

export interface KnownDevice {
  deviceId: string;
  deviceName: string;
  address: string;
  port: number;
}

/**
 * Load known devices from disk. Returns empty array if file is missing.
 */
export function loadKnownDevices(filePath?: string): KnownDevice[] {
  const p = filePath ?? getKnownDevicesPath();
  if (!fs.existsSync(p)) {
    return [];
  }

  const data = fs.readFileSync(p, 'utf-8');
  const parsed: unknown = JSON.parse(data);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed as KnownDevice[];
}

/**
 * Save (upsert) a known device. Updates existing entry by deviceId
 * or appends if new.
 */
export function saveKnownDevice(device: KnownDevice, filePath?: string): void {
  const p = filePath ?? getKnownDevicesPath();
  const devices = loadKnownDevices(p);
  const idx = devices.findIndex((d) => d.deviceId === device.deviceId);

  if (idx >= 0) {
    devices[idx] = device;
  } else {
    devices.push(device);
  }

  fs.writeFileSync(p, JSON.stringify(devices, null, 2), 'utf-8');
}

/**
 * Remove a known device by deviceId. No-op if not found.
 */
export function removeKnownDevice(deviceId: string, filePath?: string): void {
  const p = filePath ?? getKnownDevicesPath();
  const devices = loadKnownDevices(p);
  const filtered = devices.filter((d) => d.deviceId !== deviceId);

  if (filtered.length !== devices.length) {
    fs.writeFileSync(p, JSON.stringify(filtered, null, 2), 'utf-8');
  }
}
