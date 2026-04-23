/**
 * Structured Logger
 *
 * Wraps pino with a category-based API. Every log entry includes
 * a `module` field (from createLogger) and a `category` field
 * (from the log call).
 *
 * Call initializeLogger() once at startup before any logging.
 * Before initialization, createLogger() returns a no-op logger.
 */

import pino from 'pino';
import type { DestinationStream } from 'pino';

export interface Logger {
  debug(category: string, msg: string, data?: Record<string, unknown>): void;
  info(category: string, msg: string, data?: Record<string, unknown>): void;
  warn(category: string, msg: string, data?: Record<string, unknown>): void;
  error(category: string, msg: string, data?: Record<string, unknown>): void;
  fatal(category: string, msg: string, data?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerOptions {
  level: LogLevel;
  filePath?: string;
  pretty?: boolean;
  /** For testing: pass a writable stream to capture output */
  stream?: DestinationStream;
}

let rootLogger: pino.Logger | undefined;
let currentLevel: LogLevel = 'info';
let currentFilePath: string | undefined;
let initialized = false;
let logTapCallback: ((level: string, category: string, msg: string, data?: Record<string, unknown>) => void) | undefined;

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => noopLogger,
};

/** Wraps the current rootLogger with fixed bindings. Re-reads rootLogger on
 *  each call so that `rotateLogFile` transparently swaps the destination for
 *  existing child loggers. */
function wrapPino(bindings: Record<string, unknown>): Logger {
  let cachedRoot: pino.Logger | undefined;
  let cachedChild: pino.Logger | undefined;

  const getChild = (): pino.Logger | undefined => {
    if (!rootLogger) return undefined;
    if (rootLogger !== cachedRoot) {
      cachedRoot = rootLogger;
      cachedChild = rootLogger.child(bindings);
    }
    return cachedChild;
  };

  function logAt(level: 'debug' | 'info' | 'warn' | 'error' | 'fatal') {
    return (category: string, msg: string, data?: Record<string, unknown>) => {
      const child = getChild();
      if (child) child[level]({ category, ...data }, msg);
      if (logTapCallback) {
        logTapCallback(level, category, msg, data);
      }
    };
  }

  return {
    debug: logAt('debug'),
    info: logAt('info'),
    warn: logAt('warn'),
    error: logAt('error'),
    fatal: logAt('fatal'),
    child(newBindings: Record<string, unknown>): Logger {
      return wrapPino({ ...bindings, ...newBindings });
    },
  };
}

/**
 * Initialize the root pino logger. Must be called once at startup.
 * Throws if called more than once (call resetLogger() first in tests).
 */
export function initializeLogger(options: LoggerOptions): void {
  if (initialized) {
    throw new Error('Logger already initialized. Call resetLogger() first if reinitializing.');
  }

  currentLevel = options.level;
  currentFilePath = options.filePath;

  const pinoOpts: pino.LoggerOptions = {
    level: options.level,
  };

  if (options.stream) {
    // Testing mode: write to provided stream
    rootLogger = pino(pinoOpts, options.stream);
  } else if (options.pretty) {
    // Dev mode: pretty-print to stdout
    rootLogger = pino({
      ...pinoOpts,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    });
  } else if (options.filePath) {
    // Production: JSON to file
    const dest = pino.destination({ dest: options.filePath, sync: false });
    rootLogger = pino(pinoOpts, dest);
  } else {
    // Default: JSON to stdout
    rootLogger = pino(pinoOpts);
  }

  initialized = true;
}

/**
 * Point the root logger at a new file path. Existing child loggers returned
 * from createLogger() continue to work — they re-read the root on each log
 * call, so the swap is transparent. Used to roll over logs at midnight.
 */
export function rotateLogFile(newFilePath: string): void {
  if (!initialized) return;
  const dest = pino.destination({ dest: newFilePath, sync: false });
  rootLogger = pino({ level: currentLevel }, dest);
  currentFilePath = newFilePath;
}

/** Current log file path (or undefined if not file-backed). */
export function getCurrentLogFile(): string | undefined {
  return currentFilePath;
}

/**
 * Create a named child logger for a module.
 * Returns a no-op logger if initializeLogger() has not been called.
 */
export function createLogger(name: string): Logger {
  // Always return a dynamic wrapper — the wrapper re-reads rootLogger on
  // each call, so callers can cache this at module load time even if the
  // logger isn't initialized yet (it will no-op until init).
  return wrapPino({ module: name });
}

/**
 * Flush logs and shut down the logger.
 */
export async function shutdownLogger(): Promise<void> {
  if (rootLogger) {
    rootLogger.flush();
  }
}

/**
 * Register a tap callback that receives every log entry.
 * Used by the GUI to forward daemon logs to the renderer console.
 */
export function setLogTap(cb: (level: string, category: string, msg: string, data?: Record<string, unknown>) => void): void {
  logTapCallback = cb;
}

/**
 * Remove the log tap callback.
 */
export function clearLogTap(): void {
  logTapCallback = undefined;
}

/**
 * Reset logger state. For use in tests only.
 */
export function resetLogger(): void {
  rootLogger = undefined;
  initialized = false;
  logTapCallback = undefined;
  currentFilePath = undefined;
}
