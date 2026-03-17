/**
 * Certificate and Device Identity Utilities
 *
 * Generates self-signed TLS certificates for device identity,
 * manages persistent device IDs, and extracts public keys for verification.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import selfsigned from 'selfsigned';

export interface CertificateResult {
  cert: string;
  private: string;
}

/**
 * Generate a 32-character hex device ID.
 */
export function generateDeviceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a self-signed TLS certificate with CN=deviceId.
 * Uses 2048-bit RSA key with SHA-256 signature, valid for 10 years.
 */
export function generateCertificate(deviceId: string): CertificateResult {
  const attrs = [{ name: 'commonName', value: deviceId }];
  const opts = {
    keySize: 2048,
    days: 3650,
    algorithm: 'sha256',
  };

  const pems = selfsigned.generate(attrs, opts);

  return {
    cert: pems.cert,
    private: pems.private,
  };
}

/**
 * Load certificate and private key from disk, or generate and save new ones.
 * Creates parent directories if they don't exist.
 */
export function loadOrCreateCertificate(
  certPath: string,
  keyPath: string,
  deviceId: string,
): CertificateResult {
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(certPath, 'utf-8'),
      private: fs.readFileSync(keyPath, 'utf-8'),
    };
  }

  // Ensure parent directories exist
  fs.mkdirSync(path.dirname(certPath), { recursive: true });
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });

  const result = generateCertificate(deviceId);

  fs.writeFileSync(certPath, result.cert, { mode: 0o644 });
  fs.writeFileSync(keyPath, result.private, { mode: 0o600 });

  return result;
}

/**
 * Load device ID from disk, or generate and save a new one.
 * Device ID is stored in `<dataDir>/device.id`.
 */
export function loadOrCreateDeviceId(dataDir: string): string {
  const filePath = path.join(dataDir, 'device.id');

  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8').trim();
  }

  fs.mkdirSync(dataDir, { recursive: true });

  const id = generateDeviceId();
  fs.writeFileSync(filePath, id, 'utf-8');

  return id;
}

/**
 * Extract the SPKI DER-encoded public key from a PEM certificate as a hex string.
 * Used for verification key generation during pairing.
 */
export function getPublicKeyDerHex(certPem: string): string {
  const x509 = new crypto.X509Certificate(certPem);
  const der = x509.publicKey.export({ type: 'spki', format: 'der' });
  return (der as Buffer).toString('hex');
}
