/**
 * Gallery Handler
 *
 * Two responsibilities:
 *
 *   1. Scan: list all media files via `queryClient.query('gallery.scan', ...)`.
 *      The query system handles pagination + flow control; pages are streamed
 *      back via the onScanBatch callback for progressive UI rendering.
 *   2. Thumbnails: request/response correlator for `fosslink.gallery.thumbnail`
 *      messages. Each request gets a UUID requestId; the phone echoes it in
 *      its response so we can correlate request to Promise. Concurrency
 *      limited to MAX_CONCURRENT_THUMBNAILS in flight.
 *
 * Full file downloads are handled by FilesystemHandler via the daemon
 * orchestrator (Daemon.downloadGalleryFile).
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../utils/logger.js';
import type { Logger } from '../utils/logger.js';
import type { ProtocolMessage } from '../network/packet.js';
import { MSG_GALLERY_THUMBNAIL } from '../network/packet.js';
import { GalleryCache } from './gallery-cache.js';
import type { QueryClient } from '../sync/query-client.js';

/** Timeout for individual thumbnail requests (ms) */
const THUMBNAIL_TIMEOUT_MS = 15_000;

/** Max concurrent thumbnail requests in flight */
const MAX_CONCURRENT_THUMBNAILS = 5;

export interface GalleryItem {
  path: string;
  filename: string;
  folder: string;
  mtime: number;
  size: number;
  mimeType: string;
  isHidden: boolean;
  kind: 'image' | 'video';
}

export interface ThumbnailResult {
  path: string;
  localPath: string;   // path on local disk (cache)
  width: number;
  height: number;
  failed: boolean;
}

export type DownloadProgressCallback = (filePath: string, progress: number) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface QueuedThumbnail {
  filePath: string;
  resolve: (value: ThumbnailResult) => void;
  reject: (reason: Error) => void;
}

export class GalleryHandler {
  private pending = new Map<string, PendingRequest>();
  private sendMessage: ((msg: ProtocolMessage) => void) | null = null;
  private queryClient: QueryClient | null = null;
  private cache: GalleryCache;
  private logger: Logger;
  private activeThumbnails: number = 0;
  private thumbnailQueue: QueuedThumbnail[] = [];
  private cachedItems: GalleryItem[] | null = null;
  private preScanInProgress = false;

  constructor() {
    this.cache = new GalleryCache();
    this.logger = createLogger('gallery-handler');
  }

  /**
   * Set the function used to send messages to the phone (used for thumbnail
   * requests). Called when a device connection is established.
   */
  setSendFunction(fn: (msg: ProtocolMessage) => void): void {
    this.sendMessage = fn;
  }

  /** Wire the query client (used for the paginated gallery.scan query). */
  setQueryClient(qc: QueryClient): void {
    this.queryClient = qc;
  }

  /**
   * Clear the send function. Called when the connection drops.
   */
  clearSendFunction(): void {
    this.sendMessage = null;
    this.cachedItems = null;
    this.preScanInProgress = false;
    this.cache.clearIndex();
  }

  /** Clear the on-disk and in-memory cache (e.g. after resync wipes files). */
  clearCache(): void {
    this.cachedItems = null;
    this.cache.clearIndex();
  }

  /**
   * Called by the message router when the phone responds to a gallery request.
   * Matches the response to a pending Promise by requestId.
   */
  handleResponse(msg: ProtocolMessage): void {
    const requestId = msg.body['requestId'] as string | undefined;
    if (!requestId) {
      this.logger.warn('protocol.gallery', 'Received gallery response without requestId', {
        type: msg.type,
      });
      return;
    }

    const entry = this.pending.get(requestId);
    if (!entry) {
      this.logger.debug('protocol.gallery', 'Received gallery response for unknown requestId (possibly timed out)', {
        requestId,
        type: msg.type,
      });
      return;
    }

    const error = msg.body['error'] as string | undefined;
    if (error) {
      this.pending.delete(requestId);
      clearTimeout(entry.timer);
      this.logger.debug('protocol.gallery', 'Gallery request returned error', {
        requestId,
        error,
      });
      entry.reject(new Error(error));
      return;
    }

    // Single-shot response (thumbnail). Scan goes through QueryClient.
    this.pending.delete(requestId);
    clearTimeout(entry.timer);
    entry.resolve(msg.body);
  }

