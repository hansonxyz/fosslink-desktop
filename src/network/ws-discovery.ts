/**
 * WebSocket Discovery Service
 *
 * Broadcasts FossLink discovery packets on UDP port 1716 and listens
 * for incoming discovery packets from Android clients. Discovery packet
 * contains the WebSocket server URL so the phone knows where to connect.
 *
 * Discovery packet format (JSON, newline-terminated, single UDP datagram):
 * { "type": "fosslink.discovery", "deviceId": "...", "deviceName": "...", "wsPort": 8716, "clientVersion": "0.2.0" }
 */

import * as dgram from 'node:dgram';
import * as os from 'node:os';
import { createLogger } from '../utils/logger.js';
import type { Logger } from '../utils/logger.js';
import { isValidDeviceId, CLIENT_VERSION } from './packet.js';

export interface DiscoveredDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  wsPort: number;
  address: string;
  clientVersion: string;
  lastSeen: number;
}

export interface DiscoveryOptions {
  udpPort?: number;
  broadcastInterval?: number;
  deviceLostTimeout?: number;
  reachabilityCheckInterval?: number;
}

type DeviceFoundCallback = (device: DiscoveredDevice) => void;
type DeviceLostCallback = (deviceId: string) => void;

/** Prefixes for container/virtualization interfaces to skip during broadcast. */
const CONTAINER_INTERFACE_PREFIXES = [
  'docker',
  'br-',
  'veth',
  'virbr',
  'vboxnet',
  'vmnet',
];

