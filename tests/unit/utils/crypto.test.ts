import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import {
  generateCertificate,
  loadOrCreateCertificate,
  generateDeviceId,
  loadOrCreateDeviceId,
  getPublicKeyDerHex,
} from '../../../src/utils/crypto.js';

describe('generateDeviceId', () => {
  it('returns a 32-character hex string', () => {
    const id = generateDeviceId();
    expect(id).toMatch(/^[a-f0-9]{32}$/);
  });

  it('generates unique IDs on each call', () => {
    const id1 = generateDeviceId();
    const id2 = generateDeviceId();
    expect(id1).not.toBe(id2);
  });
});

describe('generateCertificate', () => {
  it('returns an object with cert and private fields', () => {
    const deviceId = generateDeviceId();
    const result = generateCertificate(deviceId);
    expect(result).toHaveProperty('cert');
    expect(result).toHaveProperty('private');
    expect(typeof result.cert).toBe('string');
    expect(typeof result.private).toBe('string');
  });

  it('produces valid PEM certificate', () => {
    const deviceId = generateDeviceId();
    const result = generateCertificate(deviceId);
    expect(result.cert).toMatch(/^-----BEGIN CERTIFICATE-----/);
    expect(result.cert).toMatch(/-----END CERTIFICATE-----/);
  });

  it('produces valid PEM private key', () => {
    const deviceId = generateDeviceId();
    const result = generateCertificate(deviceId);
    expect(result.private).toMatch(/-----BEGIN RSA PRIVATE KEY-----|-----BEGIN PRIVATE KEY-----/);
  });

  it('certificate CN matches deviceId', () => {
    const deviceId = generateDeviceId();
    const result = generateCertificate(deviceId);
    const x509 = new crypto.X509Certificate(result.cert);
    const cn = x509.subject.split('\n').find((l: string) => l.startsWith('CN='));
    expect(cn).toBe(`CN=${deviceId}`);
  });

  it('certificate is self-signed (issuer matches subject)', () => {
    const deviceId = generateDeviceId();
    const result = generateCertificate(deviceId);
    const x509 = new crypto.X509Certificate(result.cert);
    expect(x509.issuer).toBe(x509.subject);
  });

  it('private key can be loaded by Node crypto', () => {
    const deviceId = generateDeviceId();
    const result = generateCertificate(deviceId);
    expect(() => {
      crypto.createPrivateKey(result.private);
    }).not.toThrow();
  });
});

describe('loadOrCreateCertificate', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates new certificate files when they do not exist', () => {
    const certPath = path.join(tmpDir, 'cert.pem');
    const keyPath = path.join(tmpDir, 'key.pem');
    const deviceId = generateDeviceId();

    const result = loadOrCreateCertificate(certPath, keyPath, deviceId);

    expect(fs.existsSync(certPath)).toBe(true);
    expect(fs.existsSync(keyPath)).toBe(true);
    expect(result.cert).toMatch(/^-----BEGIN CERTIFICATE-----/);
    expect(result.private).toMatch(/-----BEGIN/);
  });

  it('loads existing certificate files on subsequent calls', () => {
    const certPath = path.join(tmpDir, 'cert.pem');
    const keyPath = path.join(tmpDir, 'key.pem');
    const deviceId = generateDeviceId();

    const first = loadOrCreateCertificate(certPath, keyPath, deviceId);
    const second = loadOrCreateCertificate(certPath, keyPath, deviceId);

    expect(first.cert).toBe(second.cert);
    expect(first.private).toBe(second.private);
  });

  it('creates parent directories if needed', () => {
    const certPath = path.join(tmpDir, 'sub', 'dir', 'cert.pem');
    const keyPath = path.join(tmpDir, 'sub', 'dir', 'key.pem');
    const deviceId = generateDeviceId();

    const result = loadOrCreateCertificate(certPath, keyPath, deviceId);

    expect(fs.existsSync(certPath)).toBe(true);
    expect(result.cert).toMatch(/^-----BEGIN CERTIFICATE-----/);
  });
});

describe('loadOrCreateDeviceId', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates and saves a new device ID', () => {
    const id = loadOrCreateDeviceId(tmpDir);
    expect(id).toMatch(/^[a-f0-9]{32}$/);

    const filePath = path.join(tmpDir, 'device.id');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf-8').trim()).toBe(id);
  });

  it('returns the same ID on subsequent calls', () => {
    const id1 = loadOrCreateDeviceId(tmpDir);
    const id2 = loadOrCreateDeviceId(tmpDir);
    expect(id1).toBe(id2);
  });

  it('creates data directory if needed', () => {
    const subDir = path.join(tmpDir, 'nested', 'dir');
    const id = loadOrCreateDeviceId(subDir);
    expect(id).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe('getPublicKeyDerHex', () => {
  it('extracts public key as hex string from cert PEM', () => {
    const deviceId = generateDeviceId();
    const { cert } = generateCertificate(deviceId);
    const hex = getPublicKeyDerHex(cert);

    expect(typeof hex).toBe('string');
    expect(hex).toMatch(/^[a-f0-9]+$/);
    expect(hex.length).toBeGreaterThan(100); // RSA 2048 SPKI DER is ~294 bytes = ~588 hex chars
  });

  it('returns consistent results for the same cert', () => {
    const deviceId = generateDeviceId();
    const { cert } = generateCertificate(deviceId);
    const hex1 = getPublicKeyDerHex(cert);
    const hex2 = getPublicKeyDerHex(cert);
    expect(hex1).toBe(hex2);
  });

  it('returns different keys for different certs', () => {
    const { cert: cert1 } = generateCertificate(generateDeviceId());
    const { cert: cert2 } = generateCertificate(generateDeviceId());
    const hex1 = getPublicKeyDerHex(cert1);
    const hex2 = getPublicKeyDerHex(cert2);
    expect(hex1).not.toBe(hex2);
  });
});
