/**
 * WebDAV Server
 *
 * A localhost HTTP server that exposes the phone's filesystem via WebDAV.
 * Proxies all filesystem operations to the phone through a FilesystemHandler.
 *
 * Implements WebDAV class 1 and 2 methods (RFC 4918):
 * OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY,
 * LOCK, UNLOCK, PROPPATCH
 *
 * Uses only Node.js built-in http module — no external dependencies.
 * Fake LOCK/UNLOCK support for Windows Explorer compatibility.
 */

import * as http from 'node:http';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { createLogger } from '../utils/logger.js';
import type { Logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// FilesystemHandler interface
// ---------------------------------------------------------------------------

export interface FilesystemStatResult {
  exists: boolean;
  isDir: boolean;
  isFile: boolean;
  size: number;
  mtime: number;
  permissions: string;
}

export interface FilesystemDirEntry {
  name: string;
  isDir: boolean;
  size: number;
  mtime: number;
}

export interface FilesystemReadResult {
  data: Buffer;
  bytesRead: number;
  eof: boolean;
}

export interface FilesystemHandler {
  stat(path: string): Promise<FilesystemStatResult>;
  readdir(path: string): Promise<Array<FilesystemDirEntry>>;
  read(path: string, offset: number, length: number): Promise<FilesystemReadResult>;
  write(path: string, offset: number, data: Buffer, truncate: boolean): Promise<number>;
  mkdir(path: string): Promise<void>;
  delete(path: string, recursive: boolean): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 8717;
const READ_CHUNK_SIZE = 1_048_576; // 1 MB

const DAV_HEADER = '1,2';
const ALLOW_HEADER =
  'OPTIONS,PROPFIND,GET,HEAD,PUT,DELETE,MKCOL,MOVE,COPY,LOCK,UNLOCK,PROPPATCH';

/** Basic MIME type map keyed by lowercase extension (with dot). */
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
  '.apk': 'application/vnd.android.package-archive',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const DEFAULT_MIME = 'application/octet-stream';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface WebdavServerOptions {
  fs: FilesystemHandler;
  port?: number;
  logger?: Logger;
}

// ---------------------------------------------------------------------------
// WebdavServer
// ---------------------------------------------------------------------------

export class WebdavServer {
  private readonly fs: FilesystemHandler;
  private readonly port: number;
  private readonly log: Logger;
  private server: http.Server | undefined;
  private running = false;
  private boundPort = 0;

  constructor(options: WebdavServerOptions) {
    this.fs = options.fs;
    this.port = options.port ?? DEFAULT_PORT;
    this.log = options.logger ?? createLogger('webdav');
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async start(): Promise<{ port: number }> {
    if (this.running) {
      throw new Error('WebDAV server is already running');
    }

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err: unknown) => {
        this.log.error('request', 'Unhandled error in request handler', {
          error: String(err),
          method: req.method,
          url: req.url,
        });
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        res.end('Internal Server Error');
      });
    });

    return new Promise((resolve, reject) => {
      const srv = this.server!;
      srv.on('error', reject);
      srv.listen(this.port, '127.0.0.1', () => {
        const addr = srv.address();
        if (addr && typeof addr === 'object') {
          this.boundPort = addr.port;
        } else {
          this.boundPort = this.port;
        }
        this.running = true;
        this.log.info('lifecycle', 'WebDAV server started', { port: this.boundPort });
        resolve({ port: this.boundPort });
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.running || !this.server) {
      return;
    }
    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        this.running = false;
        this.server = undefined;
        this.boundPort = 0;
        if (err) {
          reject(err);
        } else {
          this.log.info('lifecycle', 'WebDAV server stopped');
          resolve();
        }
      });
    });
  }

  isRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    return this.boundPort;
  }

  getMountUrl(): string {
    return `http://localhost:${this.boundPort}/`;
  }

  // -----------------------------------------------------------------------
  // Request router
  // -----------------------------------------------------------------------

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const method = (req.method ?? 'GET').toUpperCase();
    const rawPath = req.url ?? '/';
    const decodedPath = normalizePath(decodeURIComponent(rawPath.split('?')[0] ?? '/'));

    this.log.debug('request', `${method} ${decodedPath}`, {
      method,
      path: decodedPath,
      depth: req.headers['depth'] as string | undefined,
    });

    // Common CORS / WebDAV headers
    res.setHeader('DAV', DAV_HEADER);
    res.setHeader('MS-Author-Via', 'DAV');
    res.setHeader('Allow', ALLOW_HEADER);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', ALLOW_HEADER);
    res.setHeader('Access-Control-Allow-Headers', 'Depth, Content-Type, Authorization, Destination, Overwrite');

    switch (method) {
      case 'OPTIONS':
        return this.handleOptions(res);
      case 'PROPFIND':
        return this.handlePropfind(req, res, decodedPath);
      case 'GET':
        return this.handleGet(res, decodedPath, false);
      case 'HEAD':
        return this.handleGet(res, decodedPath, true);
      case 'PUT':
        return this.handlePut(req, res, decodedPath);
      case 'DELETE':
        return this.handleDelete(res, decodedPath);
      case 'MKCOL':
        return this.handleMkcol(res, decodedPath);
      case 'MOVE':
        return this.handleMove(req, res, decodedPath);
      case 'COPY':
        return this.handleCopy(req, res, decodedPath);
      case 'LOCK':
        return this.handleLock(req, res, decodedPath);
      case 'UNLOCK':
        return this.handleUnlock(res);
      case 'PROPPATCH':
        return this.handleProppatch(req, res, decodedPath);
      default:
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
    }
  }

  // -----------------------------------------------------------------------
  // OPTIONS
  // -----------------------------------------------------------------------

  private handleOptions(res: http.ServerResponse): void {
    res.writeHead(200, {
      'Content-Length': '0',
    });
    res.end();
  }

  // -----------------------------------------------------------------------
  // PROPFIND
  // -----------------------------------------------------------------------

  private async handlePropfind(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    reqPath: string,
  ): Promise<void> {
    // Consume request body (XML) — we ignore it and return allprop
    await consumeBody(req);

    const depthHeader = req.headers['depth'] as string | undefined;
    const depth = depthHeader === '0' ? 0 : 1;

    const stat = await this.fs.stat(reqPath);
    if (!stat.exists) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const responses: string[] = [];

    // The resource itself
    responses.push(
      buildPropfindEntry(reqPath, stat.isDir, stat.size, stat.mtime),
    );

    // Children (if directory and depth=1)
    if (stat.isDir && depth === 1) {
      const entries = await this.fs.readdir(reqPath);
      for (const entry of entries) {
        const childPath = reqPath === '/'
          ? `/${entry.name}`
          : `${reqPath}/${entry.name}`;
        responses.push(
          buildPropfindEntry(childPath, entry.isDir, entry.size, entry.mtime),
        );
      }
    }

    const xml =
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<D:multistatus xmlns:D="DAV:">\n` +
      responses.join('\n') +
      `\n</D:multistatus>`;

    const body = Buffer.from(xml, 'utf-8');
    res.writeHead(207, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Length': String(body.length),
    });
    res.end(body);
  }

  // -----------------------------------------------------------------------
  // GET / HEAD
  // -----------------------------------------------------------------------

  private async handleGet(
    res: http.ServerResponse,
    reqPath: string,
    headOnly: boolean,
  ): Promise<void> {
    const stat = await this.fs.stat(reqPath);
    if (!stat.exists) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(headOnly ? '' : 'Not Found');
      return;
    }
    if (stat.isDir) {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end(headOnly ? '' : 'Method Not Allowed');
      return;
    }

    const mime = guessMime(reqPath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': String(stat.size),
      'Last-Modified': formatDate(stat.mtime),
      'Accept-Ranges': 'bytes',
    });

    if (headOnly) {
      res.end();
      return;
    }

    // Stream in chunks
    let offset = 0;
    while (offset < stat.size) {
      const result = await this.fs.read(reqPath, offset, READ_CHUNK_SIZE);
      if (result.bytesRead === 0) {
        break;
      }
      res.write(result.data.subarray(0, result.bytesRead));
      offset += result.bytesRead;
      if (result.eof) {
        break;
      }
    }
    res.end();
  }

  // -----------------------------------------------------------------------
  // PUT
  // -----------------------------------------------------------------------

  private async handlePut(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    reqPath: string,
  ): Promise<void> {
    // Check if file exists before write to determine 201 vs 204
    const existsBefore = (await this.fs.stat(reqPath)).exists;

    let offset = 0;
    let isFirst = true;

    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      await this.fs.write(reqPath, offset, buf, isFirst);
      offset += buf.length;
      isFirst = false;
    }

    // If the request body was empty, create an empty file
    if (isFirst) {
      await this.fs.write(reqPath, 0, Buffer.alloc(0), true);
    }

    const status = existsBefore ? 204 : 201;
    res.writeHead(status);
    res.end();
  }

  // -----------------------------------------------------------------------
  // DELETE
  // -----------------------------------------------------------------------

  private async handleDelete(
    res: http.ServerResponse,
    reqPath: string,
  ): Promise<void> {
    const stat = await this.fs.stat(reqPath);
    if (!stat.exists) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    await this.fs.delete(reqPath, stat.isDir);
    res.writeHead(204);
    res.end();
  }

  // -----------------------------------------------------------------------
  // MKCOL
  // -----------------------------------------------------------------------

  private async handleMkcol(
    res: http.ServerResponse,
    reqPath: string,
  ): Promise<void> {
    await this.fs.mkdir(reqPath);
    res.writeHead(201);
    res.end();
  }

  // -----------------------------------------------------------------------
  // MOVE
  // -----------------------------------------------------------------------

  private async handleMove(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    srcPath: string,
  ): Promise<void> {
    const destPath = parseDestinationPath(req);
    if (!destPath) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing or invalid Destination header');
      return;
    }

    const destExists = (await this.fs.stat(destPath)).exists;
    await this.fs.rename(srcPath, destPath);

    res.writeHead(destExists ? 204 : 201);
    res.end();
  }

  // -----------------------------------------------------------------------
  // COPY
  // -----------------------------------------------------------------------

  private async handleCopy(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    srcPath: string,
  ): Promise<void> {
    const destPath = parseDestinationPath(req);
    if (!destPath) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing or invalid Destination header');
      return;
    }

    const srcStat = await this.fs.stat(srcPath);
    if (!srcStat.exists) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    if (srcStat.isDir) {
      // For directory copy, just create the directory at destination.
      // Full recursive copy would need a tree walk — keep it simple.
      await this.fs.mkdir(destPath);
      res.writeHead(201);
      res.end();
      return;
    }

    // Copy file contents in chunks: read from source, write to destination
    let offset = 0;
    let isFirst = true;
    while (offset < srcStat.size) {
      const result = await this.fs.read(srcPath, offset, READ_CHUNK_SIZE);
      if (result.bytesRead === 0) {
        break;
      }
      const chunk = result.data.subarray(0, result.bytesRead);
      await this.fs.write(destPath, offset, chunk, isFirst);
      offset += result.bytesRead;
      isFirst = false;
      if (result.eof) {
        break;
      }
    }

    // Handle empty file copy
    if (isFirst) {
      await this.fs.write(destPath, 0, Buffer.alloc(0), true);
    }

    res.writeHead(201);
    res.end();
  }

  // -----------------------------------------------------------------------
  // LOCK (fake — for Windows Explorer compatibility)
  // -----------------------------------------------------------------------

  private async handleLock(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    reqPath: string,
  ): Promise<void> {
    await consumeBody(req);

    const token = `urn:uuid:${crypto.randomUUID()}`;
    const xml =
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<D:prop xmlns:D="DAV:">\n` +
      `  <D:lockdiscovery>\n` +
      `    <D:activelock>\n` +
      `      <D:locktype><D:write/></D:locktype>\n` +
      `      <D:lockscope><D:exclusive/></D:lockscope>\n` +
      `      <D:depth>infinity</D:depth>\n` +
      `      <D:owner><D:href>FossLink</D:href></D:owner>\n` +
      `      <D:timeout>Second-3600</D:timeout>\n` +
      `      <D:locktoken><D:href>${token}</D:href></D:locktoken>\n` +
      `      <D:lockroot><D:href>${encodeHref(reqPath)}</D:href></D:lockroot>\n` +
      `    </D:activelock>\n` +
      `  </D:lockdiscovery>\n` +
      `</D:prop>`;

    const body = Buffer.from(xml, 'utf-8');
    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Length': String(body.length),
      'Lock-Token': `<${token}>`,
    });
    res.end(body);
  }

  // -----------------------------------------------------------------------
  // UNLOCK
  // -----------------------------------------------------------------------

  private handleUnlock(res: http.ServerResponse): void {
    res.writeHead(204);
    res.end();
  }

  // -----------------------------------------------------------------------
  // PROPPATCH (no-op — pretend all property changes succeed)
  // -----------------------------------------------------------------------

  private async handleProppatch(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    reqPath: string,
  ): Promise<void> {
    const bodyStr = await readBodyString(req);

    // Extract property names from the request XML to echo back success
    const propNames = extractProppatchPropertyNames(bodyStr);

    const propEntries = propNames.length > 0
      ? propNames.map((p) => `        <${p}/>`).join('\n')
      : '        <D:displayname/>';

    const xml =
      `<?xml version="1.0" encoding="utf-8"?>\n` +
      `<D:multistatus xmlns:D="DAV:">\n` +
      `  <D:response>\n` +
      `    <D:href>${encodeHref(reqPath)}</D:href>\n` +
      `    <D:propstat>\n` +
      `      <D:prop>\n` +
      propEntries + '\n' +
      `      </D:prop>\n` +
      `      <D:status>HTTP/1.1 200 OK</D:status>\n` +
      `    </D:propstat>\n` +
      `  </D:response>\n` +
      `</D:multistatus>`;

    const body = Buffer.from(xml, 'utf-8');
    res.writeHead(207, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Length': String(body.length),
    });
    res.end(body);
  }
}

