import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { IpcClient } from '../../../src/ipc/client.js';
import {
  serializeMessage,
  parseMessage,
  createResponse,
  createErrorResponse,
  createNotification,
  isRequest,
  INTERNAL_ERROR,
  type JsonRpcRequest,
} from '../../../src/ipc/json-rpc.js';

function tmpSocketPath(): string {
  return path.join(os.tmpdir(), `xyz-client-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`);
}

describe('IpcClient', () => {
  let socketPath: string;
  let mockServer: net.Server;
  let serverConnections: net.Socket[];

  beforeEach(() => {
    socketPath = tmpSocketPath();
    serverConnections = [];
  });

  afterEach(async () => {
    for (const conn of serverConnections) {
      conn.destroy();
    }
    if (mockServer) {
      await new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
      });
    }
    try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
  });

  function startMockServer(onRequest?: (req: JsonRpcRequest, socket: net.Socket) => void): Promise<void> {
    return new Promise((resolve) => {
      mockServer = net.createServer((socket) => {
        serverConnections.push(socket);
        let buffer = '';
        socket.on('data', (chunk) => {
          buffer += chunk.toString();
          let idx = buffer.indexOf('\n');
          while (idx !== -1) {
            const line = buffer.substring(0, idx);
            buffer = buffer.substring(idx + 1);
            try {
              const msg = parseMessage(line);
              if (isRequest(msg) && onRequest) {
                onRequest(msg, socket);
              }
            } catch {
              // ignore parse errors in mock
            }
            idx = buffer.indexOf('\n');
          }
        });
      });
      mockServer.listen(socketPath, () => resolve());
    });
  }

  it('connects and disconnects', async () => {
    await startMockServer();
    const client = new IpcClient(socketPath);
    await client.connect();
    expect(client.isConnected()).toBe(true);
    client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  it('rejects connect when no server running', async () => {
    const client = new IpcClient(socketPath);
    await expect(client.connect()).rejects.toThrow();
  });

  it('sends request and receives response', async () => {
    await startMockServer((req, socket) => {
      if (req.method === 'echo') {
        socket.write(serializeMessage(createResponse(req.id, { echo: req.params })));
      }
    });

    const client = new IpcClient(socketPath);
    await client.connect();

    const result = await client.call('echo', { msg: 'hello' });
    expect(result).toEqual({ echo: { msg: 'hello' } });

    client.disconnect();
  });

  it('handles error responses', async () => {
    await startMockServer((req, socket) => {
      socket.write(serializeMessage(
        createErrorResponse(req.id, INTERNAL_ERROR, 'Something failed'),
      ));
    });

    const client = new IpcClient(socketPath);
    await client.connect();

    await expect(client.call('failing.method')).rejects.toThrow('Something failed');

    client.disconnect();
  });

  it('times out on no response', async () => {
    await startMockServer(() => {
      // Intentionally don't respond
    });

    const client = new IpcClient(socketPath);
    await client.connect();

    await expect(client.call('silent.method', undefined, 500)).rejects.toThrow('timeout');

    client.disconnect();
  });

  it('handles multiple concurrent requests', async () => {
    await startMockServer((req, socket) => {
      // Respond with different delays to test out-of-order responses
      const delay = req.method === 'slow' ? 100 : 10;
      setTimeout(() => {
        socket.write(serializeMessage(createResponse(req.id, { method: req.method })));
      }, delay);
    });

    const client = new IpcClient(socketPath);
    await client.connect();

    const [r1, r2] = await Promise.all([
      client.call('slow'),
      client.call('fast'),
    ]);

    expect(r1).toEqual({ method: 'slow' });
    expect(r2).toEqual({ method: 'fast' });

    client.disconnect();
  });

  it('receives server notifications', async () => {
    await startMockServer();
    const client = new IpcClient(socketPath);
    await client.connect();

    const notifications: Array<{ method: string; params: unknown }> = [];
    client.onNotification((method, params) => {
      notifications.push({ method, params });
    });

    // Wait for connection to be tracked by server
    await new Promise((r) => setTimeout(r, 50));

    // Server sends a notification
    for (const conn of serverConnections) {
      conn.write(serializeMessage(createNotification('state.changed', { from: 'A', to: 'B' })));
    }

    await new Promise((r) => setTimeout(r, 100));

    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.method).toBe('state.changed');
    expect(notifications[0]!.params).toEqual({ from: 'A', to: 'B' });

    client.disconnect();
  });

  it('rejects pending requests on disconnect', async () => {
    await startMockServer(() => {
      // Don't respond
    });

    const client = new IpcClient(socketPath);
    await client.connect();

    const callPromise = client.call('test.method', undefined, 5000);
    client.disconnect();

    await expect(callPromise).rejects.toThrow();
  });

  it('handles multiple sequential calls', async () => {
    let callCount = 0;
    await startMockServer((req, socket) => {
      callCount++;
      socket.write(serializeMessage(createResponse(req.id, { count: callCount })));
    });

    const client = new IpcClient(socketPath);
    await client.connect();

    const r1 = await client.call('count');
    const r2 = await client.call('count');
    const r3 = await client.call('count');

    expect(r1).toEqual({ count: 1 });
    expect(r2).toEqual({ count: 2 });
    expect(r3).toEqual({ count: 3 });

    client.disconnect();
  });
});
