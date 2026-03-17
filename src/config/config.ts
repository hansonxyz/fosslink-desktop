/**
 * Configuration Loading
 *
 * Loads config from YAML file, merges with defaults, validates.
 * YAML uses snake_case keys, TypeScript uses camelCase.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as yaml from 'js-yaml';
import { ErrorCode, ConfigError } from '../core/errors.js';
import type { LogLevel } from '../utils/logger.js';

export interface DaemonConfig {
  daemon: {
    logLevel: LogLevel;
  };
  kdeConnect: {
    deviceName: string;
    tcpPortMin: number;
    tcpPortMax: number;
    udpPort: number;
    broadcastInterval: number;
  };
  sync: {
    autoSync: boolean;
    syncInterval: number;
    silenceTimeout: number;
  };
  attachments: {
    autoDownload: boolean;
    maxConcurrent: number;
    maxSizeMb: number;
  };
}

// YAML snake_case structure for parsing
interface YamlConfig {
  daemon?: {
    log_level?: unknown;
  };
  kde_connect?: {
    device_name?: unknown;
    tcp_port_min?: unknown;
    tcp_port_max?: unknown;
    udp_port?: unknown;
    broadcast_interval?: unknown;
  };
  sync?: {
    auto_sync?: unknown;
    sync_interval?: unknown;
    silence_timeout?: unknown;
  };
  attachments?: {
    auto_download?: unknown;
    max_concurrent?: unknown;
    max_size_mb?: unknown;
  };
}

const VALID_LOG_LEVELS: readonly string[] = ['debug', 'info', 'warn', 'error', 'fatal'];

/**
 * Get a deep copy of the default configuration.
 */
export function getDefaultConfig(): DaemonConfig {
  return {
    daemon: {
      logLevel: 'info',
    },
    kdeConnect: {
      deviceName: 'auto',
      tcpPortMin: 1716,
      tcpPortMax: 1764,
      udpPort: 1716,
      broadcastInterval: 5000,
    },
    sync: {
      autoSync: true,
      syncInterval: 300000,
      silenceTimeout: 10000,
    },
    attachments: {
      autoDownload: false,
      maxConcurrent: 3,
      maxSizeMb: 100,
    },
  };
}

/**
 * Validate a config object. Throws ConfigError on invalid fields.
 */
export function validateConfig(config: DaemonConfig): DaemonConfig {
  // daemon.logLevel
  if (typeof config.daemon.logLevel !== 'string' || !VALID_LOG_LEVELS.includes(config.daemon.logLevel)) {
    throw new ConfigError(
      ErrorCode.CONFIG_VALIDATION_ERROR,
      `Invalid daemon.logLevel: ${String(config.daemon.logLevel)}. Must be one of: ${VALID_LOG_LEVELS.join(', ')}`,
      { field: 'daemon.logLevel', value: config.daemon.logLevel },
    );
  }

  // kdeConnect.deviceName
  if (typeof config.kdeConnect.deviceName !== 'string' || config.kdeConnect.deviceName.length === 0) {
    throw new ConfigError(
      ErrorCode.CONFIG_VALIDATION_ERROR,
      'Invalid kdeConnect.deviceName: must be a non-empty string',
      { field: 'kdeConnect.deviceName' },
    );
  }

  // Port validation helper
  function validatePort(field: string, value: unknown): void {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65535) {
      throw new ConfigError(
        ErrorCode.CONFIG_VALIDATION_ERROR,
        `Invalid ${field}: must be an integer between 1 and 65535`,
        { field, value },
      );
    }
  }

  validatePort('kdeConnect.tcpPortMin', config.kdeConnect.tcpPortMin);
  validatePort('kdeConnect.tcpPortMax', config.kdeConnect.tcpPortMax);
  validatePort('kdeConnect.udpPort', config.kdeConnect.udpPort);

  // Positive number validation helper
  function validatePositiveNumber(field: string, value: unknown): void {
    if (typeof value !== 'number' || value <= 0) {
      throw new ConfigError(
        ErrorCode.CONFIG_VALIDATION_ERROR,
        `Invalid ${field}: must be a positive number`,
        { field, value },
      );
    }
  }

  validatePositiveNumber('kdeConnect.broadcastInterval', config.kdeConnect.broadcastInterval);
  validatePositiveNumber('sync.syncInterval', config.sync.syncInterval);
  validatePositiveNumber('sync.silenceTimeout', config.sync.silenceTimeout);
  validatePositiveNumber('attachments.maxConcurrent', config.attachments.maxConcurrent);
  validatePositiveNumber('attachments.maxSizeMb', config.attachments.maxSizeMb);

  // Boolean validation
  function validateBoolean(field: string, value: unknown): void {
    if (typeof value !== 'boolean') {
      throw new ConfigError(
        ErrorCode.CONFIG_VALIDATION_ERROR,
        `Invalid ${field}: must be a boolean`,
        { field, value },
      );
    }
  }

  validateBoolean('sync.autoSync', config.sync.autoSync);
  validateBoolean('attachments.autoDownload', config.attachments.autoDownload);

  return config;
}