// ---------------------------------------------------------------------------
// Helpers — XML building
// ---------------------------------------------------------------------------

/**
 * Build a single <D:response> element for PROPFIND.
 */
function buildPropfindEntry(
  entryPath: string,
  isDir: boolean,
  size: number,
  mtime: number,
): string {
  const displayName = entryPath === '/'
    ? '/'
    : path.posix.basename(entryPath);

  const href = isDir && !entryPath.endsWith('/')
    ? encodeHref(entryPath) + '/'
    : encodeHref(entryPath);

  const resourceType = isDir
    ? '<D:collection/>'
    : '';

  const contentType = isDir
    ? 'httpd/unix-directory'
    : guessMime(entryPath);

  return (
    `  <D:response>\n` +
    `    <D:href>${href}</D:href>\n` +
    `    <D:propstat>\n` +
    `      <D:prop>\n` +
    `        <D:displayname>${escapeXml(displayName)}</D:displayname>\n` +
    `        <D:getcontentlength>${size}</D:getcontentlength>\n` +
    `        <D:getlastmodified>${formatDate(mtime)}</D:getlastmodified>\n` +
    `        <D:resourcetype>${resourceType}</D:resourcetype>\n` +
    `        <D:getcontenttype>${contentType}</D:getcontenttype>\n` +
    `      </D:prop>\n` +
    `      <D:status>HTTP/1.1 200 OK</D:status>\n` +
    `    </D:propstat>\n` +
    `  </D:response>`
  );
}

