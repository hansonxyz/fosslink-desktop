/**
 * IPC Client
 *
 * JSON-RPC 2.0 client for connecting to the daemon's IPC socket.
 * Used by both the CLI and future Electron UI.
 */

import * as net from 'node:net';
import { getSocketPath } from '../utils/paths.js';
import {
  serializeMessage,
  parseMessage,
  isResponse,
  isNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './json-rpc.js';

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type NotificationCallback = (method: string, params: unknown) => void;

export class IpcClient {
  private socketPath: string;
  private socket: net.Socket | undefined;
  private buffer = '';
  private nextId = 1;
  private pending = new Map<string | number, PendingRequest>();
  private notificationCallbacks: NotificationCallback[] = [];
  private connected = false;

  constructor(socketPath?: string) {
    this.socketPath = socketPath ?? getSocketPath();
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.connect(this.socketPath, () => {
        this.connected = true;
        resolve();
      });

      this.socket.on('error', (err) => {
        if (!this.connected) {
          reject(err);
        } else {
          this.handleDisconnect();
        }
      });

      this.socket.on('close', () => {
        this.handleDisconnect();
      });

      this.socket.on('data', (chunk: Buffer) => {
        this.buffer += chunk.toString();
        let idx = this.buffer.indexOf('\n');
        while (idx !== -1) {
          const line = this.buffer.substring(0, idx);
          this.buffer = this.buffer.substring(idx + 1);
          this.handleMessage(line);
          idx = this.buffer.indexOf('\n');
        }
      });
    });
  }

  disconnect(): void {
    this.connected = false;
    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }
    this.rejectAllPending('Client disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  call(method: string, params?: Record<string, unknown>, timeoutMs = 10000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.connected) {
        reject(new Error('Not connected'));
        return;
      }

      const id = this.nextId++;
      const request: JsonRpcRequest = { jsonrpc: '2.0', method, id };
      if (params !== undefined) {
        request.params = params;
      }

      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.socket.write(serializeMessage(request));
    });
  }

  onNotification(callback: NotificationCallback): void {
    this.notificationCallbacks.push(callback);
  }

  private handleMessage(line: string): void {
    let msg: ReturnType<typeof parseMessage>;
    try {
      msg = parseMessage(line);
    } catch {
      return; // Ignore malformed messages
    }

    if (isResponse(msg)) {
      this.handleResponse(msg);
    } else if (isNotification(msg)) {
      for (const cb of this.notificationCallbacks) {
        cb(msg.method, msg.params);
      }
    }
  }

  private handleResponse(resp: JsonRpcResponse): void {
    const id = resp.id;
    if (id === null) return;

    const pending = this.pending.get(id);
    if (!pending) return;

    this.pending.delete(id);
    clearTimeout(pending.timer);

    if (resp.error) {
      pending.reject(new Error(resp.error.message));
    } else {
      pending.resolve(resp.result);
    }
  }

  private handleDisconnect(): void {
    this.connected = false;
    this.rejectAllPending('Connection lost');
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this.pending.delete(id);
    }
  }
}