/**
 * Map YAML snake_case structure to camelCase DaemonConfig,
 * merging over the provided defaults.
 */
function mergeYamlOverDefaults(parsed: YamlConfig, defaults: DaemonConfig): DaemonConfig {
  const config = defaults;

  if (parsed.daemon) {
    if (parsed.daemon.log_level !== undefined) {
      config.daemon.logLevel = parsed.daemon.log_level as LogLevel;
    }
  }

  if (parsed.kde_connect) {
    const kc = parsed.kde_connect;
    if (kc.device_name !== undefined) config.kdeConnect.deviceName = kc.device_name as string;
    if (kc.tcp_port_min !== undefined) config.kdeConnect.tcpPortMin = kc.tcp_port_min as number;
    if (kc.tcp_port_max !== undefined) config.kdeConnect.tcpPortMax = kc.tcp_port_max as number;
    if (kc.udp_port !== undefined) config.kdeConnect.udpPort = kc.udp_port as number;
    if (kc.broadcast_interval !== undefined) config.kdeConnect.broadcastInterval = kc.broadcast_interval as number;
  }

  if (parsed.sync) {
    const s = parsed.sync;
    if (s.auto_sync !== undefined) config.sync.autoSync = s.auto_sync as boolean;
    if (s.sync_interval !== undefined) config.sync.syncInterval = s.sync_interval as number;
    if (s.silence_timeout !== undefined) config.sync.silenceTimeout = s.silence_timeout as number;
  }

  if (parsed.attachments) {
    const a = parsed.attachments;
    if (a.auto_download !== undefined) config.attachments.autoDownload = a.auto_download as boolean;
    if (a.max_concurrent !== undefined) config.attachments.maxConcurrent = a.max_concurrent as number;
    if (a.max_size_mb !== undefined) config.attachments.maxSizeMb = a.max_size_mb as number;
  }

  return config;
}

/**
 * Load configuration from YAML file, merge with defaults, validate.
 *
 * If the file does not exist, returns defaults.
 * Resolves deviceName 'auto' to os.hostname().
 */
export function loadConfig(configPath: string): DaemonConfig {
  const defaults = getDefaultConfig();

  let config: DaemonConfig;

  if (fs.existsSync(configPath)) {
    let raw: string;
    try {
      raw = fs.readFileSync(configPath, 'utf-8');
    } catch (err) {
      throw new ConfigError(
        ErrorCode.CONFIG_NOT_FOUND,
        `Failed to read config file: ${configPath}`,
        { path: configPath, error: err instanceof Error ? err.message : String(err) },
      );
    }

    let parsed: unknown;
    try {
      parsed = yaml.load(raw);
    } catch (err) {
      throw new ConfigError(
        ErrorCode.CONFIG_PARSE_ERROR,
        `Invalid YAML in config file: ${configPath}`,
        { path: configPath, error: err instanceof Error ? err.message : String(err) },
      );
    }

    if (parsed !== null && typeof parsed === 'object') {
      config = mergeYamlOverDefaults(parsed as YamlConfig, defaults);
    } else {
      config = defaults;
    }
  } else {
    config = defaults;
  }

  // Validate merged config
  validateConfig(config);

  // Resolve 'auto' device name
  if (config.kdeConnect.deviceName === 'auto') {
    config.kdeConnect.deviceName = os.hostname();
  }

  return config;
}
