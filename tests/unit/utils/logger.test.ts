import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PassThrough } from 'node:stream';
import {
  createLogger,
  initializeLogger,
  shutdownLogger,
  resetLogger,
} from '../../../src/utils/logger.js';
// Helper to capture pino output from a PassThrough stream
function collectLines(stream: PassThrough): string[] {
  const lines: string[] = [];
  const buf: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => {
    buf.push(chunk);
    const text = Buffer.concat(buf).toString();
    const parts = text.split('\n');
    // Last part is incomplete (no trailing newline yet)
    buf.length = 0;
    const last = parts.pop();
    if (last) {
      buf.push(Buffer.from(last));
    }
    for (const line of parts) {
      if (line.trim()) {
        lines.push(line);
      }
    }
  });
  return lines;
}

describe('logger (before initialization)', () => {
  beforeEach(() => {
    resetLogger();
  });

  it('createLogger returns a Logger with all methods', () => {
    const log = createLogger('test');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.fatal).toBe('function');
    expect(typeof log.child).toBe('function');
  });

  it('no-op logger does not throw', () => {
    const log = createLogger('test');
    expect(() => log.debug('cat', 'msg')).not.toThrow();
    expect(() => log.info('cat', 'msg', { key: 'val' })).not.toThrow();
    expect(() => log.warn('cat', 'msg')).not.toThrow();
    expect(() => log.error('cat', 'msg')).not.toThrow();
    expect(() => log.fatal('cat', 'msg')).not.toThrow();
  });

  it('no-op child does not throw', () => {
    const log = createLogger('test');
    const child = log.child({ extra: true });
    expect(() => child.info('cat', 'msg')).not.toThrow();
  });
});

describe('logger (after initialization)', () => {
  let stream: PassThrough;
  let lines: string[];

  beforeEach(() => {
    resetLogger();
    stream = new PassThrough();
    lines = collectLines(stream);
    initializeLogger({ level: 'debug', stream });
  });

  afterEach(async () => {
    await shutdownLogger();
    resetLogger();
    stream.destroy();
  });

  it('createLogger returns a functioning logger', () => {
    const log = createLogger('mymod');
    log.info('test.category', 'hello world');

    // Give pino a tick to write
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(lines.length).toBeGreaterThanOrEqual(1);
        const parsed = JSON.parse(lines[0]!);
        expect(parsed.msg).toBe('hello world');
        expect(parsed.category).toBe('test.category');
        expect(parsed.module).toBe('mymod');
        resolve();
      }, 50);
    });
  });

  it('log output includes data fields', () => {
    const log = createLogger('mod');
    log.info('cat', 'test msg', { port: 1716, host: 'localhost' });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(lines.length).toBeGreaterThanOrEqual(1);
        const parsed = JSON.parse(lines[0]!);
        expect(parsed.port).toBe(1716);
        expect(parsed.host).toBe('localhost');
        resolve();
      }, 50);
    });
  });

  it('log level filtering works', () => {
    resetLogger();
    stream = new PassThrough();
    lines = collectLines(stream);
    initializeLogger({ level: 'warn', stream });

    const log = createLogger('mod');
    log.debug('cat', 'debug msg');
    log.info('cat', 'info msg');
    log.warn('cat', 'warn msg');
    log.error('cat', 'error msg');

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Only warn and error should appear
        expect(lines.length).toBe(2);
        expect(JSON.parse(lines[0]!).msg).toBe('warn msg');
        expect(JSON.parse(lines[1]!).msg).toBe('error msg');
        resolve();
      }, 50);
    });
  });

  it('child logger includes additional bindings', () => {
    const log = createLogger('parent');
    const child = log.child({ requestId: 'abc123' });
    child.info('cat', 'child log');

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(lines.length).toBeGreaterThanOrEqual(1);
        const parsed = JSON.parse(lines[0]!);
        expect(parsed.module).toBe('parent');
        expect(parsed.requestId).toBe('abc123');
        expect(parsed.msg).toBe('child log');
        resolve();
      }, 50);
    });
  });

  it('shutdownLogger resolves without error', async () => {
    await expect(shutdownLogger()).resolves.toBeUndefined();
  });
});

describe('logger (double initialization)', () => {
  beforeEach(() => {
    resetLogger();
  });

  afterEach(() => {
    resetLogger();
  });

  it('calling initializeLogger twice throws', () => {
    const stream = new PassThrough();
    initializeLogger({ level: 'info', stream });
    expect(() => {
      initializeLogger({ level: 'debug', stream });
    }).toThrow('Logger already initialized');
    stream.destroy();
  });
});
