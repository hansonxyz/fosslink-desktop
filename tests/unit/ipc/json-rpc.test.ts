import { describe, it, expect } from 'vitest';
import {
  serializeMessage,
  parseMessage,
  createResponse,
  createErrorResponse,
  createNotification,
  isRequest,
  isNotification,
  isResponse,
  PARSE_ERROR,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  INVALID_PARAMS,
  INTERNAL_ERROR,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from '../../../src/ipc/json-rpc.js';

describe('JSON-RPC 2.0', () => {
  describe('error codes', () => {
    it('has standard JSON-RPC error codes', () => {
      expect(PARSE_ERROR).toBe(-32700);
      expect(INVALID_REQUEST).toBe(-32600);
      expect(METHOD_NOT_FOUND).toBe(-32601);
      expect(INVALID_PARAMS).toBe(-32602);
      expect(INTERNAL_ERROR).toBe(-32603);
    });
  });

  describe('serializeMessage', () => {
    it('serializes to JSON with trailing newline', () => {
      const msg: JsonRpcRequest = { jsonrpc: '2.0', method: 'test', id: 1 };
      const result = serializeMessage(msg);
      expect(result).toBe('{"jsonrpc":"2.0","method":"test","id":1}\n');
    });

    it('includes params when present', () => {
      const msg: JsonRpcRequest = { jsonrpc: '2.0', method: 'test', params: { foo: 'bar' }, id: 1 };
      const result = serializeMessage(msg);
      expect(result.endsWith('\n')).toBe(true);
      const parsed = JSON.parse(result.trim());
      expect(parsed.params).toEqual({ foo: 'bar' });
    });
  });

  describe('parseMessage', () => {
    it('parses a valid request', () => {
      const line = '{"jsonrpc":"2.0","method":"test","id":1}';
      const msg = parseMessage(line);
      expect(msg).toEqual({ jsonrpc: '2.0', method: 'test', id: 1 });
    });

    it('parses a request with params', () => {
      const line = '{"jsonrpc":"2.0","method":"test","params":{"key":"val"},"id":42}';
      const msg = parseMessage(line);
      expect(isRequest(msg)).toBe(true);
      expect((msg as JsonRpcRequest).params).toEqual({ key: 'val' });
    });

    it('parses a notification (no id)', () => {
      const line = '{"jsonrpc":"2.0","method":"event","params":{"data":1}}';
      const msg = parseMessage(line);
      expect(isNotification(msg)).toBe(true);
      expect(isRequest(msg)).toBe(false);
    });

    it('parses a success response', () => {
      const line = '{"jsonrpc":"2.0","result":{"status":"ok"},"id":1}';
      const msg = parseMessage(line);
      expect(isResponse(msg)).toBe(true);
      expect((msg as JsonRpcResponse).result).toEqual({ status: 'ok' });
    });

    it('parses an error response', () => {
      const line = '{"jsonrpc":"2.0","error":{"code":-32601,"message":"Method not found"},"id":1}';
      const msg = parseMessage(line);
      expect(isResponse(msg)).toBe(true);
      expect((msg as JsonRpcResponse).error?.code).toBe(-32601);
    });

    it('parses a response with null id (for parse errors)', () => {
      const line = '{"jsonrpc":"2.0","error":{"code":-32700,"message":"Parse error"},"id":null}';
      const msg = parseMessage(line);
      expect(isResponse(msg)).toBe(true);
      expect((msg as JsonRpcResponse).id).toBe(null);
    });

    it('throws on malformed JSON', () => {
      expect(() => parseMessage('not json')).toThrow();
    });

    it('throws on missing jsonrpc field', () => {
      expect(() => parseMessage('{"method":"test","id":1}')).toThrow();
    });

    it('throws on wrong jsonrpc version', () => {
      expect(() => parseMessage('{"jsonrpc":"1.0","method":"test","id":1}')).toThrow();
    });

    it('throws on non-object JSON', () => {
      expect(() => parseMessage('"just a string"')).toThrow();
      expect(() => parseMessage('42')).toThrow();
      expect(() => parseMessage('null')).toThrow();
    });

    it('handles string ids', () => {
      const line = '{"jsonrpc":"2.0","method":"test","id":"abc-123"}';
      const msg = parseMessage(line);
      expect(isRequest(msg)).toBe(true);
      expect((msg as JsonRpcRequest).id).toBe('abc-123');
    });
  });

  describe('createResponse', () => {
    it('creates a success response', () => {
      const resp = createResponse(1, { ok: true });
      expect(resp).toEqual({ jsonrpc: '2.0', result: { ok: true }, id: 1 });
    });

    it('creates a response with string id', () => {
      const resp = createResponse('abc', 'hello');
      expect(resp.id).toBe('abc');
      expect(resp.result).toBe('hello');
    });
  });

  describe('createErrorResponse', () => {
    it('creates an error response', () => {
      const resp = createErrorResponse(1, METHOD_NOT_FOUND, 'Method not found');
      expect(resp).toEqual({
        jsonrpc: '2.0',
        error: { code: -32601, message: 'Method not found' },
        id: 1,
      });
    });

    it('includes error data when provided', () => {
      const resp = createErrorResponse(1, INTERNAL_ERROR, 'Failed', { detail: 'reason' });
      expect(resp.error?.data).toEqual({ detail: 'reason' });
    });

    it('creates error response with null id', () => {
      const resp = createErrorResponse(null, PARSE_ERROR, 'Parse error');
      expect(resp.id).toBe(null);
    });
  });

  describe('createNotification', () => {
    it('creates a notification without id', () => {
      const notif = createNotification('state.changed', { state: 'READY' });
      expect(notif).toEqual({
        jsonrpc: '2.0',
        method: 'state.changed',
        params: { state: 'READY' },
      });
      expect('id' in notif).toBe(false);
    });

    it('creates a notification without params', () => {
      const notif = createNotification('ping');
      expect(notif.method).toBe('ping');
      expect(notif.params).toBeUndefined();
    });
  });

  describe('type guards', () => {
    it('isRequest identifies requests (has method and id)', () => {
      expect(isRequest({ jsonrpc: '2.0', method: 'test', id: 1 })).toBe(true);
      expect(isRequest({ jsonrpc: '2.0', method: 'test' })).toBe(false);
      expect(isRequest({ jsonrpc: '2.0', result: {}, id: 1 })).toBe(false);
    });

    it('isNotification identifies notifications (has method, no id)', () => {
      expect(isNotification({ jsonrpc: '2.0', method: 'event' })).toBe(true);
      expect(isNotification({ jsonrpc: '2.0', method: 'test', id: 1 })).toBe(false);
      expect(isNotification({ jsonrpc: '2.0', result: {}, id: 1 })).toBe(false);
    });

    it('isResponse identifies responses (has id, no method)', () => {
      expect(isResponse({ jsonrpc: '2.0', result: {}, id: 1 })).toBe(true);
      expect(isResponse({ jsonrpc: '2.0', error: { code: -1, message: 'err' }, id: 1 })).toBe(true);
      expect(isResponse({ jsonrpc: '2.0', method: 'test', id: 1 })).toBe(false);
    });

    it('isResponse matches null id', () => {
      expect(isResponse({ jsonrpc: '2.0', error: { code: -1, message: 'err' }, id: null })).toBe(true);
    });
  });

  describe('serialization roundtrip', () => {
    it('request survives serialize → parse', () => {
      const req: JsonRpcRequest = { jsonrpc: '2.0', method: 'daemon.status', params: { verbose: true }, id: 42 };
      const serialized = serializeMessage(req);
      const parsed = parseMessage(serialized.trim());
      expect(parsed).toEqual(req);
    });

    it('notification survives serialize → parse', () => {
      const notif = createNotification('state.changed', { from: 'A', to: 'B' });
      const serialized = serializeMessage(notif);
      const parsed = parseMessage(serialized.trim());
      expect(parsed).toEqual(notif);
    });

    it('response survives serialize → parse', () => {
      const resp = createResponse(7, { state: 'READY' });
      const serialized = serializeMessage(resp);
      const parsed = parseMessage(serialized.trim());
      expect(parsed).toEqual(resp);
    });
  });
});
