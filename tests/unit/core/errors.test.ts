import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  XyzError,
  ConfigError,
  NetworkError,
  ProtocolError,
  PairingError,
  StateError,
  DatabaseError,
  DaemonError,
} from '../../../src/core/errors.js';

describe('ErrorCode', () => {
  it('has all expected error codes', () => {
    expect(ErrorCode.CONFIG_NOT_FOUND).toBe('CONFIG_NOT_FOUND');
    expect(ErrorCode.CONFIG_PARSE_ERROR).toBe('CONFIG_PARSE_ERROR');
    expect(ErrorCode.CONFIG_VALIDATION_ERROR).toBe('CONFIG_VALIDATION_ERROR');
    expect(ErrorCode.NETWORK_BIND_FAILED).toBe('NETWORK_BIND_FAILED');
    expect(ErrorCode.NETWORK_CONNECTION_FAILED).toBe('NETWORK_CONNECTION_FAILED');
    expect(ErrorCode.NETWORK_TIMEOUT).toBe('NETWORK_TIMEOUT');
    expect(ErrorCode.PROTOCOL_INVALID_PACKET).toBe('PROTOCOL_INVALID_PACKET');
    expect(ErrorCode.PROTOCOL_INVALID_IDENTITY).toBe('PROTOCOL_INVALID_IDENTITY');
    expect(ErrorCode.PROTOCOL_VERSION_MISMATCH).toBe('PROTOCOL_VERSION_MISMATCH');
    expect(ErrorCode.PAIRING_REJECTED).toBe('PAIRING_REJECTED');
    expect(ErrorCode.PAIRING_TIMEOUT).toBe('PAIRING_TIMEOUT');
    expect(ErrorCode.PAIRING_ALREADY_PAIRED).toBe('PAIRING_ALREADY_PAIRED');
    expect(ErrorCode.STATE_INVALID_TRANSITION).toBe('STATE_INVALID_TRANSITION');
    expect(ErrorCode.DATABASE_OPEN_FAILED).toBe('DATABASE_OPEN_FAILED');
    expect(ErrorCode.DATABASE_MIGRATION_FAILED).toBe('DATABASE_MIGRATION_FAILED');
    expect(ErrorCode.DATABASE_QUERY_FAILED).toBe('DATABASE_QUERY_FAILED');
    expect(ErrorCode.DAEMON_ALREADY_RUNNING).toBe('DAEMON_ALREADY_RUNNING');
    expect(ErrorCode.DAEMON_NOT_RUNNING).toBe('DAEMON_NOT_RUNNING');
    expect(ErrorCode.DAEMON_INIT_FAILED).toBe('DAEMON_INIT_FAILED');
  });
});

describe('XyzError', () => {
  it('is an instance of Error', () => {
    const err = new XyzError(ErrorCode.DAEMON_INIT_FAILED, 'test error');
    expect(err).toBeInstanceOf(Error);
  });

  it('has correct code, message, and name', () => {
    const err = new XyzError(ErrorCode.DAEMON_INIT_FAILED, 'something broke');
    expect(err.code).toBe(ErrorCode.DAEMON_INIT_FAILED);
    expect(err.message).toBe('something broke');
    expect(err.name).toBe('XyzError');
  });

  it('has details when provided', () => {
    const details = { path: '/tmp/test', port: 1716 };
    const err = new XyzError(ErrorCode.NETWORK_BIND_FAILED, 'bind failed', details);
    expect(err.details).toEqual(details);
  });

  it('has undefined details when not provided', () => {
    const err = new XyzError(ErrorCode.DAEMON_INIT_FAILED, 'test');
    expect(err.details).toBeUndefined();
  });

  it('has a stack trace', () => {
    const err = new XyzError(ErrorCode.DAEMON_INIT_FAILED, 'test');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('XyzError');
  });
});

describe('ConfigError', () => {
  it('is an instance of XyzError and Error', () => {
    const err = new ConfigError(ErrorCode.CONFIG_NOT_FOUND, 'not found');
    expect(err).toBeInstanceOf(XyzError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has name ConfigError', () => {
    const err = new ConfigError(ErrorCode.CONFIG_PARSE_ERROR, 'bad yaml');
    expect(err.name).toBe('ConfigError');
  });

  it('carries details', () => {
    const err = new ConfigError(ErrorCode.CONFIG_VALIDATION_ERROR, 'invalid', { field: 'logLevel' });
    expect(err.details).toEqual({ field: 'logLevel' });
  });
});

describe('NetworkError', () => {
  it('is an instance of XyzError and Error', () => {
    const err = new NetworkError(ErrorCode.NETWORK_BIND_FAILED, 'port in use');
    expect(err).toBeInstanceOf(XyzError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has name NetworkError', () => {
    const err = new NetworkError(ErrorCode.NETWORK_TIMEOUT, 'timed out');
    expect(err.name).toBe('NetworkError');
  });
});

describe('ProtocolError', () => {
  it('is an instance of XyzError and Error', () => {
    const err = new ProtocolError(ErrorCode.PROTOCOL_INVALID_PACKET, 'bad packet');
    expect(err).toBeInstanceOf(XyzError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has name ProtocolError', () => {
    const err = new ProtocolError(ErrorCode.PROTOCOL_INVALID_IDENTITY, 'bad identity');
    expect(err.name).toBe('ProtocolError');
  });
});

describe('PairingError', () => {
  it('is an instance of XyzError and Error', () => {
    const err = new PairingError(ErrorCode.PAIRING_REJECTED, 'rejected');
    expect(err).toBeInstanceOf(XyzError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has name PairingError', () => {
    const err = new PairingError(ErrorCode.PAIRING_TIMEOUT, 'timeout');
    expect(err.name).toBe('PairingError');
  });
});

describe('StateError', () => {
  it('is an instance of XyzError and Error', () => {
    const err = new StateError(ErrorCode.STATE_INVALID_TRANSITION, 'bad transition');
    expect(err).toBeInstanceOf(XyzError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has name StateError', () => {
    const err = new StateError(ErrorCode.STATE_INVALID_TRANSITION, 'invalid');
    expect(err.name).toBe('StateError');
  });
});

describe('DatabaseError', () => {
  it('is an instance of XyzError and Error', () => {
    const err = new DatabaseError(ErrorCode.DATABASE_OPEN_FAILED, 'cant open');
    expect(err).toBeInstanceOf(XyzError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has name DatabaseError', () => {
    const err = new DatabaseError(ErrorCode.DATABASE_QUERY_FAILED, 'query failed');
    expect(err.name).toBe('DatabaseError');
  });
});

describe('DaemonError', () => {
  it('is an instance of XyzError and Error', () => {
    const err = new DaemonError(ErrorCode.DAEMON_ALREADY_RUNNING, 'already running');
    expect(err).toBeInstanceOf(XyzError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has name DaemonError', () => {
    const err = new DaemonError(ErrorCode.DAEMON_NOT_RUNNING, 'not running');
    expect(err.name).toBe('DaemonError');
  });

  it('carries details', () => {
    const err = new DaemonError(ErrorCode.DAEMON_ALREADY_RUNNING, 'running', { pid: 12345 });
    expect(err.details).toEqual({ pid: 12345 });
  });
});
