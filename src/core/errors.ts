/**
 * Typed Error Classes
 *
 * All application errors extend XyzError with an ErrorCode
 * for programmatic discrimination and structured details.
 */

export enum ErrorCode {
  // Config errors
  CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
  CONFIG_PARSE_ERROR = 'CONFIG_PARSE_ERROR',
  CONFIG_VALIDATION_ERROR = 'CONFIG_VALIDATION_ERROR',

  // Network errors
  NETWORK_BIND_FAILED = 'NETWORK_BIND_FAILED',
  NETWORK_CONNECTION_FAILED = 'NETWORK_CONNECTION_FAILED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',

  // Protocol errors
  PROTOCOL_INVALID_PACKET = 'PROTOCOL_INVALID_PACKET',
  PROTOCOL_INVALID_IDENTITY = 'PROTOCOL_INVALID_IDENTITY',
  PROTOCOL_VERSION_MISMATCH = 'PROTOCOL_VERSION_MISMATCH',

  // Pairing errors
  PAIRING_REJECTED = 'PAIRING_REJECTED',
  PAIRING_TIMEOUT = 'PAIRING_TIMEOUT',
  PAIRING_ALREADY_PAIRED = 'PAIRING_ALREADY_PAIRED',

  // State machine errors
  STATE_INVALID_TRANSITION = 'STATE_INVALID_TRANSITION',

  // Database errors
  DATABASE_OPEN_FAILED = 'DATABASE_OPEN_FAILED',
  DATABASE_MIGRATION_FAILED = 'DATABASE_MIGRATION_FAILED',
  DATABASE_QUERY_FAILED = 'DATABASE_QUERY_FAILED',

  // Daemon errors
  DAEMON_ALREADY_RUNNING = 'DAEMON_ALREADY_RUNNING',
  DAEMON_NOT_RUNNING = 'DAEMON_NOT_RUNNING',
  DAEMON_INIT_FAILED = 'DAEMON_INIT_FAILED',
}

export class XyzError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'XyzError';
    this.code = code;
    this.details = details;
  }
}

export class ConfigError extends XyzError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'ConfigError';
  }
}

export class NetworkError extends XyzError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'NetworkError';
  }
}

export class ProtocolError extends XyzError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'ProtocolError';
  }
}

export class PairingError extends XyzError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'PairingError';
  }
}

export class StateError extends XyzError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'StateError';
  }
}

export class DatabaseError extends XyzError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'DatabaseError';
  }
}

export class DaemonError extends XyzError {
  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(code, message, details);
    this.name = 'DaemonError';
  }
}
