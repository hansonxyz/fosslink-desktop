import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { IpcServer } from '../../../src/ipc/server.js';
import { registerHandlers, registerNotifications } from '../../../src/ipc/handlers.js';
import {
  serializeMessage,
  parseMessage,
  isResponse,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcNotification,
} from '../../../src/ipc/json-rpc.js';
import { AppState } from '../../../src/core/state-machine.js';

function tmpSocketPath(): string {
  return path.join(os.tmpdir(), `xyz-handler-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sock`);
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

// Mock daemon with all necessary getters
function createMockDaemon() {
  const stateListeners: Array<(t: { from: string; to: string; context: Record<string, unknown>; timestamp: number }) => void> = [];
  const deviceFoundCallbacks: Array<(d: Record<string, unknown>) => void> = [];
  const deviceLostCallbacks: Array<(id: string) => void> = [];
  const connectionCallbacks: Array<(c: { deviceId: string; deviceName: string }) => void> = [];
  const disconnectionCallbacks: Array<(id: string) => void> = [];
  const pairingResultCallbacks: Array<(id: string, success: boolean, key?: string) => void> = [];

  const mockStateMachine = {
    getState: vi.fn().mockReturnValue(AppState.DISCOVERING),
    getContext: vi.fn().mockReturnValue({
      uptime: 120,
      lastTransitionTime: Date.now(),
    }),
    getHistory: vi.fn().mockReturnValue([
      { from: 'INIT', to: 'DISCONNECTED', timestamp: Date.now() - 1000, context: {} },
    ]),
    onTransition: vi.fn().mockImplementation((listener: (t: { from: string; to: string; context: Record<string, unknown>; timestamp: number }) => void) => {
      stateListeners.push(listener);
      return () => {};
    }),
  };

  const discoveredDevices = new Map<string, Record<string, unknown>>();

  const mockDiscoveryService = {
    getDiscoveredDevices: vi.fn().mockReturnValue(discoveredDevices),
    onDeviceFound: vi.fn().mockImplementation((cb: (d: Record<string, unknown>) => void) => { deviceFoundCallbacks.push(cb); }),
    onDeviceLost: vi.fn().mockImplementation((cb: (id: string) => void) => { deviceLostCallbacks.push(cb); }),
    sendDirectDiscovery: vi.fn(),
    sendConnectRequest: vi.fn(),
  };

  const connections = new Map<string, { deviceId: string; deviceName: string; send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }>();

  const mockWsServer = {
    getConnection: vi.fn().mockImplementation((id: string) => connections.get(id)),
    getConnectedDevices: vi.fn().mockReturnValue([]),
    onConnection: vi.fn().mockImplementation((cb: (c: { deviceId: string; deviceName: string }) => void) => { connectionCallbacks.push(cb); }),
    onDisconnection: vi.fn().mockImplementation((cb: (id: string) => void) => { disconnectionCallbacks.push(cb); }),
  };

  const mockPairingHandler = {
    isPaired: vi.fn().mockReturnValue(false),
    loadTrustedDevices: vi.fn().mockReturnValue(['device-aaa', 'device-bbb']),
    requestPairing: vi.fn().mockReturnValue({ verificationKey: 'AB12CD34' }),
    unpair: vi.fn(),
    getPendingIncoming: vi.fn().mockReturnValue([]),
    acceptIncomingPairing: vi.fn(),
    rejectIncomingPairing: vi.fn(),
    onPairingResult: vi.fn().mockImplementation((cb: (id: string, success: boolean, key?: string) => void) => { pairingResultCallbacks.push(cb); }),
    onPairingCode: vi.fn(),
    onIncomingPairing: vi.fn(),
  };

  const messagesCallbacks: Array<(threadId: number, messages: unknown[]) => void> = [];
  const conversationsUpdatedCallbacks: Array<(conversations: unknown[]) => void> = [];
  const contactsUpdatedCallbacks: Array<(contacts: unknown[]) => void> = [];
  const notifReceivedCallbacks: Array<(notif: Record<string, unknown>) => void> = [];
  const notifDismissedCallbacks: Array<(id: string) => void> = [];

  const attachmentDownloadedCallbacks: Array<(partId: number, messageId: number, localPath: string) => void> = [];

  const mockSmsHandler = {
    onMessages: vi.fn().mockImplementation((cb: (threadId: number, messages: unknown[]) => void) => { messagesCallbacks.push(cb); }),
    onConversationsUpdated: vi.fn().mockImplementation((cb: (conversations: unknown[]) => void) => { conversationsUpdatedCallbacks.push(cb); }),
    onAttachmentDownloaded: vi.fn().mockImplementation((cb: (partId: number, messageId: number, localPath: string) => void) => { attachmentDownloadedCallbacks.push(cb); }),
    onSendStatus: vi.fn(),
    queueMessage: vi.fn().mockReturnValue('send_1_123'),
    cancelSend: vi.fn().mockReturnValue(true),
    flushSendQueue: vi.fn(),
    downloadAttachment: vi.fn().mockResolvedValue('/tmp/attachment.jpg'),
    deleteMessage: vi.fn(),
    deleteConversation: vi.fn(),
  };

  const mockContactsHandler = {
    onContactsUpdated: vi.fn().mockImplementation((cb: (contacts: unknown[]) => void) => { contactsUpdatedCallbacks.push(cb); }),
  };

  const mockNotificationHandler = {
    onNotificationReceived: vi.fn().mockImplementation((cb: (notif: Record<string, unknown>) => void) => { notifReceivedCallbacks.push(cb); }),
    onNotificationDismissed: vi.fn().mockImplementation((cb: (id: string) => void) => { notifDismissedCallbacks.push(cb); }),
  };

  const mockEnhancedSyncHandler = {
    onSyncStarted: vi.fn(),
    onSyncProgress: vi.fn(),
    onSyncComplete: vi.fn(),
  };

  const mockEventHandler = {
    onEventReceived: vi.fn(),
  };

  const mockDatabaseService = {
    getAllConversations: vi.fn().mockReturnValue([]),
    getThreadMessages: vi.fn().mockReturnValue([]),
    getAllContacts: vi.fn().mockReturnValue([]),
    getRecentNotifications: vi.fn().mockReturnValue([]),
    getAttachment: vi.fn().mockReturnValue({ mime_type: 'image/jpeg', file_size: 12345 }),
    getAttachmentsForMessage: vi.fn().mockReturnValue([{ part_id: 1, message_id: 100, mime_type: 'image/jpeg', file_size: 12345 }]),
  };

  const daemon = {
    getStatus: vi.fn().mockReturnValue({
      state: AppState.DISCOVERING,
      pid: process.pid,
      uptime: 120,
      config: { daemon: { logLevel: 'info' } },
    }),
    stop: vi.fn().mockResolvedValue(undefined),
    getStateMachine: vi.fn().mockReturnValue(mockStateMachine),
    getDiscoveryService: vi.fn().mockReturnValue(mockDiscoveryService),
    getWsServer: vi.fn().mockReturnValue(mockWsServer),
    getPairingHandler: vi.fn().mockReturnValue(mockPairingHandler),
    getSmsHandler: vi.fn().mockReturnValue(mockSmsHandler),
    getContactsHandler: vi.fn().mockReturnValue(mockContactsHandler),
    getNotificationHandler: vi.fn().mockReturnValue(mockNotificationHandler),
    getEnhancedSyncHandler: vi.fn().mockReturnValue(mockEnhancedSyncHandler),
    getEventHandler: vi.fn().mockReturnValue(mockEventHandler),
    getDatabaseService: vi.fn().mockReturnValue(mockDatabaseService),
    startSync: vi.fn(),
    getBattery: vi.fn().mockReturnValue(null),
    onBattery: vi.fn(),
    onUrlShare: vi.fn(),
  };

  return {
    daemon,
    mockStateMachine,
    mockDiscoveryService,
    mockWsServer,
    mockPairingHandler,
    mockSmsHandler,
    mockDatabaseService,
    discoveredDevices,
    connections,
    stateListeners,
    deviceFoundCallbacks,
    deviceLostCallbacks,
    connectionCallbacks,
    disconnectionCallbacks,
    pairingResultCallbacks,
  };
}

describe('IPC Handlers', () => {
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

  describe('registerHandlers', () => {
    it('daemon.status returns daemon status', async () => {
      const { daemon } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'daemon.status', id: 1,
      });

      expect(resp.result).toEqual({
        state: 'DISCOVERING',
        pid: process.pid,
        uptime: 120,
        config: { daemon: { logLevel: 'info' } },
      });
    });

    it('daemon.stop calls daemon stop', async () => {
      const { daemon } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'daemon.stop', id: 2,
      });

      expect(resp.result).toEqual({ ok: true });
      // Stop is deferred so response can be sent first
      await new Promise((r) => setTimeout(r, 200));
      expect(daemon.stop).toHaveBeenCalled();
    });

    it('state.get returns current state', async () => {
      const { daemon } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'state.get', id: 3,
      });

      expect(resp.result).toEqual({ state: 'DISCOVERING' });
    });

    it('state.context returns state context', async () => {
      const { daemon } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'state.context', id: 4,
      });

      const result = resp.result as Record<string, unknown>;
      expect(result['uptime']).toBe(120);
    });

    it('state.history returns transition history', async () => {
      const { daemon } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'state.history', params: { limit: 10 }, id: 5,
      });

      const result = resp.result as Array<Record<string, unknown>>;
      expect(result).toHaveLength(1);
      expect(result[0]!['from']).toBe('INIT');
    });

    it('devices.discovered returns discovered devices as array', async () => {
      const { daemon, discoveredDevices } = createMockDaemon();
      discoveredDevices.set('abc123', {
        deviceId: 'abc123',
        deviceName: 'Pixel 7',
        deviceType: 'phone',
        protocolVersion: 8,
        tcpPort: 1716,
        address: '192.168.1.10',
        lastSeen: Date.now(),
      });
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'devices.discovered', id: 6,
      });

      const result = resp.result as Array<Record<string, unknown>>;
      expect(result).toHaveLength(1);
      expect(result[0]!['deviceId']).toBe('abc123');
      expect(result[0]!['deviceName']).toBe('Pixel 7');
    });

    it('devices.paired returns list of paired device IDs', async () => {
      const { daemon } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'devices.paired', id: 7,
      });

      expect(resp.result).toEqual(['device-aaa', 'device-bbb']);
    });

    it('pair.request pairs with connected device', async () => {
      const { daemon, connections } = createMockDaemon();
      connections.set('device-xyz', { deviceId: 'device-xyz', deviceName: 'Phone', send: vi.fn(), close: vi.fn() });
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'pair.request', params: { deviceId: 'device-xyz' }, id: 8,
      });

      expect(resp.result).toEqual({ verificationKey: 'AB12CD34' });
    });

    it('pair.request connects to discovered device if not connected', async () => {
      const { daemon, discoveredDevices, mockDiscoveryService, connectionCallbacks } = createMockDaemon();
      discoveredDevices.set('device-new', {
        deviceId: 'device-new',
        deviceName: 'New Phone',
        address: '192.168.1.20',
      });
      // When sendConnectRequest is called, simulate the phone connecting back
      mockDiscoveryService.sendConnectRequest.mockImplementation(() => {
        setTimeout(() => {
          for (const cb of connectionCallbacks) {
            cb({ deviceId: 'device-new', deviceName: 'New Phone' });
          }
        }, 50);
      });
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'pair.request', params: { deviceId: 'device-new' }, id: 9,
      });

      expect(mockDiscoveryService.sendConnectRequest).toHaveBeenCalled();
      // Should return the verification key from the pairing handler
      expect(resp.result).toBeDefined();
      expect(resp.result).toHaveProperty('verificationKey');
    });

    it('pair.request returns error if device not found', async () => {
      const { daemon } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'pair.request', params: { deviceId: 'nonexistent' }, id: 10,
      });

      expect(resp.error).toBeDefined();
      expect(resp.error?.message).toContain('not found');
    });

    it('pair.unpair unpairs a device', async () => {
      const { daemon, connections, mockPairingHandler } = createMockDaemon();
      connections.set('device-xyz', { deviceId: 'device-xyz', deviceName: 'Phone', send: vi.fn(), close: vi.fn() });
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'pair.unpair', params: { deviceId: 'device-xyz' }, id: 11,
      });

      expect(resp.result).toEqual({ ok: true });
      expect(mockPairingHandler.unpair).toHaveBeenCalledWith('device-xyz', expect.anything());
    });
  });

  describe('attachment and deletion methods', () => {
    it('sms.get_attachment with partId calls downloadAttachment for specific part', async () => {
      const { daemon, mockSmsHandler } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'sms.get_attachment', params: { partId: 1, messageId: 100 }, id: 20,
      });

      expect(mockSmsHandler.downloadAttachment).toHaveBeenCalledWith(1, 100);
      expect(resp.result).toBeDefined();
      const result = resp.result as { attachments: Array<{ localPath: string; mimeType: string }> };
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0]).toHaveProperty('localPath');
      expect(result.attachments[0]).toHaveProperty('mimeType');
    });

    it('sms.get_attachment without partId downloads all attachments for message', async () => {
      const { daemon, mockSmsHandler } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'sms.get_attachment', params: { messageId: 100 }, id: 20,
      });

      expect(mockSmsHandler.downloadAttachment).toHaveBeenCalledWith(1, 100);
      expect(resp.result).toBeDefined();
      const result = resp.result as { attachments: Array<{ partId: number; localPath: string; mimeType: string }> };
      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0]!.partId).toBe(1);
    });

    it('sms.delete_message calls deleteMessage', async () => {
      const { daemon, mockSmsHandler } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'sms.delete_message', params: { messageId: 300 }, id: 21,
      });

      expect(mockSmsHandler.deleteMessage).toHaveBeenCalledWith(300);
      expect(resp.result).toEqual({ deleted: true });
    });

    it('sms.delete_conversation calls deleteConversation', async () => {
      const { daemon, mockSmsHandler } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'sms.delete_conversation', params: { threadId: 50 }, id: 22,
      });

      expect(mockSmsHandler.deleteConversation).toHaveBeenCalledWith(50);
      expect(resp.result).toEqual({ deleted: true });
    });

    it('sms.get_attachment returns error when missing messageId', async () => {
      const { daemon } = createMockDaemon();
      registerHandlers(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);

      const resp = await sendAndReceive(client, {
        jsonrpc: '2.0', method: 'sms.get_attachment', params: {}, id: 23,
      });

      expect(resp.error).toBeDefined();
      expect(resp.error?.message).toContain('Missing required parameter: messageId');
    });
  });

  describe('registerNotifications', () => {
    it('broadcasts state.changed on state transitions', async () => {
      const { daemon, stateListeners } = createMockDaemon();
      registerHandlers(server, daemon as never);
      registerNotifications(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);
      await new Promise((r) => setTimeout(r, 50));

      const notifPromise = waitForNotification(client);

      // Simulate state transition
      for (const listener of stateListeners) {
        listener({
          from: 'DISCOVERING',
          to: 'CONNECTED',
          context: { deviceId: 'abc' },
          timestamp: Date.now(),
        });
      }

      const notif = await notifPromise;
      expect(notif.method).toBe('state.changed');
      expect(notif.params?.['from']).toBe('DISCOVERING');
      expect(notif.params?.['to']).toBe('CONNECTED');
    });

    it('broadcasts device.found on discovery', async () => {
      const { daemon, deviceFoundCallbacks } = createMockDaemon();
      registerHandlers(server, daemon as never);
      registerNotifications(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);
      await new Promise((r) => setTimeout(r, 50));

      const notifPromise = waitForNotification(client);

      for (const cb of deviceFoundCallbacks) {
        cb({ deviceId: 'phone123', deviceName: 'Pixel 7', address: '192.168.1.5' });
      }

      const notif = await notifPromise;
      expect(notif.method).toBe('device.found');
      expect(notif.params?.['deviceId']).toBe('phone123');
    });

    it('broadcasts device.lost on device timeout', async () => {
      const { daemon, deviceLostCallbacks } = createMockDaemon();
      registerHandlers(server, daemon as never);
      registerNotifications(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);
      await new Promise((r) => setTimeout(r, 50));

      const notifPromise = waitForNotification(client);

      for (const cb of deviceLostCallbacks) {
        cb('phone123');
      }

      const notif = await notifPromise;
      expect(notif.method).toBe('device.lost');
      expect(notif.params?.['deviceId']).toBe('phone123');
    });

    it('broadcasts device.connected on connection', async () => {
      const { daemon, connectionCallbacks } = createMockDaemon();
      registerHandlers(server, daemon as never);
      registerNotifications(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);
      await new Promise((r) => setTimeout(r, 50));

      const notifPromise = waitForNotification(client);

      for (const cb of connectionCallbacks) {
        cb({ deviceId: 'phone123', deviceName: 'Pixel 7' });
      }

      const notif = await notifPromise;
      expect(notif.method).toBe('device.connected');
      expect(notif.params?.['deviceId']).toBe('phone123');
    });

    it('broadcasts device.disconnected on disconnection', async () => {
      const { daemon, disconnectionCallbacks } = createMockDaemon();
      registerHandlers(server, daemon as never);
      registerNotifications(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);
      await new Promise((r) => setTimeout(r, 50));

      const notifPromise = waitForNotification(client);

      for (const cb of disconnectionCallbacks) {
        cb('phone123');
      }

      const notif = await notifPromise;
      expect(notif.method).toBe('device.disconnected');
      expect(notif.params?.['deviceId']).toBe('phone123');
    });

    it('broadcasts pairing.result on pairing completion', async () => {
      const { daemon, pairingResultCallbacks } = createMockDaemon();
      registerHandlers(server, daemon as never);
      registerNotifications(server, daemon as never);
      await server.start();
      const client = await connectClient(socketPath);
      clients.push(client);
      await new Promise((r) => setTimeout(r, 50));

      const notifPromise = waitForNotification(client);

      for (const cb of pairingResultCallbacks) {
        cb('phone123', true, 'AB12CD34');
      }

      const notif = await notifPromise;
      expect(notif.method).toBe('pairing.result');
      expect(notif.params?.['deviceId']).toBe('phone123');
      expect(notif.params?.['success']).toBe(true);
      expect(notif.params?.['verificationKey']).toBe('AB12CD34');
    });
  });
});
