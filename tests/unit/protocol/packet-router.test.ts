import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageRouter, PacketRouter } from '../../../src/protocol/packet-router.js';
import type { DeviceConnection } from '../../../src/network/ws-server.js';
import type { ProtocolMessage } from '../../../src/network/packet.js';
import {
  resetLogger,
  initializeLogger,
  shutdownLogger,
} from '../../../src/utils/logger.js';
import { PassThrough } from 'node:stream';

describe('MessageRouter', () => {
  let logStream: PassThrough;
  let router: MessageRouter;

  const mockConn: DeviceConnection = {
    deviceId: 'test-device-id-12345678901234567',
    deviceName: 'Test',
    ws: {} as unknown as DeviceConnection['ws'],
    connected: true,
    send: vi.fn(),
    close: vi.fn(),
  } as DeviceConnection;

  beforeEach(() => {
    resetLogger();
    logStream = new PassThrough();
    initializeLogger({ level: 'debug', stream: logStream });

    router = new MessageRouter();
  });

  afterEach(async () => {
    await shutdownLogger();
    resetLogger();
    logStream.destroy();
  });

  it('registers and routes to correct handler', () => {
    const handler = vi.fn();
    router.registerHandler('fosslink.sms.event', handler);

    const msg: ProtocolMessage = { type: 'fosslink.sms.event', body: { threadId: 1 } };
    router.route(msg, mockConn);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('ignores messages with no registered handler', () => {
    const handler = vi.fn();
    router.registerHandler('fosslink.sms.event', handler);

    const msg: ProtocolMessage = { type: 'fosslink.unknown.type', body: {} };

    expect(() => {
      router.route(msg, mockConn);
    }).not.toThrow();

    expect(handler).not.toHaveBeenCalled();
  });

  it('routes to correct handler when multiple handlers are registered', () => {
    const smsHandler = vi.fn();
    const pingHandler = vi.fn();
    router.registerHandler('fosslink.sms.event', smsHandler);
    router.registerHandler('fosslink.ping', pingHandler);

    const msg: ProtocolMessage = { type: 'fosslink.sms.event', body: { threadId: 5 } };
    router.route(msg, mockConn);

    expect(smsHandler).toHaveBeenCalledOnce();
    expect(pingHandler).not.toHaveBeenCalled();

    const pingMsg: ProtocolMessage = { type: 'fosslink.ping', body: {} };
    router.route(pingMsg, mockConn);

    expect(pingHandler).toHaveBeenCalledOnce();
    expect(smsHandler).toHaveBeenCalledOnce();
  });

  it('handler receives correct message and connection', () => {
    const handler = vi.fn();
    router.registerHandler('fosslink.contacts.response', handler);

    const msg: ProtocolMessage = {
      type: 'fosslink.contacts.response',
      body: { contacts: [{ name: 'Alice' }] },
    };
    router.route(msg, mockConn);

    expect(handler).toHaveBeenCalledWith(msg, mockConn);
  });

  it('PacketRouter alias works', () => {
    expect(PacketRouter).toBe(MessageRouter);

    const aliasRouter = new PacketRouter();
    const handler = vi.fn();
    aliasRouter.registerHandler('fosslink.test', handler);

    const msg: ProtocolMessage = { type: 'fosslink.test', body: { value: 42 } };
    aliasRouter.route(msg, mockConn);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(msg, mockConn);
  });
});
