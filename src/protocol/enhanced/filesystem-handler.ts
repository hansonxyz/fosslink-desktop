/**
 * Filesystem Handler
 *
 * Request/response correlator for fosslink.fs.* messages. Sends filesystem
 * commands to the phone over WebSocket and returns Promises that resolve when
 * the phone responds with the matching requestId.
 *
 * Each request gets a UUID requestId and a 30-second timeout. The phone echoes
 * the requestId in its response so we can correlate request to Promise.
 *
 * Supports: stat, readdir, read, write, mkdir, delete, rename.
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../../utils/logger.js';
import type { Logger } from '../../utils/logger.js';
import type { ProtocolMessage } from '../../network/packet.js';
import {
  MSG_FS_STAT,
  MSG_FS_READDIR,
  MSG_FS_READ,
  MSG_FS_WRITE,
  MSG_FS_MKDIR,
  MSG_FS_DELETE,
  MSG_FS_RENAME,
  MSG_FS_WATCH,
  MSG_FS_UNWATCH,
} from '../../network/packet.js';

/** Timeout for pending requests (ms) */
const REQUEST_TIMEOUT_MS = 30_000;

export interface StatResult {
  exists: boolean;
  isDir: boolean;
  isFile: boolean;
  size: number;
  mtime: number;  // epoch seconds
  permissions: string;
}

export interface ReaddirEntry {
  name: string;
  isDir: boolean;
  size: number;
  mtime: number;
}

export interface ReadResult {
  data: Buffer;
  bytesRead: number;
  eof: boolean;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class FilesystemHandler {
  private pending = new Map<string, PendingRequest>();
  private sendMessage: ((msg: ProtocolMessage) => void) | null = null;
  private logger: Logger;

  constructor() {
    this.logger = createLogger('filesystem-handler');
  }

  /**
   * Set the function used to send messages to the phone.
   * Called when a device connection is established.
   */
  setSendFunction(fn: (msg: ProtocolMessage) => void): void {
    this.sendMessage = fn;
  }

  /**
   * Clear the send function. Called when the connection drops.
   */
  clearSendFunction(): void {
    this.sendMessage = null;
  }

  /**
   * Called by the message router when the phone responds to a filesystem request.
   * Matches the response to a pending Promise by requestId.
   */
  handleResponse(msg: ProtocolMessage): void {
    const requestId = msg.body['requestId'] as string | undefined;
    if (!requestId) {
      this.logger.warn('protocol.fs', 'Received fs response without requestId', {
        type: msg.type,
      });
      return;
    }

    const entry = this.pending.get(requestId);
    if (!entry) {
      this.logger.debug('protocol.fs', 'Received fs response for unknown requestId (possibly timed out)', {
        requestId,
        type: msg.type,
      });
      return;
    }

    this.pending.delete(requestId);
    clearTimeout(entry.timer);

    const error = msg.body['error'] as string | undefined;
    if (error) {
      this.logger.debug('protocol.fs', 'Filesystem request returned error', {
        requestId,
        error,
      });
      entry.reject(new Error(error));
      return;
    }

    entry.resolve(msg.body);
  }

  /**
   * Get file/directory metadata.
   */
  async stat(path: string): Promise<StatResult> {
    const body = await this.sendRequest(MSG_FS_STAT, { path }) as Record<string, unknown>;
    if (body['exists'] === false) {
      return { exists: false, isDir: false, isFile: false, size: 0, mtime: 0, permissions: '' };
    }
    return {
      exists: true,
      isDir: body['isDir'] === true,
      isFile: body['isFile'] === true,
      size: (body['size'] as number) ?? 0,
      mtime: (body['mtime'] as number) ?? 0,
      permissions: (body['permissions'] as string) ?? '',
    };
  }

  /**
   * List directory contents.
   */
  async readdir(path: string): Promise<ReaddirEntry[]> {
    const body = await this.sendRequest(MSG_FS_READDIR, { path }) as Record<string, unknown>;
    const entries = body['entries'] as Array<Record<string, unknown>>;
    return entries.map((e) => ({
      name: e['name'] as string,
      isDir: e['isDir'] as boolean,
      size: e['size'] as number,
      mtime: e['mtime'] as number,
    }));
  }

  /**
   * Read file contents at the given offset and length.
   * The phone returns base64-encoded data which is decoded into a Buffer.
   */
  async read(path: string, offset: number, length: number): Promise<ReadResult> {
    const body = await this.sendRequest(MSG_FS_READ, { path, offset, length }) as Record<string, unknown>;
    const base64Data = body['data'] as string;
    const data = Buffer.from(base64Data, 'base64');
    return {
      data,
      bytesRead: body['bytesRead'] as number,
      eof: body['eof'] as boolean,
    };
  }

  /**
   * Write data to a file at the given offset.
   * The data Buffer is base64-encoded before sending.
   * Returns the number of bytes written.
   */
  async write(path: string, offset: number, data: Buffer, truncate: boolean): Promise<number> {
    const base64Data = data.toString('base64');
    const body = await this.sendRequest(MSG_FS_WRITE, {
      path,
      offset,
      data: base64Data,
      truncate,
    }) as Record<string, unknown>;
    return body['bytesWritten'] as number;
  }

  /**
   * Create a directory (and any missing parents).
   */
  async mkdir(path: string): Promise<void> {
    await this.sendRequest(MSG_FS_MKDIR, { path });
  }

  /**
   * Delete a file or directory.
   */
  async delete(path: string, recursive: boolean): Promise<void> {
    await this.sendRequest(MSG_FS_DELETE, { path, recursive });
  }

  /**
   * Rename/move a file or directory.
   */
  async rename(from: string, to: string): Promise<void> {
    await this.sendRequest(MSG_FS_RENAME, { from, to });
  }

  /**
   * Start watching a directory on the phone for filesystem changes.
   */
  async watch(path: string): Promise<void> {
    await this.sendRequest(MSG_FS_WATCH, { path });
  }

  /**
   * Stop watching a directory on the phone.
   */
  async unwatch(path: string): Promise<void> {
    await this.sendRequest(MSG_FS_UNWATCH, { path });
  }

  /**
   * Clean up all resources. Rejects all pending requests.
   */
  destroy(): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('FilesystemHandler destroyed'));
    }
    this.pending.clear();
    this.sendMessage = null;
  }

  // --- Internal ---

  /**
   * Send a filesystem request and return a Promise that resolves with the response body.
   */
  private sendRequest(type: string, body: Record<string, unknown>): Promise<unknown> {
    if (!this.sendMessage) {
      return Promise.reject(new Error('No device connected'));
    }

    const requestId = randomUUID();

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(`Filesystem request timed out (${REQUEST_TIMEOUT_MS / 1000}s): ${type}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(requestId, { resolve, reject, timer });

      this.sendMessage!({
        type,
        body: { ...body, requestId },
      });

      this.logger.debug('protocol.fs', 'Sent filesystem request', {
        type,
        requestId,
        ...body,
      });
    });
  }
}
