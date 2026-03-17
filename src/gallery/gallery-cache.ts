/**
 * Gallery Cache
 *
 * Manages caching of gallery thumbnails and full files with
 * session-aware LRU eviction. Thumbnails and full-resolution
 * files are stored on disk, indexed by phone file path.
 *
 * Eviction runs periodically and only removes entries that:
 * - Were NOT accessed during the current session
 * - Are older than MIN_AGE_FOR_EVICTION_MS
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { createLogger } from '../utils/logger.js';
import { getDataDir } from '../utils/paths.js';

const logger = createLogger('gallery-cache');

const CACHE_DIR_NAME = 'gallery-cache';
const THUMBNAILS_DIR = 'thumbnails';
const FULL_DIR = 'full';
const INDEX_FILE = 'cache-index.json';
const MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200MB
const EVICTION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_AGE_FOR_EVICTION_MS = 20 * 60 * 1000; // 20 minutes
const INDEX_SAVE_DEBOUNCE_MS = 5000;

interface CacheEntry {
  hash: string;
  lastAccess: number; // epoch ms
  size: number;
  thumbnailFailed?: boolean;
}

interface SerializedIndex {
  entries: Array<[string, CacheEntry]>;
}

export class GalleryCache {
  private cacheDir: string;
  private thumbnailsDir: string;
  private fullDir: string;
  private indexPath: string;
  private index: Map<string, CacheEntry> = new Map();
  private sessionAccessed: Set<string> = new Set();
  private evictionTimer: ReturnType<typeof setInterval> | undefined;
  private indexDirty: boolean = false;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.cacheDir = path.join(getDataDir(), CACHE_DIR_NAME);
    this.thumbnailsDir = path.join(this.cacheDir, THUMBNAILS_DIR);
    this.fullDir = path.join(this.cacheDir, FULL_DIR);
    this.indexPath = path.join(this.cacheDir, INDEX_FILE);

    fs.mkdirSync(this.thumbnailsDir, { recursive: true });
    fs.mkdirSync(this.fullDir, { recursive: true });

    this.loadIndex();
  }

  pathHash(filePath: string): string {
    return createHash('sha256').update(filePath).digest('hex').slice(0, 16);
  }

  getThumbnailPath(filePath: string): string | null {
    const entry = this.index.get(filePath);
    if (!entry) {
      return null;
    }

    const diskPath = path.join(this.thumbnailsDir, `${entry.hash}.jpg`);
    if (!fs.existsSync(diskPath)) {
      return null;
    }

    this.markAccessed(filePath);
    return diskPath;
  }

  getFullFilePath(filePath: string): string | null {
    const entry = this.index.get(filePath);
    if (!entry) {
      return null;
    }

    // Find the file in full dir by hash prefix (extension may vary)
    const hash = entry.hash;
    const files = fs.readdirSync(this.fullDir).filter((f) => f.startsWith(hash));
    const firstFile = files[0];
    if (!firstFile) {
      return null;
    }

    this.markAccessed(filePath);
    return path.join(this.fullDir, firstFile);
  }

  storeThumbnail(filePath: string, data: Buffer): string {
    const hash = this.pathHash(filePath);
    const diskPath = path.join(this.thumbnailsDir, `${hash}.jpg`);

    fs.writeFileSync(diskPath, data);

    const existing = this.index.get(filePath);
    this.index.set(filePath, {
      hash,
      lastAccess: Date.now(),
      size: (existing?.size ?? 0) + data.length,
      thumbnailFailed: false,
    });

    this.sessionAccessed.add(filePath);
    this.markDirty();

    logger.debug('cache', 'stored thumbnail', { filePath, bytes: data.length });
    return diskPath;
  }

  storeFullFile(filePath: string, data: Buffer, ext: string): string {
    const hash = this.pathHash(filePath);
    const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
    const diskPath = path.join(this.fullDir, `${hash}${normalizedExt}`);

    fs.writeFileSync(diskPath, data);

    const existing = this.index.get(filePath);
    this.index.set(filePath, {
      hash,
      lastAccess: Date.now(),
      size: (existing?.size ?? 0) + data.length,
      thumbnailFailed: existing?.thumbnailFailed,
    });

    this.sessionAccessed.add(filePath);
    this.markDirty();

    logger.debug('cache', 'stored full file', { filePath, ext: normalizedExt, bytes: data.length });
    return diskPath;
  }

  markThumbnailFailed(filePath: string): void {
    const existing = this.index.get(filePath);
    const hash = this.pathHash(filePath);

    this.index.set(filePath, {
      hash: existing?.hash ?? hash,
      lastAccess: existing?.lastAccess ?? Date.now(),
      size: existing?.size ?? 0,
      thumbnailFailed: true,
    });

    this.markDirty();
  }

  isThumbnailFailed(filePath: string): boolean {
    const entry = this.index.get(filePath);
    return entry?.thumbnailFailed === true;
  }

  markAccessed(filePath: string): void {
    const entry = this.index.get(filePath);
    if (entry) {
      entry.lastAccess = Date.now();
      this.markDirty();
    }
    this.sessionAccessed.add(filePath);
  }

  startEviction(): void {
    if (this.evictionTimer) {
      return;
    }

    this.evictionTimer = setInterval(() => {
      this.runEviction();
    }, EVICTION_INTERVAL_MS);

    logger.info('cache', 'eviction timer started', {
      intervalMs: EVICTION_INTERVAL_MS,
      maxCacheBytes: MAX_CACHE_BYTES,
    });
  }

  stopEviction(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = undefined;
    }

    this.saveIndex();
  }

  private runEviction(): void {
    let totalSize = 0;
    for (const entry of this.index.values()) {
      totalSize += entry.size;
    }

    if (totalSize <= MAX_CACHE_BYTES) {
      return;
    }

    const now = Date.now();
    const eligible: Array<[string, CacheEntry]> = [];

    for (const [filePath, entry] of this.index) {
      if (!this.sessionAccessed.has(filePath) && (now - entry.lastAccess > MIN_AGE_FOR_EVICTION_MS)) {
        eligible.push([filePath, entry]);
      }
    }

    // Sort oldest first
    eligible.sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    let evictedCount = 0;
    let bytesFreed = 0;

    for (const [filePath, entry] of eligible) {
      if (totalSize <= MAX_CACHE_BYTES) {
        break;
      }

      // Delete thumbnail
      const thumbPath = path.join(this.thumbnailsDir, `${entry.hash}.jpg`);
      if (fs.existsSync(thumbPath)) {
        try {
          fs.unlinkSync(thumbPath);
        } catch (err: unknown) {
          logger.warn('cache', 'failed to delete thumbnail', {
            path: thumbPath,
            error: String(err),
          });
        }
      }

      // Delete full file (any extension)
      try {
        const fullFiles = fs.readdirSync(this.fullDir).filter((f) => f.startsWith(entry.hash));
        for (const f of fullFiles) {
          fs.unlinkSync(path.join(this.fullDir, f));
        }
      } catch (err: unknown) {
        logger.warn('cache', 'failed to delete full file', {
          hash: entry.hash,
          error: String(err),
        });
      }

      totalSize -= entry.size;
      bytesFreed += entry.size;
      evictedCount++;
      this.index.delete(filePath);
    }

    if (evictedCount > 0) {
      this.markDirty();
      logger.info('cache', 'eviction complete', {
        evictedCount,
        bytesFreed,
        remainingBytes: totalSize,
        remainingEntries: this.index.size,
      });
    }
  }

  private markDirty(): void {
    this.indexDirty = true;

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveIndex();
    }, INDEX_SAVE_DEBOUNCE_MS);
  }

  private saveIndex(): void {
    if (!this.indexDirty) {
      return;
    }

    try {
      const serialized: SerializedIndex = {
        entries: Array.from(this.index.entries()),
      };
      fs.writeFileSync(this.indexPath, JSON.stringify(serialized), 'utf-8');
      this.indexDirty = false;

      logger.debug('cache', 'index saved', { entries: this.index.size });
    } catch (err: unknown) {
      logger.error('cache', 'failed to save index', { error: String(err) });
    }
  }

  private loadIndex(): void {
    try {
      if (!fs.existsSync(this.indexPath)) {
        this.index = new Map();
        return;
      }

      const raw = fs.readFileSync(this.indexPath, 'utf-8');
      const parsed = JSON.parse(raw) as SerializedIndex;
      this.index = new Map(parsed.entries);

      logger.info('cache', 'index loaded', { entries: this.index.size });
    } catch (err: unknown) {
      logger.warn('cache', 'failed to load index, starting fresh', { error: String(err) });
      this.index = new Map();
    }
  }

  destroy(): void {
    this.stopEviction();

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }

    // Force save synchronously on destroy
    this.indexDirty = true;
    this.saveIndex();
  }
}
