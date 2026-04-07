/**
 * WebSocket Server
 *
 * Manages WebSocket connections from Android clients. Handles identity
 * exchange (first message), connection tracking, and message routing.
 *
 * Replaces the TCP/TLS ConnectionManager from v1. No role inversion,
 * no capability negotiation — just WSS with self-signed cert.
 */

import * as https from 'node:https';
import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { createLogger } from '../utils/logger.js';
import type { Logger } from '../utils/logger.js';
import {
  MSG_IDENTITY,
  createIdentityMessage,
  serializeMessage,
  parseMessage,
  validateIdentityMessage,
} from './packet.js';
import type { ProtocolMessage, IdentityBody } from './packet.js';

export const WS_PORT = 8716;

export interface DeviceConnection {
  deviceId: string;
  deviceName: string;
  ws: WebSocket;
  connected: boolean;
  clientVersion?: string;
  minPeerVersion?: string;
  rootEnabled?: boolean;
  remoteAddress?: string;
  /** Send a protocol message to this device. */
  send(type: string, body: Record<string, unknown>): void;
  /** Close the connection. */
  close(): void;
}

type ConnectionCallback = (connection: DeviceConnection) => void;
type DisconnectionCallback = (deviceId: string) => void;
type MessageCallback = (msg: ProtocolMessage, connection: DeviceConnection) => void;

const IDENTITY_TIMEOUT = 10000;

/** How often to ping connected clients (ms) */
const PING_INTERVAL_MS = 30_000;

export class WsServer {
  private httpsServer: https.Server | undefined;
  private wss: WSServer | undefined;
  private connections = new Map<string, DeviceConnection>();
  private connectionCallbacks: ConnectionCallback[] = [];
  private disconnectionCallbacks: DisconnectionCallback[] = [];
  private messageCallbacks: MessageCallback[] = [];
  private logger: Logger;
  private port = 0;
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private alive = new Set<WebSocket>();

  private deviceId: string | undefined;
  private deviceName = 'FossLink';

  constructor() {
    this.logger = createLogger('ws-server');
  }

  /**
   * Start the WebSocket server on the specified port with TLS.
   */
  async start(deviceId: string, cert: string, key: string, deviceName?: string): Promise<void> {
    this.deviceId = deviceId;
    if (deviceName) this.deviceName = deviceName;

    this.httpsServer = https.createServer({
      cert,
      key,
      // Don't require client certificates — authentication is via pairing
      requestCert: false,
      rejectUnauthorized: false,
    });

    this.wss = new WSServer({ server: this.httpsServer });

    this.wss.on('connection', (ws, req) => {
      let remoteAddress = req.socket.remoteAddress ?? 'unknown';
      // Strip IPv6-mapped IPv4 prefix (::ffff:192.168.x.x → 192.168.x.x)
      if (remoteAddress.startsWith('::ffff:')) {
        remoteAddress = remoteAddress.slice(7);
      }
      this.logger.info('network.ws', 'New WebSocket connection', { remoteAddress });
      this.handleNewConnection(ws, remoteAddress);
    });

    await new Promise<void>((resolve, reject) => {
      this.httpsServer!.once('error', reject);
      this.httpsServer!.listen(WS_PORT, '0.0.0.0', () => {
        this.httpsServer!.removeListener('error', reject);
        this.port = WS_PORT;
        this.logger.info('network.ws', 'WebSocket server listening', { port: WS_PORT });
        resolve();
      });
    });

    // Ping/pong heartbeat to detect stale connections (e.g. after OS standby/resume)
    this.pingTimer = setInterval(() => {
      for (const [, conn] of this.connections) {
        if (!this.alive.has(conn.ws)) {
          // No pong since last ping — connection is dead
          this.logger.info('network.ws', 'Connection stale (no pong), terminating', {
            deviceId: conn.deviceId,
            deviceName: conn.deviceName,
          });
          conn.ws.terminate();
          continue;
        }
        this.alive.delete(conn.ws);
        conn.ws.ping();
      }
    }, PING_INTERVAL_MS);
  }

  /**
   * Stop the server and close all connections.
   */
  async stop(): Promise<void> {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
    this.alive.clear();

    for (const [, conn] of this.connections) {
      conn.ws.close();
    }
    this.connections.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = undefined;
    }

    if (this.httpsServer) {
      await new Promise<void>((resolve) => {
        this.httpsServer!.close(() => resolve());
      });
      this.httpsServer = undefined;
    }

