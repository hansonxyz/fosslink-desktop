/**
 * Cross-Platform Path Utilities
 *
 * Resolves data directory, socket path, and other paths
 * based on the current platform.
 */

import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Get the application data directory.
 *
 * - Linux/macOS: ~/.fosslink/
 * - Windows: %APPDATA%/fosslink/
 */
export function getDataDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env['APPDATA'];
    if (!appData) {
      throw new Error('APPDATA environment variable not set');
    }
    return path.join(appData, 'fosslink');
  }
  return path.join(os.homedir(), '.fosslink');
}

/**
 * Get the IPC socket/pipe path.
 *
 * - Linux/macOS: ~/.fosslink/daemon.sock
 * - Windows: \\.\pipe\fosslink
 */
export function getSocketPath(): string {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\fosslink';
  }
  return path.join(getDataDir(), 'daemon.sock');
}

/**
 * Get the database file path.
 */
export function getDatabasePath(): string {
  return path.join(getDataDir(), 'fosslink.db');
}

/**
 * Get the configuration file path.
 */
export function getConfigPath(): string {
  return path.join(getDataDir(), 'config.yaml');
}

/**
 * Get the PID file path.
 */
export function getPidPath(): string {
  return path.join(getDataDir(), 'daemon.pid');
}

/**
 * Get the log file path.
 */
export function getLogPath(): string {
  return path.join(getDataDir(), 'daemon.log');
}

/**
 * Get the certificate file path.
 */
export function getCertificatePath(): string {
  return path.join(getDataDir(), 'certificate.pem');
}

/**
 * Get the private key file path.
 */
export function getPrivateKeyPath(): string {
  return path.join(getDataDir(), 'privatekey.pem');
}

/**
 * Get the attachments storage directory.
 */
export function getAttachmentsDir(): string {
  return path.join(getDataDir(), 'attachments');
}

/**
 * Get the contact photos storage directory.
 */
export function getContactPhotosDir(): string {
  return path.join(getDataDir(), 'contact-photos');
}

/**
 * Get the gallery thumbnail/file cache directory.
 */
export function getGalleryCacheDir(): string {
  return path.join(getDataDir(), 'gallery-cache');
}

/**
 * Get the trusted certificates directory.
 */
export function getTrustedCertsDir(): string {
  return path.join(getDataDir(), 'trusted_certs');
}

/**
 * Get the known devices file path (IP-associated devices).
 */
export function getKnownDevicesPath(): string {
  return path.join(getDataDir(), 'known_devices.json');
}