// ---------------------------------------------------------------------------
// Helpers — paths and encoding
// ---------------------------------------------------------------------------

/**
 * Normalize a decoded path: collapse double slashes, ensure leading slash,
 * remove trailing slash (unless root).
 */
function normalizePath(p: string): string {
  let normalized = path.posix.normalize(p);
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  // Remove trailing slash unless root
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Encode a path for use in XML <D:href> elements.
 * Uses encodeURI to percent-encode special characters but keeps slashes.
 */
function encodeHref(p: string): string {
  return encodeURI(p);
}

/**
 * Escape special XML characters in text content.
 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Parse the Destination header from MOVE/COPY requests and extract the path.
 * The Destination header is a full URL like "http://localhost:8717/new/path".
 */
function parseDestinationPath(req: http.IncomingMessage): string | undefined {
  const dest = req.headers['destination'] as string | undefined;
  if (!dest) {
    return undefined;
  }

  try {
    const url = new URL(dest);
    return normalizePath(decodeURIComponent(url.pathname));
  } catch {
    // If it's not a full URL, try treating it as a path
    return normalizePath(decodeURIComponent(dest));
  }
}

/**
 * Extract property names from a PROPPATCH XML body.
 * Simple regex-based extraction — no XML parser needed.
 */
function extractProppatchPropertyNames(xmlBody: string): string[] {
  const names: string[] = [];
  // Match anything inside <D:set><D:prop>...</D:prop></D:set> or
  // <D:remove><D:prop>...</D:prop></D:remove>
  // Look for XML element open tags inside <D:prop> or <prop>
  const propBlockRegex = /<(?:D:)?prop\b[^>]*>([\s\S]*?)<\/(?:D:)?prop>/gi;
  let match: RegExpExecArray | null;
  while ((match = propBlockRegex.exec(xmlBody)) !== null) {
    const block = match[1] as string;
    // Extract element names from the block
    const elemRegex = /<((?:\w+:)?\w+)[\s/>]/g;
    let elemMatch: RegExpExecArray | null;
    while ((elemMatch = elemRegex.exec(block)) !== null) {
      const name = elemMatch[1] as string;
      if (!names.includes(name)) {
        names.push(name);
      }
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// Helpers — MIME types and dates
// ---------------------------------------------------------------------------

/**
 * Guess MIME type from file extension.
 */
function guessMime(filePath: string): string {
  const ext = path.posix.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? DEFAULT_MIME;
}

/**
 * Format a Unix timestamp (seconds) as RFC 1123 date string.
 */
function formatDate(mtimeSeconds: number): string {
  return new Date(mtimeSeconds * 1000).toUTCString();
}

// ---------------------------------------------------------------------------
// Helpers — request body reading
// ---------------------------------------------------------------------------

/**
 * Consume and discard the request body.
 */
function consumeBody(req: http.IncomingMessage): Promise<void> {
  return new Promise((resolve) => {
    req.on('data', () => { /* discard */ });
    req.on('end', resolve);
  });
}

/**
 * Read the full request body as a UTF-8 string.
 */
function readBodyString(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    req.on('error', reject);
  });
}