  /** Callback for progressive gallery scan batches. Set by the IPC layer. */
  onScanBatch: ((items: Array<Record<string, unknown>>, batch: number, totalBatches: number) => void) | null = null;

  /**
   * Pre-scan gallery on connection so file list is available instantly.
   * Fire-and-forget — errors are logged but don't propagate.
   */
  async preScan(): Promise<void> {
    if (this.preScanInProgress) return;
    this.preScanInProgress = true;
    try {
      const items = await this.fetchScan();
      this.cachedItems = items;
      this.logger.info('protocol.gallery', 'Gallery pre-scan complete', { count: items.length });
    } catch (err) {
      this.logger.warn('protocol.gallery', 'Gallery pre-scan failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.preScanInProgress = false;
    }
  }

  /**
   * Merge new items into the cached file list (from real-time events).
   */
  mergeItems(newItems: Array<{ path: string; filename: string; folder: string; mtime: number; size: number; mimeType: string; isHidden: boolean; kind: 'image' | 'video' }>): void {
    if (!this.cachedItems) return;
    const existingPaths = new Set(this.cachedItems.map((i) => i.path));
    const toAdd = newItems.filter((i) => !existingPaths.has(i.path));
    if (toAdd.length > 0) {
      this.cachedItems = [...toAdd, ...this.cachedItems];
      this.logger.debug('protocol.gallery', 'Merged items into cache', { added: toAdd.length });
    }
  }

  /**
   * Scan the phone's gallery for all media items.
   * Returns cached items if available from pre-scan.
   */
  async scan(): Promise<GalleryItem[]> {
    if (this.cachedItems) {
      const cached = this.cachedItems;
      // Background refresh for next time
      this.preScan().catch(() => {});
      return cached;
    }
    const items = await this.fetchScan();
    this.cachedItems = items;
    return items;
  }

  /** Current scan scope — set before calling fetchScanDirect. */
  scanScope = 'all';

  /**
   * Fetch gallery items directly from the phone (bypasses cache).
   * Used by the IPC gallery.scan handler.
   */
  async fetchScanDirect(): Promise<GalleryItem[]> {
    const items = await this.fetchScan();
    this.cachedItems = items;
    return items;
  }

  /**
   * Fetch gallery items from the phone via the v1.3 paginated query system.
   * Streams pages via the onScanBatch callback for progressive UI rendering.
   */
  private async fetchScan(): Promise<GalleryItem[]> {
    if (!this.queryClient) {
      this.logger.warn('protocol.gallery', 'Gallery scan called before query client wired');
      return [];
    }

    const collected: GalleryItem[] = [];
    const { promise } = this.queryClient.queryStreaming(
      'gallery.scan',
      { scope: this.scanScope },
      (pageItems, page, totalPages) => {
        const records = pageItems as Array<Record<string, unknown>>;
        const typed = records.map((item) => ({
          path: item['path'] as string,
          filename: item['filename'] as string,
          folder: item['folder'] as string,
          mtime: item['mtime'] as number,
          size: item['size'] as number,
          mimeType: item['mimeType'] as string,
          isHidden: item['isHidden'] === true,
          kind: (item['kind'] as string) === 'video' ? 'video' as const : 'image' as const,
        }));
        collected.push(...typed);
        if (this.onScanBatch) {
          this.onScanBatch(records, page, totalPages);
        }
      },
    );

    await promise;
    return collected;
  }

  /**
   * Get a thumbnail for a gallery item.
   * Checks cache first, then requests from the phone with concurrency limiting.
   */
  async getThumbnail(filePath: string): Promise<ThumbnailResult> {
    // Check cache first
    const cachedPath = this.cache.getThumbnailPath(filePath);
    if (cachedPath) {
      return {
        path: filePath,
        localPath: cachedPath,
        width: 0,
        height: 0,
        failed: false,
      };
    }

    // Check if previously failed
    if (this.cache.isThumbnailFailed(filePath)) {
      return {
        path: filePath,
        localPath: '',
        width: 0,
        height: 0,
        failed: true,
      };
    }

    // If at concurrency limit, queue and wait
    if (this.activeThumbnails >= MAX_CONCURRENT_THUMBNAILS) {
      return new Promise<ThumbnailResult>((resolve, reject) => {
        this.thumbnailQueue.push({ filePath, resolve, reject });
      });
    }

    return this.fetchThumbnail(filePath);
  }

  /**
   * Signal that the gallery UI is open. Starts cache eviction timer.
   */
  openGallery(): void {
    this.cache.startEviction();
  }

  /**
   * Signal that the gallery UI is closed. Stops cache eviction timer.
   */
  closeGallery(): void {
    this.cache.stopEviction();
  }

  /**
   * Clean up all resources. Rejects all pending requests and destroys cache.
   */
  destroy(): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('GalleryHandler destroyed'));
    }
    this.pending.clear();

    // Reject all queued thumbnails
    for (const queued of this.thumbnailQueue) {
      queued.reject(new Error('GalleryHandler destroyed'));
    }
    this.thumbnailQueue = [];

    this.sendMessage = null;
    this.cache.destroy();
  }

  // --- Internal ---

  /**
   * Fetch a single thumbnail from the phone, respecting concurrency limits.
   */
  private async fetchThumbnail(filePath: string): Promise<ThumbnailResult> {
    this.activeThumbnails++;

    try {
      const body = await this.sendRequest(
        MSG_GALLERY_THUMBNAIL,
        { path: filePath },
        THUMBNAIL_TIMEOUT_MS,
      ) as Record<string, unknown>;

      if (body['thumbnailFailed'] === true) {
        this.cache.markThumbnailFailed(filePath);
        return {
          path: filePath,
          localPath: '',
          width: 0,
          height: 0,
          failed: true,
        };
      }

      const base64Data = body['data'] as string;
      const buffer = Buffer.from(base64Data, 'base64');
      const localPath = this.cache.storeThumbnail(filePath, buffer);
      const width = (body['width'] as number) ?? 0;
      const height = (body['height'] as number) ?? 0;

      return {
        path: filePath,
        localPath,
        width,
        height,
        failed: false,
      };
    } finally {
      this.activeThumbnails--;
      this.drainThumbnailQueue();
    }
  }

  /**
   * Process the next queued thumbnail request if under the concurrency limit.
   */
  private drainThumbnailQueue(): void {
    while (this.thumbnailQueue.length > 0 && this.activeThumbnails < MAX_CONCURRENT_THUMBNAILS) {
      const next = this.thumbnailQueue.shift()!;
      // Fire and forget — resolve/reject are captured in the queued entry
      this.fetchThumbnail(next.filePath).then(next.resolve, next.reject);
    }
  }

  /**
   * Send a gallery request and return a Promise that resolves with the response body.
   */
  private sendRequest(
    type: string,
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<unknown> {
    if (!this.sendMessage) {
      return Promise.reject(new Error('No device connected'));
    }

    const requestId = randomUUID();

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Gallery request timed out (${timeoutMs / 1000}s): ${type}`));
      }, timeoutMs);

      this.pending.set(requestId, { resolve, reject, timer });

      this.sendMessage!({
        type,
        body: { ...body, requestId },
      });

      this.logger.debug('protocol.gallery', 'Sent gallery request', {
        type,
        requestId,
        ...body,
      });
    });
  }
}
