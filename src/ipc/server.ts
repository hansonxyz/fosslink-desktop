/**
 * IPC Server
 *
 * JSON-RPC 2.0 server over Unix socket (Linux/macOS) or named pipe (Windows).
 * Accepts multiple client connections, dispatches method calls to registered
 * handlers, and broadcasts notifications to all connected clients.
 */

import * as net from 'node:net';
import * as fs from 'node:fs';
import { createLogger } from '../utils/logger.js';
import {
  serializeMessage,
  parseMessage,
  createResponse,
  createErrorResponse,
  isRequest,
  PARSE_ERROR,
  METHOD_NOT_FOUND,
  INTERNAL_ERROR,
  type JsonRpcNotification,
} from './json-rpc.js';

type MethodHandler = (params: Record<string, unknown> | undefined) => Promise<unknown>;

const log = createLogger('ipc-server');

export class IpcServer {
  private socketPath: string;
  private server: net.Server | undefined;
  private clients = new Set<net.Socket>();
  private clientBuffers = new Map<net.Socket, string>();
  private methods = new Map<string, MethodHandler>();

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  registerMethod(name: string, handler: MethodHandler): void {
    this.methods.set(name, handler);
  }

  async start(): Promise<void> {
    // Remove stale socket file if it exists
    if (process.platform !== 'win32') {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // Doesn't exist, that's fine
      }
    }

    this.server = net.createServer((socket) => this.handleConnection(socket));

    return new Promise<void>((resolve, reject) => {
      this.server!.on('error', reject);
      this.server!.listen(this.socketPath, () => {
        this.server!.removeListener('error', reject);
        log.info('ipc.server', 'IPC server listening', { socketPath: this.socketPath });
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();
    this.clientBuffers.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = undefined;
    }

    // Remove socket file
    if (process.platform !== 'win32') {
      try {
        fs.unlinkSync(this.socketPath);
      } catch {
        // Already gone
      }
    }
  }

  broadcast(notification: JsonRpcNotification): void {
    const data = serializeMessage(notification);
    for (const client of this.clients) {
      client.write(data);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  private handleConnection(socket: net.Socket): void {
    this.clients.add(socket);
    this.clientBuffers.set(socket, '');
    log.debug('ipc.server', 'Client connected', { clientCount: this.clients.size });

    socket.on('data', (chunk: Buffer) => {
      let buffer = this.clientBuffers.get(socket) || '';
      buffer += chunk.toString();

      let idx = buffer.indexOf('\n');
      while (idx !== -1) {
        const line = buffer.substring(0, idx);
        buffer = buffer.substring(idx + 1);
        this.handleMessage(line, socket);
        idx = buffer.indexOf('\n');
      }

      this.clientBuffers.set(socket, buffer);
    });

    socket.on('close', () => {
      this.clients.delete(socket);
      this.clientBuffers.delete(socket);
      log.debug('ipc.server', 'Client disconnected', { clientCount: this.clients.size });
    });

    socket.on('error', (err) => {
      log.warn('ipc.server', 'Client socket error', { error: err.message });
      this.clients.delete(socket);
      this.clientBuffers.delete(socket);
    });
  }

  private handleMessage(line: string, socket: net.Socket): void {
    let msg: ReturnType<typeof parseMessage>;
    try {
      msg = parseMessage(line);
    } catch {
      socket.write(serializeMessage(
        createErrorResponse(null, PARSE_ERROR, 'Parse error'),
      ));
      return;
    }

    if (!isRequest(msg)) {
      // Notifications from client are ignored (server doesn't process them)
      return;
    }

    const handler = this.methods.get(msg.method);
    if (!handler) {
      socket.write(serializeMessage(
        createErrorResponse(msg.id, METHOD_NOT_FOUND, `Method not found: ${msg.method}`),
      ));
      return;
    }

    handler(msg.params)
      .then((result) => {
        socket.write(serializeMessage(createResponse(msg.id, result)));
      })
      .catch((err: Error) => {
        socket.write(serializeMessage(
          createErrorResponse(msg.id, INTERNAL_ERROR, err.message),
        ));
      });
  }
}