function isContainerInterface(name: string): boolean {
  const lower = name.toLowerCase();
  return CONTAINER_INTERFACE_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

const DEFAULT_UDP_PORT = 1716;
const DEFAULT_BROADCAST_INTERVAL = 5000;
const DEFAULT_DEVICE_LOST_TIMEOUT = 120000;
const DEFAULT_REACHABILITY_CHECK_INTERVAL = 5000;

const DISCOVERY_TYPE = 'fosslink.discovery';

export class WsDiscoveryService {
  private socket: dgram.Socket | undefined;
  private broadcastTimer: ReturnType<typeof setInterval> | undefined;
  private reachabilityTimer: ReturnType<typeof setInterval> | undefined;
  private devices = new Map<string, DiscoveredDevice>();
  private deviceFoundCallbacks: DeviceFoundCallback[] = [];
  private deviceLostCallbacks: DeviceLostCallback[] = [];
  private logger: Logger;
  private running = false;

  private deviceId: string | undefined;
  private deviceName: string | undefined;
  private wsPort: number | undefined;

  private readonly udpPort: number;
  private readonly broadcastInterval: number;
  private readonly deviceLostTimeout: number;
  private readonly reachabilityCheckInterval: number;

  constructor(options?: DiscoveryOptions) {
    this.udpPort = options?.udpPort ?? DEFAULT_UDP_PORT;
    this.broadcastInterval = options?.broadcastInterval ?? DEFAULT_BROADCAST_INTERVAL;
    this.deviceLostTimeout = options?.deviceLostTimeout ?? DEFAULT_DEVICE_LOST_TIMEOUT;
    this.reachabilityCheckInterval = options?.reachabilityCheckInterval ?? DEFAULT_REACHABILITY_CHECK_INTERVAL;
    this.logger = createLogger('ws-discovery');
  }

  /**
   * Start the discovery service: bind UDP socket, begin broadcasting.
   */
  start(deviceId: string, deviceName: string, wsPort: number): void {
    if (this.running) return;

    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.wsPort = wsPort;

    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('error', (err) => {
      this.logger.error('network.discovery', 'UDP socket error', {
        error: err.message,
      });
    });

    this.socket.on('message', (msg, rinfo) => {
      this.handleIncomingPacket(msg.toString('utf-8'), rinfo.address);
    });

    this.socket.on('listening', () => {
      this.socket!.setBroadcast(true);
      this.running = true;

      this.logger.info('network.discovery', 'Discovery service started', {
        port: this.udpPort,
      });

      // Broadcast immediately, then on interval
      this.broadcast();
      this.broadcastTimer = setInterval(() => this.broadcast(), this.broadcastInterval);

      // Start reachability check
      this.reachabilityTimer = setInterval(
        () => this.checkReachability(),
        this.reachabilityCheckInterval,
      );
    });

    this.socket.bind(this.udpPort);
  }

  /**
   * Stop discovery: close socket, clear timers, clear device list.
   */
  stop(): void {
    if (!this.running && !this.socket) return;

    this.running = false;

    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = undefined;
    }

    if (this.reachabilityTimer) {
      clearInterval(this.reachabilityTimer);
      this.reachabilityTimer = undefined;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
    }

    this.devices.clear();
  }

  getDiscoveredDevices(): Map<string, DiscoveredDevice> {
    return new Map(this.devices);
  }

  /**
   * Programmatically add a device (e.g. from a WebSocket connection).
   * Fires deviceFound callback if the device is new.
   */
  addDevice(device: DiscoveredDevice): void {
    const isNew = !this.devices.has(device.deviceId);
    this.devices.set(device.deviceId, device);

    if (isNew) {
      for (const cb of this.deviceFoundCallbacks) {
        cb(device);
      }
    }
  }

  onDeviceFound(callback: DeviceFoundCallback): void {
    this.deviceFoundCallbacks.push(callback);
  }

  onDeviceLost(callback: DeviceLostCallback): void {
    this.deviceLostCallbacks.push(callback);
  }

  /**
   * Send a directed UDP discovery packet to a specific IP address.
   * Used for direct connect when broadcast is unreliable (VPN, cross-subnet).
   */
  sendDirectDiscovery(address: string, port?: number): void {
    if (!this.socket || !this.deviceId || !this.deviceName || this.wsPort === undefined) {
      this.logger.error('network.discovery', 'Cannot send direct discovery: service not started');
      return;
    }

    const targetPort = port || this.udpPort;
    const packet = this.createDiscoveryPacket();
    const buffer = Buffer.from(packet);

    this.socket.send(buffer, 0, buffer.length, targetPort, address, (err) => {
      if (err) {
        this.logger.error('network.discovery', 'Direct discovery send error', {
          address,
          port: targetPort,
          error: err.message,
        });
      } else {
        this.logger.info('network.discovery', 'Direct discovery sent', {
          address,
          port: targetPort,
        });
      }
    });
  }

  /**
   * Send a connect request to a specific phone. The phone will auto-connect
   * to our WebSocket server when it receives this message type.
   * Used for desktop-initiated pairing.
   */
  sendConnectRequest(address: string, port?: number): void {
    if (!this.socket || !this.deviceId || !this.deviceName || this.wsPort === undefined) {
      this.logger.error('network.discovery', 'Cannot send connect request: service not started');
      return;
    }

    const targetPort = port || this.udpPort;
    const packet = JSON.stringify({
      type: 'fosslink.connect_request',
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      deviceType: 'desktop',
      wsPort: this.wsPort,
      clientVersion: CLIENT_VERSION,
    }) + '\n';
    const buffer = Buffer.from(packet);

    this.socket.send(buffer, 0, buffer.length, targetPort, address, (err) => {
      if (err) {
        this.logger.error('network.discovery', 'Connect request send error', {
          address,
          port: targetPort,
          error: err.message,
        });
      } else {
        this.logger.info('network.discovery', 'Connect request sent', {
          address,
          port: targetPort,
        });
      }
    });
  }

  private createDiscoveryPacket(): string {
    return JSON.stringify({
      type: DISCOVERY_TYPE,
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      deviceType: 'desktop',
      wsPort: this.wsPort,
      clientVersion: CLIENT_VERSION,
    }) + '\n';
  }

  private broadcast(): void {
    if (!this.socket || !this.deviceId || !this.deviceName || this.wsPort === undefined) return;

    const buffer = Buffer.from(this.createDiscoveryPacket());
    this.broadcastFromAllInterfaces(buffer);
  }

  private broadcastFromAllInterfaces(buffer: Buffer): void {
    const interfaces = os.networkInterfaces();

    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;
      if (isContainerInterface(name)) continue;

      for (const addr of addresses) {
        if (addr.family !== 'IPv4' || addr.internal) continue;

        const tempSocket = dgram.createSocket('udp4');
        tempSocket.bind(0, addr.address, () => {
          tempSocket.setBroadcast(true);
          tempSocket.send(buffer, 0, buffer.length, this.udpPort, '255.255.255.255', (err) => {
            if (err) {
              this.logger.warn('network.discovery', 'Interface broadcast error', {
                interface: name,
                address: addr.address,
                error: err.message,
              });
            }
            tempSocket.close();
          });
        });
      }
    }
  }

  private handleIncomingPacket(data: string, address: string): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data.trim()) as Record<string, unknown>;
    } catch {
      this.logger.debug('network.discovery', 'Failed to parse incoming packet', { address });
      return;
    }

    // Only process fosslink discovery packets
    if (parsed['type'] !== DISCOVERY_TYPE) return;

    const deviceId = parsed['deviceId'] as string | undefined;
    const deviceName = parsed['deviceName'] as string | undefined;
    const deviceType = parsed['deviceType'] as string | undefined;
    const wsPort = parsed['wsPort'] as number | undefined;
    const clientVersion = parsed['clientVersion'] as string | undefined;

    if (!deviceId || !deviceName || wsPort === undefined) return;

    // Ignore self-broadcasts
    if (deviceId === this.deviceId) return;

    // Desktop only discovers phones (ignore other desktops)
    if (deviceType === 'desktop' || deviceType === 'laptop') return;

    // Validate device ID format
    if (!isValidDeviceId(deviceId)) {
      this.logger.debug('network.discovery', 'Invalid device ID format', { deviceId, address });
      return;
    }

    const isNew = !this.devices.has(deviceId);

    const device: DiscoveredDevice = {
      deviceId,
      deviceName,
      deviceType: deviceType ?? 'phone',
      wsPort,
      address,
      clientVersion: clientVersion ?? '0.0.0',
      lastSeen: Date.now(),
    };

    this.devices.set(deviceId, device);

    if (isNew) {
      this.logger.info('network.discovery', 'Device discovered', {
        deviceId,
        deviceName,
        address,
        wsPort,
      });

      for (const cb of this.deviceFoundCallbacks) {
        cb(device);
      }
    }
  }

  private checkReachability(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [deviceId, device] of this.devices) {
      if (now - device.lastSeen > this.deviceLostTimeout) {
        toRemove.push(deviceId);
      }
    }

    for (const deviceId of toRemove) {
      this.devices.delete(deviceId);
      this.logger.info('network.discovery', 'Device lost', { deviceId });
      for (const cb of this.deviceLostCallbacks) {
        cb(deviceId);
      }
    }
  }
}
