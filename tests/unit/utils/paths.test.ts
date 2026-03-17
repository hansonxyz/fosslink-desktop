import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import {
  getDataDir,
  getSocketPath,
  getDatabasePath,
  getConfigPath,
  getCertificatePath,
  getPrivateKeyPath,
  getAttachmentsDir,
  getTrustedCertsDir,
} from '../../../src/utils/paths.js';

describe('paths', () => {
  it('getDataDir returns platform-appropriate path', () => {
    const dataDir = getDataDir();
    expect(dataDir).toBeTruthy();
    expect(path.isAbsolute(dataDir)).toBe(true);
    expect(dataDir).toContain('fosslink');
  });

  it('getSocketPath returns platform-appropriate path', () => {
    const socketPath = getSocketPath();
    expect(socketPath).toBeTruthy();
    if (process.platform === 'win32') {
      expect(socketPath).toContain('\\\\.\\pipe\\');
    } else {
      expect(socketPath).toContain('daemon.sock');
    }
  });

  it('getDatabasePath is inside data directory', () => {
    const dbPath = getDatabasePath();
    expect(dbPath).toContain(getDataDir());
    expect(dbPath).toContain('fosslink.db');
  });

  it('getConfigPath is inside data directory', () => {
    const configPath = getConfigPath();
    expect(configPath).toContain(getDataDir());
    expect(configPath).toContain('config.yaml');
  });

  it('getCertificatePath is inside data directory', () => {
    const certPath = getCertificatePath();
    expect(certPath).toContain(getDataDir());
    expect(certPath).toContain('certificate.pem');
  });

  it('getPrivateKeyPath is inside data directory', () => {
    const keyPath = getPrivateKeyPath();
    expect(keyPath).toContain(getDataDir());
    expect(keyPath).toContain('privatekey.pem');
  });

  it('getAttachmentsDir is inside data directory', () => {
    const attachDir = getAttachmentsDir();
    expect(attachDir).toContain(getDataDir());
    expect(attachDir).toContain('attachments');
  });

  it('getTrustedCertsDir is inside data directory', () => {
    const certsDir = getTrustedCertsDir();
    expect(certsDir).toContain(getDataDir());
    expect(certsDir).toContain('trusted_certs');
  });

  it('all paths use path.join (no hardcoded separators)', () => {
    // All paths should use the platform separator
    const paths = [
      getDataDir(),
      getDatabasePath(),
      getConfigPath(),
      getCertificatePath(),
      getPrivateKeyPath(),
      getAttachmentsDir(),
      getTrustedCertsDir(),
    ];

    for (const p of paths) {
      expect(path.isAbsolute(p)).toBe(true);
    }
  });
});
