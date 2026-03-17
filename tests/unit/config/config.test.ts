import { describe, it, expect, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import {
  getDefaultConfig,
  loadConfig,
  validateConfig,
} from '../../../src/config/config.js';
import { ConfigError } from '../../../src/core/errors.js';

describe('getDefaultConfig', () => {
  it('returns a config with all expected sections', () => {
    const config = getDefaultConfig();
    expect(config.daemon).toBeDefined();
    expect(config.kdeConnect).toBeDefined();
    expect(config.sync).toBeDefined();
    expect(config.attachments).toBeDefined();
  });

  it('has sensible defaults', () => {
    const config = getDefaultConfig();
    expect(config.daemon.logLevel).toBe('info');
    expect(config.kdeConnect.deviceName).toBe('auto');
    expect(config.kdeConnect.tcpPortMin).toBe(1716);
    expect(config.kdeConnect.tcpPortMax).toBe(1764);
    expect(config.kdeConnect.udpPort).toBe(1716);
    expect(config.kdeConnect.broadcastInterval).toBe(5000);
    expect(config.sync.autoSync).toBe(true);
    expect(config.sync.syncInterval).toBe(300000);
    expect(config.sync.silenceTimeout).toBe(10000);
    expect(config.attachments.autoDownload).toBe(false);
    expect(config.attachments.maxConcurrent).toBe(3);
    expect(config.attachments.maxSizeMb).toBe(100);
  });

  it('returns a new object each time (not shared reference)', () => {
    const a = getDefaultConfig();
    const b = getDefaultConfig();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    const config = getDefaultConfig();
    expect(() => validateConfig(config)).not.toThrow();
  });

  it('throws ConfigError for invalid logLevel type', () => {
    const config = getDefaultConfig();
    (config.daemon as Record<string, unknown>).logLevel = 123;
    expect(() => validateConfig(config)).toThrow(ConfigError);
  });

  it('throws ConfigError for invalid logLevel value', () => {
    const config = getDefaultConfig();
    (config.daemon as Record<string, unknown>).logLevel = 'verbose';
    expect(() => validateConfig(config)).toThrow(ConfigError);
  });

  it('throws ConfigError for negative port', () => {
    const config = getDefaultConfig();
    config.kdeConnect.tcpPortMin = -1;
    expect(() => validateConfig(config)).toThrow(ConfigError);
  });

  it('throws ConfigError for port > 65535', () => {
    const config = getDefaultConfig();
    config.kdeConnect.tcpPortMax = 70000;
    expect(() => validateConfig(config)).toThrow(ConfigError);
  });

  it('throws ConfigError for non-number syncInterval', () => {
    const config = getDefaultConfig();
    (config.sync as Record<string, unknown>).syncInterval = 'fast';
    expect(() => validateConfig(config)).toThrow(ConfigError);
  });

  it('throws ConfigError for zero maxConcurrent', () => {
    const config = getDefaultConfig();
    config.attachments.maxConcurrent = 0;
    expect(() => validateConfig(config)).toThrow(ConfigError);
  });

  it('throws ConfigError for non-boolean autoSync', () => {
    const config = getDefaultConfig();
    (config.sync as Record<string, unknown>).autoSync = 'yes';
    expect(() => validateConfig(config)).toThrow(ConfigError);
  });
});

describe('loadConfig', () => {
  let tmpDir: string;

  function writeTmpConfig(content: string): string {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xyztest-'));
    const configPath = path.join(tmpDir, 'config.yaml');
    fs.writeFileSync(configPath, content, 'utf-8');
    return configPath;
  }

  afterEach(() => {
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('returns defaults when config file does not exist', () => {
    const config = loadConfig('/nonexistent/path/config.yaml');
    expect(config.daemon.logLevel).toBe('info');
    expect(config.kdeConnect.deviceName).toBe(os.hostname());
  });

  it('merges partial YAML over defaults', () => {
    const configPath = writeTmpConfig(yaml.dump({
      daemon: { log_level: 'debug' },
      sync: { auto_sync: false },
    }));

    const config = loadConfig(configPath);
    expect(config.daemon.logLevel).toBe('debug');
    expect(config.sync.autoSync).toBe(false);
    // Other fields should be defaults
    expect(config.kdeConnect.tcpPortMin).toBe(1716);
    expect(config.attachments.maxConcurrent).toBe(3);
  });

  it('resolves deviceName auto to os.hostname()', () => {
    const config = loadConfig('/nonexistent/path/config.yaml');
    expect(config.kdeConnect.deviceName).toBe(os.hostname());
  });

  it('preserves explicit deviceName from YAML', () => {
    const configPath = writeTmpConfig(yaml.dump({
      kde_connect: { device_name: 'MyDesktop' },
    }));

    const config = loadConfig(configPath);
    expect(config.kdeConnect.deviceName).toBe('MyDesktop');
  });

  it('throws ConfigError on invalid YAML syntax', () => {
    const configPath = writeTmpConfig('{ invalid yaml: [');
    expect(() => loadConfig(configPath)).toThrow(ConfigError);
  });

  it('ignores unknown keys in YAML', () => {
    const configPath = writeTmpConfig(yaml.dump({
      daemon: { log_level: 'debug' },
      unknown_section: { foo: 'bar' },
    }));

    expect(() => loadConfig(configPath)).not.toThrow();
  });

  it('throws ConfigError when merged config is invalid', () => {
    const configPath = writeTmpConfig(yaml.dump({
      kde_connect: { tcp_port_min: -5 },
    }));

    expect(() => loadConfig(configPath)).toThrow(ConfigError);
  });
});
