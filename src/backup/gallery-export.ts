/**
 * Gallery / Screenshots / All-Images Export
 *
 * Pulls the media file list from the phone via gallery.scan and writes
 * each file to the target directory, preserving the phone's folder layout
 * (e.g. target/DCIM/Camera/IMG_1234.jpg). Skips files whose target path
 * already exists with a matching size.
 *
 * See BACKUP_FEATURE.md for the overall design.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { QueryClient } from '../sync/query-client.js';
import { createLogger } from '../utils/logger.js';
import { AbortError, type ExportProgress } from './thread-export.js';

const logger = createLogger('backup');

export type GalleryScope = 'gallery' | 'screenshots' | 'images' | 'folders';

export interface GalleryExportResult {
  filesWritten: number;
  filesSkipped: number;
  bytesWritten: number;
  elapsedMs: number;
  errors: string[];
}

export interface GalleryExportOptions {
  targetDir: string;
  scope: GalleryScope;
  queryClient: QueryClient;
  /** Returns the local cache path for a phone-relative file path. On cache
   *  miss, streams from the phone and stores in cache, returning the new
   *  path. Shares the cache with the in-app Gallery viewer. */
  downloadFile: (filePath: string, expectedSize: number) => Promise<string>;
  /** Whether the file is already in the gallery cache (for logging). */
  isFileCached: (filePath: string) => boolean;
  onProgress: (p: ExportProgress) => void;
  signal: AbortSignal;
}

interface GalleryItem {
  path: string;       // "/DCIM/Camera/IMG_1234.jpg"
  filename: string;
  folder: string;     // "DCIM/Camera"
  mtime: number;      // seconds
  size: number;
  mimeType: string;
  isHidden: boolean;
  kind: 'image' | 'video';
}

export async function exportGallery(options: GalleryExportOptions): Promise<GalleryExportResult> {
  const { targetDir, scope, queryClient, downloadFile, isFileCached, onProgress, signal } = options;
  const started = Date.now();
  const errors: string[] = [];
  let filesWritten = 0;
  let filesSkipped = 0;
  let bytesWritten = 0;

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  logger.info('backup', 'Gallery export started', { targetDir, scope });
  onProgress({ percent: 0, line: `Starting ${scope} export to ${targetDir}` });

  onProgress({ percent: 0, line: 'Pulling media list from phone…', status: 'Scanning phone media' });
  const all = (await queryClient.query('gallery.scan')) as GalleryItem[];
  if (signal.aborted) throw new AbortError();

  const items = all.filter((it) => matchesScope(it, scope));
  onProgress({ percent: 1, line: `Found ${items.length} file(s) matching "${scope}"` });

  if (items.length === 0) {
    onProgress({ percent: 100, line: 'Nothing to export.', status: '' });
    return { filesWritten: 0, filesSkipped: 0, bytesWritten: 0, elapsedMs: Date.now() - started, errors: [] };
  }

  // Process in phone-returned order (newest first) so progress feels natural.
  for (let i = 0; i < items.length; i++) {
    if (signal.aborted) throw new AbortError();

    const item = items[i]!;
    const basePercent = 1 + (i / items.length) * 98;
    const relative = targetRelativePath(item, scope);
    const targetPath = path.join(targetDir, relative);

    onProgress({
      percent: Math.round(basePercent),
      line: `[${i + 1}/${items.length}] ${relative}`,
      status: `Exporting ${item.filename} (${i + 1} of ${items.length})`,
    });

    // Skip if target exists with matching size
    if (fs.existsSync(targetPath)) {
      try {
        const stat = fs.statSync(targetPath);
        if (stat.size === item.size) {
          filesSkipped++;
          onProgress({
            percent: Math.round(basePercent),
            line: `    skip (exists, size match)`,
          });
          continue;
        }
      } catch { /* fall through to download */ }
    }

    try {
      const wasCached = isFileCached(item.path);
      const localPath = await downloadFile(item.path, item.size);
      if (signal.aborted) throw new AbortError();

      const targetFolder = path.dirname(targetPath);
      fs.mkdirSync(targetFolder, { recursive: true });
      fs.copyFileSync(localPath, targetPath);

      // Preserve phone's mtime on the exported file — nicer for browsing.
      try {
        const when = new Date(item.mtime * 1000);
        fs.utimesSync(targetPath, when, when);
      } catch { /* non-fatal */ }

      filesWritten++;
      bytesWritten += item.size;
      onProgress({
        percent: Math.round(basePercent),
        line: `    ${wasCached ? 'copy from cache' : 'download'} ${formatBytes(item.size)}`,
      });
    } catch (err) {
      if (err instanceof AbortError) throw err;
      const m = err instanceof Error ? err.message : String(err);
      errors.push(`${item.path}: ${m}`);
      onProgress({
        percent: Math.round(basePercent),
        line: `    FAIL: ${m}`,
      });
    }
  }

  const elapsedMs = Date.now() - started;
  onProgress({
    percent: 100,
    line: `Done in ${Math.round(elapsedMs / 1000)}s — ${filesWritten} file(s) written, ${filesSkipped} skipped, ${formatBytes(bytesWritten)} total`,
    status: '',
  });
  if (errors.length > 0) {
    onProgress({ percent: 100, line: `${errors.length} error(s) — see daemon log for details` });
    for (const e of errors) logger.warn('backup', 'Gallery export error', { detail: e });
  }

  logger.info('backup', 'Gallery export complete', {
    scope,
    filesWritten,
    filesSkipped,
    bytesWritten,
    errors: errors.length,
    elapsedMs,
  });

  return { filesWritten, filesSkipped, bytesWritten, elapsedMs, errors };
}

