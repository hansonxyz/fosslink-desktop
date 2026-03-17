import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { IpcServer } from '../../../src/ipc/server.js';
import {
  serializeMessage,
  parseMessage,
  isResponse,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcNotification,
} from '../../../src/ipc/json-rpc.js';

function tmpSocketPath(): string {
  return path.join(os.tmpdir(), `xyz-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`);
}

function connectClient(socketPath: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const client = net.connect(socketPath, () => resolve(client));
    client.on('error', reject);
  });
}

function sendAndReceive(client: net.Socket, request: JsonRpcRequest): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const idx = buffer.indexOf('\n');
      if (idx !== -1) {
        client.removeListener('data', onData);
        const line = buffer.substring(0, idx);
        const msg = parseMessage(line);
        if (isResponse(msg)) {
          resolve(msg);
        } else {
          reject(new Error('Expected response, got: ' + line));
        }
      }
    };
    client.on('data', onData);
    client.write(serializeMessage(request));
    setTimeout(() => reject(new Error('Response timeout')), 5000);
  });
}

function waitForNotification(client: net.Socket): Promise<JsonRpcNotification> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      const idx = buffer.indexOf('\n');
      if (idx !== -1) {
        client.removeListener('data', onData);
        const line = buffer.substring(0, idx);
        resolve(parseMessage(line) as JsonRpcNotification);
      }
    };
    client.on('data', onData);
    setTimeout(() => reject(new Error('Notification timeout')), 5000);
  });
}

describe('IpcServer', () => {
  let server: IpcServer;
  let socketPath: string;
  let clients: net.Socket[];

  beforeEach(() => {
    socketPath = tmpSocketPath();
    server = new IpcServer(socketPath);
    clients = [];
  });

  afterEach(async () => {
    for (const c of clients) {
      c.destroy();
    }
    await server.stop();
    try { fs.unlinkSync(socketPath); } catch { /* ignore */ }
  });

  it('starts and accepts client connections', async () => {
    await server.start();
    const client = await connectClient(socketPath);
    clients.push(client);
    expect(server.getClientCount()).toBe(1);
  });

  it('tracks multiple clients', async () => {
    await server.start();
    const c1 = await connectClient(socketPath);
    const c2 = await connectClient(socketPath);
    clients.push(c1, c2);
    // Give time for both connections to register
    await new Promise((r) => setTimeout(r, 50));
    expect(server.getClientCount()).toBe(2);
  });

  it('registers and dispatches method handlers', async () => {
    server.registerMethod('echo', async (params) => {
      return { echo: params };
    });
    await server.start();
    const client = await connectClient(socketPath);
    clients.push(client);

    const resp = await sendAndReceive(client, {
      jsonrpc: '2.0',
      method: 'echo',
      params: { msg: 'hello' },
      id: 1,
    });

    expect(resp.result).toEqual({ echo: { msg: 'hello' } });
    expect(resp.id).toBe(1);
  });

  it('returns method-not-found for unknown methods', async () => {
    await server.start();
    const client = await connectClient(socketPath);
    clients.push(client);

    const resp = await sendAndReceive(client, {
      jsonrpc: '2.0',
      method: 'nonexistent',
      id: 2,
    });

    expect(resp.error).toBeDefined();
    expect(resp.error?.code).toBe(-32601);
    expect(resp.id).toBe(2);
  });

  it('returns parse error for malformed messages', async () => {
    await server.start();
    const client = await connectClient(socketPath);
    clients.push(client);

    const resp = await new Promise<JsonRpcResponse>((resolve, reject) => {
      let buffer = '';
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString();
        const idx = buffer.indexOf('\n');
        if (idx !== -1) {
          client.removeListener('data', onData);
          resolve(parseMessage(buffer.substring(0, idx)) as JsonRpcResponse);
        }
      };
      client.on('data', onData);
      client.write('not valid json\n');
      setTimeout(() => reject(new Error('timeout')), 5000);
    });

    expect(resp.error).toBeDefined();
    expect(resp.error?.code).toBe(-32700);
    expect(resp.id).toBe(null);
  });

  it('returns internal error when handler throws', async () => {
    server.registerMethod('fail', async () => {
      throw new Error('something broke');
    });
    await server.start();
    const client = await connectClient(socketPath);
    clients.push(client);

    const resp = await sendAndReceive(client, {
      jsonrpc: '2.0',
      method: 'fail',
      id: 3,
    });

    expect(resp.error).toBeDefined();
    expect(resp.error?.code).toBe(-32603);
    expect(resp.error?.message).toContain('something broke');
    expect(resp.id).toBe(3);
  });

  it('broadcasts notifications to all connected clients', async () => {
    await server.start();
    const c1 = await connectClient(socketPath);
    const c2 = await connectClient(socketPath);
    clients.push(c1, c2);
    await new Promise((r) => setTimeout(r, 50));

    const p1 = waitForNotification(c1);
    const p2 = waitForNotification(c2);

    server.broadcast({
      jsonrpc: '2.0',
      method: 'state.changed',
      params: { from: 'A', to: 'B' },
    });

    const [n1, n2] = await Promise.all([p1, p2]);
    expect(n1.method).toBe('state.changed');
    expect(n1.params).toEqual({ from: 'A', to: 'B' });
    expect(n2.method).toBe('state.changed');
  });

  it('cleans up client on disconnect', async () => {
    await server.start();
    const client = await connectClient(socketPath);
    clients.push(client);
    expect(server.getClientCount()).toBe(1);

    client.destroy();
    await new Promise((r) => setTimeout(r, 100));
    expect(server.getClientCount()).toBe(0);
  });

  it('removes stale socket file on start', async () => {
    // Create a stale socket file
    fs.writeFileSync(socketPath, '');
    expect(fs.existsSync(socketPath)).toBe(true);

    await server.start();
    // Server should have replaced the stale file and be listening
    const client = await connectClient(socketPath);
    clients.push(client);
    expect(server.getClientCount()).toBe(1);
  });

  it('handles multiple sequential requests on same connection', async () => {
    server.registerMethod('add', async (params) => {
      const p = (params ?? {}) as Record<string, number>;
      return { sum: (p['a'] ?? 0) + (p['b'] ?? 0) };
    });
    await server.start();
    const client = await connectClient(socketPath);
    clients.push(client);

    const r1 = await sendAndReceive(client, {
      jsonrpc: '2.0',
      method: 'add',
      params: { a: 1, b: 2 },
      id: 1,
    });
    expect(r1.result).toEqual({ sum: 3 });

    const r2 = await sendAndReceive(client, {
      jsonrpc: '2.0',
      method: 'add',
      params: { a: 10, b: 20 },
      id: 2,
    });
    expect(r2.result).toEqual({ sum: 30 });
  });

  it('handles handler with no params', async () => {
    server.registerMethod('ping', async () => {
      return { pong: true };
    });
    await server.start();
    const client = await connectClient(socketPath);
    clients.push(client);

    const resp = await sendAndReceive(client, {
      jsonrpc: '2.0',
      method: 'ping',
      id: 99,
    });

    expect(resp.result).toEqual({ pong: true });
  });
});
