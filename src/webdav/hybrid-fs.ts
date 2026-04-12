/**
 * Hybrid Filesystem Handler
 *
 * Wraps the real phone filesystem handler and intercepts /_thread_{id}/
 * paths, routing them to lazily-loaded ThreadMediaFilesystem instances.
 * Everything else passes through to the phone filesystem.
 *
 * Thread media paths are read-only (write operations return errors).
 * Thread virtual directories don't appear in the root listing —
 * they're only accessible by direct path.
 */

import type {
  FilesystemHandler,
  FilesystemStatResult,
  FilesystemDirEntry,
  FilesystemReadResult,
} from './webdav-server.js';
import { ThreadMediaFilesystem } from './thread-media-fs.js';
import type { SmsHandler } from '../protocol/standard/sms-handler.js';
import type { DatabaseService } from '../database/database.js';
import type { QueryClient } from '../sync/query-client.js';
import { getAttachmentsDir } from '../utils/paths.js';
import { createLogger } from '../utils/logger.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const THREAD_PREFIX = '_thread_';

export class HybridFilesystemHandler implements FilesystemHandler {
  private logger = createLogger('hybrid-fs');
  private threadFsCache = new Map<number, ThreadMediaFilesystem>();
  private loadingThreads = new Map<number, Promise<ThreadMediaFilesystem>>();

  constructor(
    private phoneFs: FilesystemHandler,
    private smsHandler: SmsHandler,
    private db: DatabaseService,
    private queryClient: QueryClient,
  ) {}

  /**
   * Parse a path to check if it's a thread media path.
   * Returns { threadId, subPath } or null.
   */
  private parseThreadPath(filePath: string): { threadId: number; subPath: string } | null {
    const clean = filePath.replace(/^\/+/, '');
    if (!clean.startsWith(THREAD_PREFIX)) return null;

    const rest = clean.slice(THREAD_PREFIX.length);
    const slashIdx = rest.indexOf('/');
    const idStr = slashIdx >= 0 ? rest.slice(0, slashIdx) : rest;
    const subPath = slashIdx >= 0 ? rest.slice(slashIdx) : '/';
    const threadId = parseInt(idStr, 10);
    if (isNaN(threadId)) return null;

    return { threadId, subPath };
  }

  /**
   * Get or lazily load a ThreadMediaFilesystem for a thread.
   */
  private async getThreadFs(threadId: number): Promise<ThreadMediaFilesystem> {
    const cached = this.threadFsCache.get(threadId);
    if (cached) return cached;

    // Deduplicate concurrent loads
    const loading = this.loadingThreads.get(threadId);
    if (loading) return loading;

    const promise = this.loadThreadFs(threadId);
    this.loadingThreads.set(threadId, promise);

    try {
      const tfs = await promise;
      this.threadFsCache.set(threadId, tfs);
      return tfs;
    } finally {
      this.loadingThreads.delete(threadId);
    }
  }

  private async loadThreadFs(threadId: number): Promise<ThreadMediaFilesystem> {
    this.logger.info('hybrid-fs', 'Loading thread media', { threadId });

    const items = await this.queryClient.query('threads.media', { threadId }) as Array<{
      partId: number; messageId: number; mimeType: string; filename: string; date: number;
      thumbnail?: string;
    }>;

    // Save thumbnails and ensure attachment metadata exists
    const attachDir = getAttachmentsDir();
    fs.mkdirSync(attachDir, { recursive: true });
    for (const item of items) {
      if (!this.db.getAttachment(item.partId, item.messageId)) {
        this.db.upsertAttachment({
          part_id: item.partId,
          message_id: item.messageId,
          unique_identifier: String(item.partId),
          mime_type: item.mimeType,
          filename: item.filename || null,
          file_size: null,
          downloaded: 0,
          local_path: null,
          thumbnail_path: null,
        });
      }
      if (item.thumbnail) {
        const existing = this.db.getAttachment(item.partId, item.messageId);
        if (existing && !existing.thumbnail_path) {
          const thumbFile = path.join(attachDir, `${item.partId}_${item.messageId}_thumb.jpg`);
          fs.writeFileSync(thumbFile, Buffer.from(item.thumbnail, 'base64'));
          this.db.setAttachmentThumbnail(item.partId, item.messageId, thumbFile);
        }
      }
    }

    const tfs = new ThreadMediaFilesystem(this.smsHandler, this.db);
    tfs.setEntries(items);
    this.logger.info('hybrid-fs', 'Thread media loaded', { threadId, count: items.length });
    return tfs;
  }

  /** Clear cached thread filesystems (on disconnect). */
  clearCache(): void {
    this.threadFsCache.clear();
  }

  // --- FilesystemHandler interface ---

  async stat(filePath: string): Promise<FilesystemStatResult> {
    const tp = this.parseThreadPath(filePath);
    if (tp) {
      if (tp.subPath === '/' || tp.subPath === '') {
        // Thread root directory
        return { exists: true, isDir: true, isFile: false, size: 0, mtime: Date.now() / 1000, permissions: 'dr-xr-xr-x' };
      }
      const tfs = await this.getThreadFs(tp.threadId);
      return tfs.stat(tp.subPath);
    }
    return this.phoneFs.stat(filePath);
  }

  async readdir(dirPath: string): Promise<FilesystemDirEntry[]> {
    const tp = this.parseThreadPath(dirPath);
    if (tp) {
      const tfs = await this.getThreadFs(tp.threadId);
      return tfs.readdir(tp.subPath);
    }
    // Root or phone filesystem — don't inject thread dirs into listing
    return this.phoneFs.readdir(dirPath);
  }

  async read(filePath: string, offset: number, length: number): Promise<FilesystemReadResult> {
    const tp = this.parseThreadPath(filePath);
    if (tp) {
      const tfs = await this.getThreadFs(tp.threadId);
      return tfs.read(tp.subPath, offset, length);
    }
    return this.phoneFs.read(filePath, offset, length);
  }

  async write(filePath: string, offset: number, data: Buffer, truncate: boolean): Promise<number> {
    const tp = this.parseThreadPath(filePath);
    if (tp) throw new Error('Read-only: thread media');
    return this.phoneFs.write(filePath, offset, data, truncate);
  }

  async mkdir(filePath: string): Promise<void> {
    const tp = this.parseThreadPath(filePath);
    if (tp) throw new Error('Read-only: thread media');
    return this.phoneFs.mkdir(filePath);
  }

  async delete(filePath: string, recursive: boolean): Promise<void> {
    const tp = this.parseThreadPath(filePath);
    if (tp) throw new Error('Read-only: thread media');
    return this.phoneFs.delete(filePath, recursive);
  }

  async rename(from: string, to: string): Promise<void> {
    const tpFrom = this.parseThreadPath(from);
    const tpTo = this.parseThreadPath(to);
    if (tpFrom || tpTo) throw new Error('Read-only: thread media');
    return this.phoneFs.rename(from, to);
  }
}