    this.port = 0;
  }

  getPort(): number {
    return this.port;
  }

  getConnection(deviceId: string): DeviceConnection | undefined {
    return this.connections.get(deviceId);
  }

  getConnectedDeviceIds(): string[] {
    return Array.from(this.connections.keys());
  }

  getConnectedDevices(): Array<{ deviceId: string; deviceName: string }> {
    return Array.from(this.connections.values()).map((c) => ({
      deviceId: c.deviceId,
      deviceName: c.deviceName,
    }));
  }

  /**
   * Immediately ping all connections and terminate any that don't respond.
   * Call after OS resume to quickly detect stale connections.
   */
  pingAll(): void {
    for (const [, conn] of this.connections) {
      this.alive.delete(conn.ws);
      conn.ws.ping();
    }
    // Check for pong responses after a short delay
    setTimeout(() => {
      for (const [, conn] of this.connections) {
        if (!this.alive.has(conn.ws)) {
          this.logger.info('network.ws', 'Connection stale after resume ping, terminating', {
            deviceId: conn.deviceId,
          });
          conn.ws.terminate();
        }
      }
    }, 5000);
  }

  onConnection(callback: ConnectionCallback): void {
    this.connectionCallbacks.push(callback);
  }

  onDisconnection(callback: DisconnectionCallback): void {
    this.disconnectionCallbacks.push(callback);
  }

  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  /**
   * Connect to a remote WebSocket server (used for testing or direct connect).
   */
  connectToAddress(address: string, port: number): void {
    const url = `wss://${address}:${port}`;
    this.logger.info('network.ws', 'Connecting to remote WebSocket', { url });

    const ws = new WebSocket(url, {
      rejectUnauthorized: false, // Accept self-signed certs
    });

    ws.on('open', () => {
      this.logger.info('network.ws', 'Outgoing WebSocket connected', { url });
      this.handleNewConnection(ws, address);
    });

    ws.on('error', (err) => {
      this.logger.debug('network.ws', 'Outgoing WebSocket connection error', {
        url,
        error: err.message,
      });
    });
  }

  /**
   * Handle a new WebSocket connection. Waits for identity message,
   * then stores the connection and fires callbacks.
   */
  private handleNewConnection(ws: WebSocket, remoteAddress: string): void {
    let identityReceived = false;

    const identityTimeout = setTimeout(() => {
      if (!identityReceived) {
        this.logger.warn('network.ws', 'Identity timeout, closing connection', { remoteAddress });
        ws.close();
      }
    }, IDENTITY_TIMEOUT);

    // Send our identity immediately
    const ourIdentity = createIdentityMessage({
      deviceId: this.deviceId!,
      deviceName: this.deviceName,
    });
    ws.send(serializeMessage(ourIdentity));

    ws.on('message', (data) => {
      const raw = data.toString();

      if (!identityReceived) {
        // First message must be identity
        clearTimeout(identityTimeout);
        identityReceived = true;

        try {
          const msg = parseMessage(raw);
          if (msg.type !== MSG_IDENTITY) {
            this.logger.warn('network.ws', 'First message was not identity', {
              type: msg.type,
              remoteAddress,
            });
            ws.close();
            return;
          }

          const identity = validateIdentityMessage(msg);
          this.storeConnection(ws, identity, remoteAddress);
        } catch (err) {
          this.logger.error('network.ws', 'Failed to parse identity', {
            error: err instanceof Error ? err.message : String(err),
            remoteAddress,
          });
          ws.close();
        }
        return;
      }

      // Subsequent messages — route via message callbacks
      try {
        const msg = parseMessage(raw);
        const conn = this.findConnectionByWs(ws);
        if (conn) {
          for (const cb of this.messageCallbacks) {
            cb(msg, conn);
          }
        }
      } catch (err) {
        this.logger.warn('network.ws', 'Failed to parse message', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    // Mark alive on pong (heartbeat response)
    ws.on('pong', () => {
      this.alive.add(ws);
    });

    ws.on('error', (err) => {
      this.logger.error('network.ws', 'WebSocket error', {
        error: err.message,
        remoteAddress,
      });
    });

    ws.on('close', () => {
      clearTimeout(identityTimeout);
      if (!identityReceived) return;

      const conn = this.findConnectionByWs(ws);
      if (conn) {
        this.handleDisconnection(conn);
      }
    });
  }

  private storeConnection(ws: WebSocket, identity: IdentityBody, remoteAddress: string): void {
    // Close existing connection for this device if any
    const existing = this.connections.get(identity.deviceId);
    if (existing) {
      this.logger.info('network.ws', 'Replacing existing connection', {
        deviceId: identity.deviceId,
      });
      existing.ws.close();
      this.connections.delete(identity.deviceId);
    }

    const conn: DeviceConnection = {
      deviceId: identity.deviceId,
      deviceName: identity.deviceName,
      ws,
      connected: true,
      clientVersion: identity.clientVersion,
      minPeerVersion: identity.minPeerVersion,
      remoteAddress,
      send(type: string, body: Record<string, unknown>): void {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(serializeMessage({ type, body }));
        }
      },
      close(): void {
        ws.close();
      },
    };

    this.connections.set(identity.deviceId, conn);
    this.alive.add(ws); // Mark alive for ping/pong heartbeat

    this.logger.info('network.ws', 'Connection established', {
      deviceId: identity.deviceId,
      deviceName: identity.deviceName,
      clientVersion: identity.clientVersion,
      remoteAddress,
    });

    for (const cb of this.connectionCallbacks) {
      cb(conn);
    }
  }

  private handleDisconnection(conn: DeviceConnection): void {
    if (!conn.connected) return;
    conn.connected = false;
    this.alive.delete(conn.ws);

    // Only fire disconnect if we're still the current connection
    if (this.connections.get(conn.deviceId) === conn) {
      this.connections.delete(conn.deviceId);

      this.logger.info('network.ws', 'Connection closed', {
        deviceId: conn.deviceId,
      });

      for (const cb of this.disconnectionCallbacks) {
        cb(conn.deviceId);
      }
    }
  }

  private findConnectionByWs(ws: WebSocket): DeviceConnection | undefined {
    for (const conn of this.connections.values()) {
      if (conn.ws === ws) return conn;
    }
    return undefined;
  }
}
