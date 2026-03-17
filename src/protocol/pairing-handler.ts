/**
 * Shared-Secret Pairing Handler (v2)
 *
 * Pairing flow:
 * 1. Desktop generates a 6-digit code
 * 2. Desktop displays code on screen
 * 3. Desktop sends pair_code to phone
 * 4. Phone displays code, user compares visually
 * 5. Phone sends pair_confirm with matching code
 * 6. Desktop verifies code, sends pair_accept
 * 7. Both sides store device as trusted
 *
 * Trusted devices are stored as JSON files in the trustedCertsDir
 * (reusing the same directory structure as v1 for backwards compat).
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '../utils/logger.js';
import type { Logger } from '../utils/logger.js';
import {
  MSG_PAIR_CODE,
  MSG_PAIR_ACCEPT,
  MSG_PAIR_REJECT,
  MSG_UNPAIR,
} from '../network/packet.js';
import type { ProtocolMessage } from '../network/packet.js';
import type { DeviceConnection } from '../network/ws-server.js';

export interface PairingHandlerOptions {
  trustedDevicesDir: string;
  pairingTimeout?: number;
}

export interface TrustedDevice {
  deviceId: string;
  deviceName: string;
  pairedAt: number;
}

interface PendingPairing {
  deviceId: string;
  code: string;
  timeoutId: ReturnType<typeof setTimeout>;
}

export interface IncomingPairingRequest {
  deviceId: string;
  deviceName: string;
  timestamp: number;
}

type PairingResultCallback = (
  deviceId: string,
  success: boolean,
  code?: string,
) => void;

type UnpairedCallback = (deviceId: string) => void;

type IncomingPairingCallback = (request: IncomingPairingRequest) => void;

type PairingCodeCallback = (deviceId: string, deviceName: string, code: string) => void;

const DEFAULT_PAIRING_TIMEOUT = 120000;

export class PairingHandler {
  private trustedDevicesDir: string;
  private pairingTimeout: number;
  private pendingPairings = new Map<string, PendingPairing>();
  private resultCallbacks: PairingResultCallback[] = [];
  private unpairedCallbacks: UnpairedCallback[] = [];
  private incomingPairingCallbacks: IncomingPairingCallback[] = [];
  private pairingCodeCallbacks: PairingCodeCallback[] = [];
  private logger: Logger;

  constructor(options: PairingHandlerOptions) {
    this.trustedDevicesDir = options.trustedDevicesDir;
    this.pairingTimeout = options.pairingTimeout ?? DEFAULT_PAIRING_TIMEOUT;
    this.logger = createLogger('pairing-handler');

    // Ensure directory exists
    fs.mkdirSync(this.trustedDevicesDir, { recursive: true });
  }

  /**
   * Initiate pairing with a connected device.
   * Generates a 6-digit code and sends it to the phone.
   */
  requestPairing(connection: DeviceConnection): { verificationKey: string } {
    if (this.isPaired(connection.deviceId)) {
      throw new Error('Already paired with this device');
    }

    const code = this.generateCode();

    // Send the code to the phone
    connection.send(MSG_PAIR_CODE, { code });

    this.logger.info('protocol.pairing', 'Pairing code sent', {
      deviceId: connection.deviceId,
      code,
    });

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (this.pendingPairings.has(connection.deviceId)) {
        this.pendingPairings.delete(connection.deviceId);
        this.logger.warn('protocol.pairing', 'Pairing timeout', {
          deviceId: connection.deviceId,
        });
        connection.send(MSG_PAIR_REJECT, { reason: 'timeout' });
        this.firePairingResult(connection.deviceId, false);
      }
    }, this.pairingTimeout);

    this.pendingPairings.set(connection.deviceId, {
      deviceId: connection.deviceId,
      code,
      timeoutId,
    });

    // Fire code-generated callback (for IPC notification to GUI)
    this.firePairingCode(connection.deviceId, connection.deviceName, code);

    // Return code as verificationKey (displayed to user on desktop)
    return { verificationKey: code };
  }

  /**
   * Handle an incoming pairing-related message.
   */
  handlePairingMessage(msg: ProtocolMessage, connection: DeviceConnection): void {
    switch (msg.type) {
      case 'fosslink.pair_request':
        this.handlePairRequest(msg, connection);
        break;
      case 'fosslink.pair_confirm':
        this.handlePairConfirm(msg, connection);
        break;
      case 'fosslink.pair_reject':
        this.handlePairReject(connection);
        break;
      case 'fosslink.unpair':
        this.handleUnpair(connection);
        break;
      default:
        this.logger.warn('protocol.pairing', 'Unknown pairing message type', {
          type: msg.type,
        });
    }
  }

  /**
   * Phone initiated a pairing request. Queue for user approval.
   * In v2, the desktop always generates the code, so we treat this
   * as "phone wants to pair" and start the flow from our side.
   */
  private handlePairRequest(_msg: ProtocolMessage, connection: DeviceConnection): void {
    if (this.isPaired(connection.deviceId)) {
      // Already paired — might be a reconnect with stale state
      connection.send(MSG_PAIR_ACCEPT, {
        deviceId: connection.deviceId,
        deviceName: 'FossLink Desktop',
      });
      this.firePairingResult(connection.deviceId, true);
      return;
    }

    const request: IncomingPairingRequest = {
      deviceId: connection.deviceId,
      deviceName: connection.deviceName,
      timestamp: Date.now(),
    };

    this.logger.info('protocol.pairing', 'Incoming pairing request', {
      deviceId: connection.deviceId,
      deviceName: connection.deviceName,
    });

    this.fireIncomingPairing(request);
  }

  /**
   * Phone confirmed the pairing code matches.
   */
  private handlePairConfirm(msg: ProtocolMessage, connection: DeviceConnection): void {
    const pending = this.pendingPairings.get(connection.deviceId);
    if (!pending) {
      this.logger.warn('protocol.pairing', 'Pair confirm without pending pairing', {
        deviceId: connection.deviceId,
      });
      return;
    }

    const code = msg.body['code'] as string | undefined;

    if (code !== pending.code) {
      this.logger.warn('protocol.pairing', 'Pair confirm code mismatch', {
        deviceId: connection.deviceId,
        expected: pending.code,
        received: code,
      });
      this.clearPending(connection.deviceId);
      connection.send(MSG_PAIR_REJECT, { reason: 'code_mismatch' });
      this.firePairingResult(connection.deviceId, false);
      return;
    }

    // Code matches — pairing successful
    this.clearPending(connection.deviceId);
    this.storeTrustedDevice(connection.deviceId, connection.deviceName);

    connection.send(MSG_PAIR_ACCEPT, {
      deviceId: connection.deviceId,
    });

    this.logger.info('protocol.pairing', 'Pairing accepted', {
      deviceId: connection.deviceId,
    });
    this.firePairingResult(connection.deviceId, true, code);
  }

  /**
   * Phone rejected the pairing.
   */
  private handlePairReject(connection: DeviceConnection): void {
    if (this.pendingPairings.has(connection.deviceId)) {
      this.clearPending(connection.deviceId);
      this.logger.info('protocol.pairing', 'Pairing rejected by remote', {
        deviceId: connection.deviceId,
      });
      this.firePairingResult(connection.deviceId, false);
    }
  }

  /**
   * Phone sent unpair.
   */
  private handleUnpair(connection: DeviceConnection): void {
    this.removeTrustedDevice(connection.deviceId);
    this.logger.info('protocol.pairing', 'Device unpaired by remote', {
      deviceId: connection.deviceId,
    });
    this.fireUnpaired(connection.deviceId);
  }

  /**
   * Check if a device is paired (has a trusted device file on disk).
   */
  isPaired(deviceId: string): boolean {
    const filePath = path.join(this.trustedDevicesDir, `${deviceId}.json`);
    return fs.existsSync(filePath);
  }

  /**
   * Send unpair and remove trusted device.
   */
  unpair(deviceId: string, connection?: DeviceConnection): void {
    if (connection?.connected) {
      connection.send(MSG_UNPAIR, { deviceId });
    }

    this.removeTrustedDevice(deviceId);
    this.logger.info('protocol.pairing', 'Unpaired device', { deviceId });
    this.fireUnpaired(deviceId);
  }

  /**
   * Load trusted device IDs from disk.
   */
  loadTrustedDevices(): string[] {
    if (!fs.existsSync(this.trustedDevicesDir)) {
      return [];
    }

    return fs.readdirSync(this.trustedDevicesDir)
      .filter((f) => f.endsWith('.json') || f.endsWith('.pem'))
      .map((f) => f.replace(/\.(json|pem)$/, ''));
  }

  /**
   * Accept an incoming pairing request (called from IPC when user approves).
   * Generates code and sends to phone.
   */
  acceptIncomingPairing(deviceId: string): void {
    // For v2, accepting an incoming request means we generate a code
    // and send it. The phone will confirm.
    // This is handled by the IPC layer calling requestPairing on the connection.
    this.logger.info('protocol.pairing', 'Incoming pairing accepted by user', { deviceId });
  }

  /**
   * Reject a pending incoming pairing request.
   */
  rejectIncomingPairing(deviceId: string): void {
    this.logger.info('protocol.pairing', 'Incoming pairing rejected by user', { deviceId });
    this.firePairingResult(deviceId, false);
  }

  /**
   * Get all pending incoming pairing requests.
   */
  getPendingIncoming(): IncomingPairingRequest[] {
    return [];
  }

  // --- Callbacks ---

  onPairingResult(callback: PairingResultCallback): void {
    this.resultCallbacks.push(callback);
  }

  onUnpaired(callback: UnpairedCallback): void {
    this.unpairedCallbacks.push(callback);
  }

  onIncomingPairing(callback: IncomingPairingCallback): void {
    this.incomingPairingCallbacks.push(callback);
  }

  onPairingCode(callback: PairingCodeCallback): void {
    this.pairingCodeCallbacks.push(callback);
  }

  cleanup(): void {
    for (const [, pending] of this.pendingPairings) {
      clearTimeout(pending.timeoutId);
    }
    this.pendingPairings.clear();
  }

  // --- Internal ---

  private generateCode(): string {
    // Generate 6-digit numeric code
    const num = crypto.randomInt(0, 1000000);
    return num.toString().padStart(6, '0');
  }

  private storeTrustedDevice(deviceId: string, deviceName: string): void {
    const device: TrustedDevice = {
      deviceId,
      deviceName,
      pairedAt: Date.now(),
    };

    fs.mkdirSync(this.trustedDevicesDir, { recursive: true });
    fs.writeFileSync(
      path.join(this.trustedDevicesDir, `${deviceId}.json`),
      JSON.stringify(device, null, 2),
      { mode: 0o644 },
    );
  }

  private removeTrustedDevice(deviceId: string): void {
    // Remove both .json (v2) and .pem (v1) files
    const jsonFile = path.join(this.trustedDevicesDir, `${deviceId}.json`);
    const pemFile = path.join(this.trustedDevicesDir, `${deviceId}.pem`);

    if (fs.existsSync(jsonFile)) fs.unlinkSync(jsonFile);
    if (fs.existsSync(pemFile)) fs.unlinkSync(pemFile);
  }

  private clearPending(deviceId: string): void {
    const pending = this.pendingPairings.get(deviceId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingPairings.delete(deviceId);
    }
  }

  private firePairingResult(deviceId: string, success: boolean, code?: string): void {
    for (const cb of this.resultCallbacks) {
      cb(deviceId, success, code);
    }
  }

  private fireUnpaired(deviceId: string): void {
    for (const cb of this.unpairedCallbacks) {
      cb(deviceId);
    }
  }

  private fireIncomingPairing(request: IncomingPairingRequest): void {
    for (const cb of this.incomingPairingCallbacks) {
      cb(request);
    }
  }

  private firePairingCode(deviceId: string, deviceName: string, code: string): void {
    for (const cb of this.pairingCodeCallbacks) {
      cb(deviceId, deviceName, code);
    }
  }
}
