/**
 * Thread Media Virtual Filesystem
 *
 * Implements the FilesystemHandler interface for a virtual read-only
 * filesystem containing MMS attachments from a specific message thread.
 * Used by the WebDAV server to mount a thread's media as a drive.
 *
 * Files are named by date and original filename for easy browsing.
 * Downloading a file triggers an on-demand MMS attachment download
 * from the phone.
 */

import type {
  FilesystemHandler,
  FilesystemStatResult,
  FilesystemDirEntry,
  FilesystemReadResult,
} from './webdav-server.js';
import type { SmsHandler } from '../protocol/standard/sms-handler.js';
import type { DatabaseService } from '../database/database.js';
import { createLogger } from '../utils/logger.js';
import * as fs from 'node:fs';

interface MediaEntry {
  partId: number;
  messageId: number;
  mimeType: string;
  filename: string;
  date: number;
  /** Virtual filename used in the WebDAV listing */
  virtualName: string;
}

export class ThreadMediaFilesystem implements FilesystemHandler {
  private logger = createLogger('thread-media-fs');
  private entries: MediaEntry[] = [];
  private entriesByName = new Map<string, MediaEntry>();

  constructor(
    private smsHandler: SmsHandler,
    private db: DatabaseService,
  ) {}

  /**
   * Load media entries for a thread. Call before starting the WebDAV server.
   */
  setEntries(items: Array<{ partId: number; messageId: number; mimeType: string; filename: string; date: number }>): void {
    this.entries = [];
    this.entriesByName.clear();

    // Build virtual filenames: "YYYY-MM-DD_HHMMSS_filename.ext"
    const usedNames = new Set<string>();
    for (const item of items) {
      const d = new Date(item.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;

      let baseName = item.filename || `attachment_${item.partId}`;
      // Ensure extension matches mime type
      if (!baseName.includes('.')) {
        const ext = mimeToExt(item.mimeType);
        baseName = `${baseName}.${ext}`;
      }

      let virtualName = `${dateStr}_${timeStr}_${baseName}`;
      // Deduplicate
      let counter = 1;
      while (usedNames.has(virtualName)) {
        const extIdx = virtualName.lastIndexOf('.');
        virtualName = extIdx > 0
          ? `${virtualName.slice(0, extIdx)}_${counter}${virtualName.slice(extIdx)}`
          : `${virtualName}_${counter}`;
        counter++;
      }
      usedNames.add(virtualName);

      const entry: MediaEntry = { ...item, virtualName };
      this.entries.push(entry);
      this.entriesByName.set(virtualName.toLowerCase(), entry);
    }

    this.logger.info('thread-media-fs', 'Loaded entries', { count: this.entries.length });
  }

  async stat(filePath: string): Promise<FilesystemStatResult> {
    const clean = filePath.replace(/^\/+/, '').replace(/\/+$/, '');

    if (clean === '' || clean === '/') {
      // Root directory
      return { exists: true, isDir: true, isFile: false, size: 0, mtime: Date.now() / 1000, permissions: 'dr-xr-xr-x' };
    }

    const entry = this.entriesByName.get(clean.toLowerCase());
    if (entry) {
      // Try to get size from local file if already downloaded
      const att = this.db.getAttachment(entry.partId, entry.messageId);
      const size = att?.file_size ?? 0;
      return {
        exists: true,
        isDir: false,
        isFile: true,
        size,
        mtime: entry.date / 1000,
        permissions: '-r--r--r--',
      };
    }

    return { exists: false, isDir: false, isFile: false, size: 0, mtime: 0, permissions: '' };
  }

  async readdir(_dirPath: string): Promise<FilesystemDirEntry[]> {
    return this.entries.map(e => {
      const att = this.db.getAttachment(e.partId, e.messageId);
      return {
        name: e.virtualName,
        isDir: false,
        size: att?.file_size ?? 0,
        mtime: e.date / 1000,
      };
    });
  }

  async read(filePath: string, offset: number, length: number): Promise<FilesystemReadResult> {
    const clean = filePath.replace(/^\/+/, '');
    const entry = this.entriesByName.get(clean.toLowerCase());
    if (!entry) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Ensure the attachment is downloaded
    const localPath = await this.smsHandler.downloadAttachment(entry.partId, entry.messageId);
    if (!localPath || !fs.existsSync(localPath)) {
      throw new Error(`Attachment not available: ${filePath}`);
    }

    const fd = fs.openSync(localPath, 'r');
    try {
      const stat = fs.fstatSync(fd);
      const readLen = Math.min(length, stat.size - offset);
      if (readLen <= 0) {
        return { data: Buffer.alloc(0), bytesRead: 0, eof: true };
      }
      const buf = Buffer.alloc(readLen);
      const bytesRead = fs.readSync(fd, buf, 0, readLen, offset);
      return {
        data: buf.subarray(0, bytesRead),
        bytesRead,
        eof: offset + bytesRead >= stat.size,
      };
    } finally {
      fs.closeSync(fd);
    }
  }

  async write(): Promise<number> {
    throw new Error('Read-only filesystem');
  }

  async mkdir(): Promise<void> {
    throw new Error('Read-only filesystem');
  }

  async delete(): Promise<void> {
    throw new Error('Read-only filesystem');
  }

  async rename(): Promise<void> {
    throw new Error('Read-only filesystem');
  }
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/bmp': 'bmp',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  return map[mime] ?? 'bin';
}
