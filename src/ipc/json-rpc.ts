/**
 * JSON-RPC 2.0 Protocol Types and Utilities
 *
 * Low-level types, serialization, parsing, and type guards
 * for the JSON-RPC 2.0 protocol used by the IPC layer.
 */

// Standard JSON-RPC 2.0 error codes
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id: string | number;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: JsonRpcError;
  id: string | number | null;
}

export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

export function serializeMessage(msg: JsonRpcMessage): string {
  return JSON.stringify(msg) + '\n';
}

export function parseMessage(line: string): JsonRpcMessage {
  let obj: unknown;
  try {
    obj = JSON.parse(line);
  } catch {
    throw new Error(`Invalid JSON: ${line.substring(0, 100)}`);
  }

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new Error('JSON-RPC message must be an object');
  }

  const msg = obj as Record<string, unknown>;

  if (msg['jsonrpc'] !== '2.0') {
    throw new Error('Missing or invalid jsonrpc version (must be "2.0")');
  }

  return msg as unknown as JsonRpcMessage;
}

export function createResponse(id: string | number, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', result, id };
}

export function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  const error: JsonRpcError = { code, message };
  if (data !== undefined) {
    error.data = data;
  }
  return { jsonrpc: '2.0', error, id };
}

export function createNotification(method: string, params?: Record<string, unknown>): JsonRpcNotification {
  const notif: JsonRpcNotification = { jsonrpc: '2.0', method };
  if (params !== undefined) {
    notif.params = params;
  }
  return notif;
}

export function isRequest(msg: unknown): msg is JsonRpcRequest {
  const m = msg as Record<string, unknown>;
  return typeof m['method'] === 'string' && 'id' in m;
}

export function isNotification(msg: unknown): msg is JsonRpcNotification {
  const m = msg as Record<string, unknown>;
  return typeof m['method'] === 'string' && !('id' in m);
}

export function isResponse(msg: unknown): msg is JsonRpcResponse {
  const m = msg as Record<string, unknown>;
  return !('method' in m) && 'id' in m;
}