// --- Helpers ---

function matchesScope(item: GalleryItem, scope: GalleryScope): boolean {
  if (item.isHidden) return false;

  if (scope === 'screenshots') {
    return hasPathSegment(item.folder, 'screenshots');
  }

  if (scope === 'images') {
    // Every image anywhere on the phone (excluding hidden folders).
    return item.kind === 'image';
  }

  if (scope === 'folders') {
    // All photos and videos from every folder on the phone, preserving the
    // phone's folder structure in the target directory.
    return item.kind === 'image' || item.kind === 'video';
  }

  // 'gallery' — only DCIM (camera-captured photos and videos). Users with
  // screenshots, memes, downloads, etc. in other folders should pick
  // "Screenshots" or another scope instead.
  return (item.kind === 'image' || item.kind === 'video')
    && hasPathSegment(item.folder, 'dcim');
}

function hasPathSegment(folderPath: string, target: string): boolean {
  if (!folderPath) return false;
  const needle = target.toLowerCase();
  return folderPath.split(/[\\/]+/).some((seg) => seg.toLowerCase() === needle);
}

function stripLeadingSlash(p: string): string {
  return p.startsWith('/') ? p.slice(1) : p;
}

/** Compute the target path (relative to the export root) for a file under
 *  the given scope.
 *
 *  - `folders` scope flattens to `<leaf-folder-name>/<filename>`, matching
 *    how the app's Folders viewer groups files by the last folder segment.
 *    So `/Movies/Messenger/clip.mp4` on the phone becomes
 *    `target/Messenger/clip.mp4`.
 *  - Every other scope preserves the phone's full relative path. */
function targetRelativePath(item: GalleryItem, scope: GalleryScope): string {
  if (scope !== 'folders') return stripLeadingSlash(item.path);
  const leaf = leafFolder(item.folder);
  return leaf ? path.posix.join(leaf, item.filename) : item.filename;
}

/** Last segment of a `a/b/c`-style relative folder path, or `''` for root. */
function leafFolder(folder: string): string {
  if (!folder) return '';
  const parts = folder.split(/[\\/]+/).filter((p) => p.length > 0);
  return parts.length === 0 ? '' : parts[parts.length - 1]!;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
