/**
 * Thread Export — Text Format
 *
 * Produces one .txt file per thread in the target directory, plus a
 * sibling `_mms` folder with attachment bytes when `includeMedia` is on.
 *
 * See BACKUP_FEATURE.md for the full design.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { QueryClient } from '../sync/query-client.js';
import type { DatabaseService, ContactRow } from '../database/database.js';
import type { SmsHandler } from '../protocol/standard/sms-handler.js';
import { createLogger } from '../utils/logger.js';
import { formatPhone, normalizePhone } from '../utils/phone.js';
import { getContactPhotosDir } from '../utils/paths.js';

const logger = createLogger('backup');

export interface ExportProgress {
  percent: number;
  line: string;
  /** Short description of what's currently in flight (e.g. the thread name).
   *  If set, the renderer shows this above the progress bar; sticks until the
   *  next progress event that sets it to something new or empty. */
  status?: string;
}

export interface ExportResult {
  threadsWritten: number;
  messagesWritten: number;
  attachmentsWritten: number;
  elapsedMs: number;
  errors: string[];
}

export type ExportFormat = 'txt' | 'xml' | 'html';

export interface ExportOptions {
  targetDir: string;
  includeMedia: boolean;
  format: ExportFormat;
  queryClient: QueryClient;
  db: DatabaseService;
  smsHandler: SmsHandler;
  onProgress: (p: ExportProgress) => void;
  signal: AbortSignal;
}

interface ThreadFromPhone {
  threadId: number;
  addresses: string | string[];
  snippet: string;
  snippetDate: number;
  unreadCount: number;
}

interface AttachmentFromPhone {
  part_id: number;
  unique_identifier: number | string;
  mime_type: string;
  filename?: string;
}

interface MessageFromPhone {
  _id: number;
  thread_id: number;
  address: string;
  body: string | null;
  date: number;
  type: number;
  attachments?: AttachmentFromPhone[];
}

interface ContactFromPhone {
  uid: string;
  name: string;
  phones: string[];
}

/** Run the export. Throws on fatal errors; caller should catch and emit error notification. */
export async function exportThreads(options: ExportOptions): Promise<ExportResult> {
  const started = Date.now();
  const errors: string[] = [];
  let messagesWritten = 0;
  let attachmentsWritten = 0;
  let threadsWritten = 0;

  const { targetDir, includeMedia, format, queryClient, db, smsHandler, onProgress, signal } = options;

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  logger.info('backup', 'Export started', { targetDir, includeMedia });
  onProgress({ percent: 0, line: `Starting export to ${targetDir}` });

  // Pull fresh thread list
  onProgress({ percent: 0, line: 'Pulling thread list from phone…' });
  const threads = (await queryClient.query('threads.list')) as ThreadFromPhone[];
  if (signal.aborted) throw new AbortError();
  onProgress({ percent: 1, line: `Thread list: ${threads.length} threads` });

  // Pull fresh contacts for name resolution. Also keep the local DB's
  // ContactRow lookup keyed by normalized phone so we can find the cached
  // contact photo file. The DB is the authoritative source for photo_path.
  onProgress({ percent: 1, line: 'Pulling contacts from phone…' });
  let phoneToName: Map<string, string>;
  try {
    const contacts = (await queryClient.query('contacts.list')) as ContactFromPhone[];
    phoneToName = buildPhoneNameMap(contacts);
    onProgress({ percent: 2, line: `Contacts: ${contacts.length}` });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    logger.warn('backup', 'Failed to pull contacts; falling back to local DB', { error: m });
    phoneToName = buildPhoneNameMapFromDb(db);
    onProgress({ percent: 2, line: `Could not fetch contacts (${m}); using local copies` });
  }
  const phoneToContact = buildPhoneContactMapFromDb(db);
  if (signal.aborted) throw new AbortError();

  const usedNames = new Set<string>();
  // Accumulator for the HTML index: one entry per thread in iteration order.
  const indexEntries: Array<{
    filename: string;
    displayName: string;
    snippet: string;
    date: number;
    /** Relative path from index.html to the thread's avatar photo, if any. */
    avatarSrc: string | null;
    avatarInitials: string;
    avatarColor: string;
  }> = [];

  for (let tIdx = 0; tIdx < threads.length; tIdx++) {
    if (signal.aborted) throw new AbortError();

    const thread = threads[tIdx]!;
    const addresses = parseAddresses(thread.addresses);
    const participantNames = addresses.map((a) => phoneToName.get(normalizePhone(a)) ?? formatPhone(a));
    const baseName = sanitizeFilename(buildFilenameStem(participantNames)) || `thread-${thread.threadId}`;
    const filename = disambiguate(baseName, usedNames);
    usedNames.add(filename.toLowerCase());

    const basePercent = 2 + (tIdx / threads.length) * 96;
    onProgress({
      percent: Math.round(basePercent),
      line: `[${tIdx + 1}/${threads.length}] ${filename}`,
      status: `Backing up ${filename} (${tIdx + 1} of ${threads.length})`,
    });

    try {
      const messages = (await queryClient.query('threads.messages', {
        threadId: thread.threadId,
      })) as MessageFromPhone[];

      if (signal.aborted) throw new AbortError();
      onProgress({
        percent: Math.round(basePercent),
        line: `    ${messages.length} messages`,
      });

      // Sort chronologically
      messages.sort((a, b) => a.date - b.date);

      // Collect attachments for size preflight (only if we're going to include media)
      const attachmentList: Array<{ partId: number; messageId: number; mime: string; filename?: string; date: number }> = [];
      if (includeMedia) {
        for (const m of messages) {
          if (m.attachments) {
            for (const a of m.attachments) {
              attachmentList.push({
                partId: a.part_id,
                messageId: m._id,
                mime: a.mime_type,
                filename: a.filename,
                date: m.date,
              });
            }
          }
        }
      }

      // One folder per thread. The conversation file and all attachments
      // live inside it together — no separate _mms folder.
      const threadDir = path.join(targetDir, filename);
      fs.mkdirSync(threadDir, { recursive: true });

      // Copy contact photos for each participant (skipping "You" — we don't
      // have a photo for the local user). Filename pattern:
      //     contact-<sanitized-participant-name>.<ext>
      const contactPhotoMap = new Map<string, string>(); // normalizedPhone -> basename of copied file
      for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i]!;
        const contact = phoneToContact.get(normalizePhone(addr));
        if (!contact || !contact.photo_path) continue;
        const srcPath = path.join(getContactPhotosDir(), contact.photo_path);
        if (!fs.existsSync(srcPath)) continue;
        const ext = contactPhotoExt(contact.photo_mime, contact.photo_path);
        const baseStem = sanitizeFilename(participantNames[i] ?? contact.name) || 'contact';
        const destName = `contact-${baseStem}${ext}`;
        const destPath = path.join(threadDir, destName);
        try {
          fs.copyFileSync(srcPath, destPath);
          contactPhotoMap.set(normalizePhone(addr), destName);
        } catch { /* ignore per-file copy errors */ }
      }

      // Assign target filenames first so we can decide which (if any) need a
      // size check on the phone. On first-time export the set is empty so we
      // skip the network query entirely.
      const attachmentTargetNames = new Map<string, string>(); // "partId:messageId" -> target filename
      const needsSizeCheck: Array<{ partId: number; messageId: number }> = [];
      for (const a of attachmentList) {
        const fname = buildAttachmentFilename(a.date, a.partId, a.mime, a.filename);
        attachmentTargetNames.set(`${a.partId}:${a.messageId}`, fname);
        const targetPath = path.join(threadDir, fname);
        if (fs.existsSync(targetPath)) {
          needsSizeCheck.push({ partId: a.partId, messageId: a.messageId });
        }
      }

      // Only query sizes for attachments whose target file already exists
      // (re-export scenario). Prevents flooding the phone with queries on
      // first-time export.
      const sizeByPart = new Map<number, number>();
      if (needsSizeCheck.length > 0) {
        try {
          const sizes = (await queryClient.query('attachments.sizes', {
            items: needsSizeCheck,
          })) as Array<{ partId: number; size: number }>;
          for (const s of sizes) sizeByPart.set(s.partId, s.size);
        } catch (err) {
          // Old phones don't have this query — fall through, target-exists
          // attachments will be re-downloaded.
          logger.warn('backup', 'attachments.sizes query failed, will always download', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      for (const a of attachmentList) {
        if (signal.aborted) throw new AbortError();
        const key = `${a.partId}:${a.messageId}`;
        const fname = attachmentTargetNames.get(key)!;

        const targetPath = path.join(threadDir, fname);
        const phoneSize = sizeByPart.get(a.partId);

        // Skip-if-exists-with-same-size
        if (phoneSize !== undefined && phoneSize >= 0 && fs.existsSync(targetPath)) {
          try {
            const stat = fs.statSync(targetPath);
            if (stat.size === phoneSize) {
              onProgress({
                percent: Math.round(basePercent),
                line: `    skip ${fname} (exists, size match)`,
              });
              attachmentsWritten++;
              continue;
            }
          } catch { /* fall through to download */ }
        }

        // Download (or reuse cached copy) and copy to target. Downloaded
        // attachments stay in the cache — same behavior as if the user had
        // opened the thread in the main UI.
        const wasCached = wasAttachmentCached(db, a.partId, a.messageId);
        try {
          const localPath = await smsHandler.downloadAttachment(a.partId, a.messageId);
          if (signal.aborted) throw new AbortError();
          fs.copyFileSync(localPath, targetPath);
          attachmentsWritten++;
          onProgress({
            percent: Math.round(basePercent),
            line: `    ${wasCached ? 'copy' : 'download'} ${fname}`,
          });
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          errors.push(`Attachment ${a.partId}:${a.messageId}: ${m}`);
          onProgress({
            percent: Math.round(basePercent),
            line: `    FAIL ${fname}: ${m}`,
          });
        }
      }

      // Build + write the conversation file inside the thread's folder
      const ext = format === 'xml' ? 'xml' : (format === 'html' ? 'html' : 'txt');
      const convPath = path.join(threadDir, `${filename}.${ext}`);
      let content: string;
      if (format === 'xml') {
        content = buildThreadXml(messages, participantNames, phoneToName, attachmentTargetNames);
      } else if (format === 'html') {
        content = buildThreadHtml({
          messages,
          participantNames,
          phoneToName,
          attachmentTargetNames,
          contactPhotoMap,
          normalizedParticipantPhones: addresses.map(normalizePhone),
        });
      } else {
        content = buildThreadText(messages, participantNames, phoneToName, attachmentTargetNames);
      }
      fs.writeFileSync(convPath, content, 'utf-8');
      messagesWritten += messages.length;
      threadsWritten++;

      // Track for index.html, if we're going to need it
      if (format === 'html') {
        const lastMsg = messages[messages.length - 1];
        const snippet = lastMsg?.body && lastMsg.body.length > 0
          ? lastMsg.body
          : (lastMsg?.attachments && lastMsg.attachments.length > 0 ? '[Attachment]' : '');
        const displayName = buildFilenameStem(participantNames) || filename;

        // Use the sole participant's contact photo for 1:1 threads only.
        // Groups fall back to initials.
        let avatarSrc: string | null = null;
        if (addresses.length === 1) {
          const photoFile = contactPhotoMap.get(normalizePhone(addresses[0]!));
          if (photoFile) avatarSrc = `${filename}/${photoFile}`;
        }

        indexEntries.push({
          filename,
          displayName,
          snippet,
          date: lastMsg?.date ?? thread.snippetDate ?? 0,
          avatarSrc,
          avatarInitials: getInitials(displayName),
          avatarColor: getAvatarColor(displayName),
        });
      }

      onProgress({
        percent: Math.round(basePercent),
        line: `    wrote ${filename}.${ext} (${messages.length} messages)`,
      });
    } catch (err) {
      if (err instanceof AbortError) throw err;
      const m = err instanceof Error ? err.message : String(err);
      errors.push(`Thread ${thread.threadId} (${filename}): ${m}`);
      onProgress({
        percent: Math.round(basePercent),
        line: `    FAIL: ${m}`,
      });
    }
  }

  // If exporting HTML, write the index.html now that we know every thread's filename + snippet.
  if (format === 'html') {
    const indexPath = path.join(targetDir, 'index.html');
    // Newest first in the sidebar
    indexEntries.sort((a, b) => b.date - a.date);
    fs.writeFileSync(indexPath, buildIndexHtml(indexEntries), 'utf-8');
    onProgress({ percent: 99, line: `wrote index.html (${indexEntries.length} threads)` });
  }

  const elapsedMs = Date.now() - started;
  onProgress({
    percent: 100,
    line: `Done in ${Math.round(elapsedMs / 1000)}s — ${threadsWritten} threads, ${messagesWritten} messages, ${attachmentsWritten} attachments`,
    status: '',
  });
  if (errors.length > 0) {
    onProgress({ percent: 100, line: `${errors.length} error(s) — see daemon log for details` });
    for (const e of errors) logger.warn('backup', 'Export error', { detail: e });
  }

  logger.info('backup', 'Export complete', {
    threadsWritten,
    messagesWritten,
    attachmentsWritten,
    errors: errors.length,
    elapsedMs,
  });

  return { threadsWritten, messagesWritten, attachmentsWritten, elapsedMs, errors };
}

/** Tag for abort-signal throws so callers can distinguish from other errors. */
export class AbortError extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'AbortError';
  }
}

// --- Helpers ---

function parseAddresses(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed as string[];
  } catch { /* not JSON */ }
  return [raw];
}

function buildPhoneNameMap(contacts: ContactFromPhone[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of contacts) {
    if (!c || !c.name) continue;
    const numbers = Array.isArray(c.phones) ? c.phones : [];
    for (const n of numbers) {
      if (typeof n === 'string' && n.length > 0) {
        map.set(normalizePhone(n), c.name);
      }
    }
  }
  return map;
}

function buildPhoneNameMapFromDb(db: DatabaseService): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of db.getAllContacts()) {
    if (!c.name) continue;
    const numbers = extractNumbersFromDb(c.phone_numbers);
    for (const n of numbers) {
      map.set(normalizePhone(n), c.name);
    }
  }
  return map;
}

/** DB stores phone_numbers as either a JSON array of strings, a JSON array of
 *  {number, type} objects (legacy), or a raw comma-free string. */
function extractNumbersFromDb(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return (parsed as Array<unknown>)
        .map((n) => {
          if (typeof n === 'string') return n;
          if (n && typeof n === 'object' && 'number' in n) {
            const v = (n as { number: unknown }).number;
            return typeof v === 'string' ? v : '';
          }
          return '';
        })
        .filter((n) => n.length > 0);
    }
  } catch { /* not JSON */ }
  return [raw];
}

/** Build the filename stem from the list of OTHER parties (not including
 *  the user themselves). Groups are truncated to first 2 + ", and N more" so
 *  long participant lists don't blow past platform path limits. */
function buildFilenameStem(participantNames: string[]): string {
  if (participantNames.length === 0) return '';
  if (participantNames.length === 1) return participantNames[0]!;
  if (participantNames.length === 2) return `${participantNames[0]}, ${participantNames[1]}`;
  const more = participantNames.length - 2;
  return `${participantNames[0]}, ${participantNames[1]}, and ${more} more`;
}

/** Sanitize a filename to be valid on Windows/Mac/Linux. */
function sanitizeFilename(name: string): string {
  let s = name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');
  if (s.length > 180) s = s.slice(0, 180).trim();
  return s;
}

/** Append " (2)", " (3)", etc. to disambiguate when a name collides. */
function disambiguate(base: string, used: Set<string>): string {
  const lower = base.toLowerCase();
  if (!used.has(lower)) return base;
  let i = 2;
  while (used.has(`${lower} (${i})`)) i++;
  return `${base} (${i})`;
}

function buildAttachmentFilename(date: number, partId: number, mime: string, phoneName?: string): string {
  const d = new Date(date);
  const ts = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
  const clean = phoneName && phoneName.trim().length > 0
    ? sanitizeFilename(phoneName.trim())
    : `attachment${mimeExtension(mime)}`;
  // Ensure an extension — phone-supplied names sometimes lack one.
  const hasExt = /\.[A-Za-z0-9]{1,6}$/.test(clean);
  const finalName = hasExt ? clean : `${clean}${mimeExtension(mime)}`;
  return `${ts}_part${partId}_${finalName}`;
}

function mimeExtension(mime: string): string {
  switch (mime) {
    case 'image/jpeg': case 'image/jpg': return '.jpg';
    case 'image/png': return '.png';
    case 'image/gif': return '.gif';
    case 'image/webp': return '.webp';
    case 'image/bmp': return '.bmp';
    case 'image/heic': return '.heic';
    case 'video/mp4': return '.mp4';
    case 'video/3gpp': return '.3gp';
    case 'video/webm': return '.webm';
    case 'audio/mpeg': case 'audio/mp3': return '.mp3';
    case 'audio/mp4': case 'audio/m4a': return '.m4a';
    case 'audio/amr': return '.amr';
    case 'audio/ogg': return '.ogg';
    case 'audio/wav': return '.wav';
    case 'text/vcard': return '.vcf';
    default: {
      const slash = mime.indexOf('/');
      return slash >= 0 ? `.${mime.slice(slash + 1).replace(/[^a-z0-9]/gi, '')}` : '.bin';
    }
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function buildThreadText(
  messages: MessageFromPhone[],
  participantNames: string[],
  phoneToName: Map<string, string>,
  attachmentTargetNames: Map<string, string>,
): string {
  const out: string[] = [];
  // Header: all participants, then "You" for the user.
  const headerNames = [...participantNames, 'You'];
  out.push(`(${headerNames.join(', ')})`);
  out.push('');
  for (const m of messages) {
    const sender = m.type === 2
      ? 'Me'
      : (phoneToName.get(normalizePhone(m.address)) ?? formatPhone(m.address || ''));
    out.push(`[${sender}] (${formatTimestamp(m.date)}):`);
    if (m.attachments) {
      for (const a of m.attachments) {
        const key = `${a.part_id}:${m._id}`;
        const name = attachmentTargetNames.get(key) ?? buildAttachmentFilename(m.date, a.part_id, a.mime_type, a.filename);
        out.push(`(${name})`);
      }
    }
    if (m.body && m.body.length > 0) {
      out.push(m.body);
    }
    out.push('');
  }
  return out.join('\n');
}

/** Escape characters that are invalid in XML text nodes. Also strips
 *  control characters that aren't allowed by XML 1.0 at all (can't appear
 *  even escaped). Keeps \t \n \r. */
function xmlEscape(s: string): string {
  return s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Additional escaping for attribute values inside double quotes. */
function xmlAttrEscape(s: string): string {
  return xmlEscape(s).replace(/"/g, '&quot;');
}

function buildThreadXml(
  messages: MessageFromPhone[],
  participantNames: string[],
  phoneToName: Map<string, string>,
  attachmentTargetNames: Map<string, string>,
): string {
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push('<thread>');
  out.push('  <participants>');
  for (const name of participantNames) {
    out.push(`    <participant>${xmlEscape(name)}</participant>`);
  }
  out.push(`    <participant self="true">You</participant>`);
  out.push('  </participants>');
  out.push('  <messages>');
  for (const m of messages) {
    const sender = m.type === 2
      ? 'Me'
      : (phoneToName.get(normalizePhone(m.address)) ?? formatPhone(m.address || ''));
    const direction = m.type === 2 ? 'sent' : 'received';
    out.push(`    <message direction="${xmlAttrEscape(direction)}">`);
    out.push(`      <sender>${xmlEscape(sender)}</sender>`);
    out.push(`      <timestamp>${xmlEscape(formatTimestamp(m.date))}</timestamp>`);
    if (m.body && m.body.length > 0) {
      out.push(`      <body>${xmlEscape(m.body)}</body>`);
    }
    if (m.attachments && m.attachments.length > 0) {
      out.push('      <attachments>');
      for (const a of m.attachments) {
        const key = `${a.part_id}:${m._id}`;
        const fname = attachmentTargetNames.get(key) ?? buildAttachmentFilename(m.date, a.part_id, a.mime_type, a.filename);
        out.push(`        <attachment mime="${xmlAttrEscape(a.mime_type)}">${xmlEscape(fname)}</attachment>`);
      }
      out.push('      </attachments>');
    }
    out.push('    </message>');
  }
  out.push('  </messages>');
  out.push('</thread>');
  return out.join('\n') + '\n';
}

// --- HTML builders ---

/** Shared CSS for the per-thread page AND the index page. Inlined into every
 *  HTML file so the export is self-contained. Mirrors the app's dark theme. */
const HTML_THEME_CSS = `
:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-surface: #1e2746;
  --bg-hover: #263054;
  --bg-selected: #2a3a5c;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0b0;
  --text-muted: #6a6a7a;
  --accent-primary: #5b8def;
  --bubble-received: #2a2a3e;
  --bubble-sent: #3a5ba0;
  --bubble-sent-text: #e0e0e0;
  --border: #2a2a3e;
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg-primary); color: var(--text-primary); font-family: var(--font-family); font-size: 14px; }
a { color: var(--accent-primary); }
`.trim();

const HTML_THREAD_CSS = `
body { padding: 16px 24px; line-height: 1.4; }
.participants { color: var(--text-secondary); font-size: 0.85em; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.timestamp { text-align: center; color: var(--text-muted); font-size: 0.75rem; margin: 20px 0 10px; }
.bubble-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 4px; }
.bubble-row.sent { justify-content: flex-end; }
.bubble-row.received { justify-content: flex-start; }
.avatar { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; background: var(--bg-surface); }
.bubble { max-width: 65%; padding: 8px 12px; border-radius: 12px; word-wrap: break-word; overflow-wrap: break-word; }
.bubble.received { background: var(--bubble-received); border-bottom-left-radius: 4px; }
.bubble.sent { background: var(--bubble-sent); color: var(--bubble-sent-text); border-bottom-right-radius: 4px; }
.bubble .sender-label { display: block; font-size: 0.72rem; color: var(--text-secondary); opacity: 0.8; margin-bottom: 2px; font-weight: 500; }
.bubble .body { margin: 0; white-space: pre-wrap; }
.bubble .attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.bubble .attachments a { line-height: 0; }
.bubble .attachments img { max-width: 240px; max-height: 240px; border-radius: 6px; display: block; }
.bubble .attachments .file { display: inline-block; padding: 6px 10px; background: rgba(0,0,0,0.15); border-radius: 6px; font-size: 0.82rem; color: var(--text-primary); text-decoration: none; }
`.trim();

const HTML_INDEX_CSS = `
body { width: 100vw; height: 100vh; overflow: hidden; display: flex; }
.sidebar { width: 320px; flex-shrink: 0; background: var(--bg-secondary); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
.sidebar h1 { margin: 0; padding: 16px 20px 12px; font-size: 1rem; font-weight: 600; }
.filter-wrap { padding: 0 16px 12px; border-bottom: 1px solid var(--border); }
.filter-input { width: 100%; padding: 8px 10px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: 6px; font-family: inherit; font-size: 0.85rem; outline: none; }
.filter-input:focus { border-color: var(--accent-primary); }
.filter-input::placeholder { color: var(--text-muted); }
.thread-list { flex: 1; overflow-y: auto; list-style: none; padding: 0; margin: 0; }
.thread-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); text-decoration: none; color: var(--text-primary); cursor: pointer; }
.thread-item:hover { background: var(--bg-hover); }
.thread-item.active { background: var(--bg-selected); }
.thread-item.hidden { display: none; }
.thread-item .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.95rem; color: #fff; overflow: hidden; background: var(--bg-surface); }
.thread-item .avatar img { width: 100%; height: 100%; object-fit: cover; }
.thread-item .body { flex: 1; min-width: 0; }
.thread-item .name { font-weight: 500; display: block; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.thread-item .snippet { color: var(--text-muted); font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.thread-item .date { color: var(--text-muted); font-size: 0.72rem; margin-top: 4px; display: block; }
.main { flex: 1; min-width: 0; display: flex; background: var(--bg-primary); }
.main iframe { flex: 1; border: none; width: 100%; height: 100%; background: var(--bg-primary); }
.empty { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.9rem; }
.empty-filter { padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.85rem; display: none; }
`.trim();

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mimeIsImage(mime: string): boolean {
  return mime.startsWith('image/');
}

function buildThreadHtml(args: {
  messages: MessageFromPhone[];
  participantNames: string[];
  phoneToName: Map<string, string>;
  attachmentTargetNames: Map<string, string>;
  contactPhotoMap: Map<string, string>;
  normalizedParticipantPhones: string[];
}): string {
  const { messages, participantNames, phoneToName, attachmentTargetNames, contactPhotoMap } = args;
  const headerNames = [...participantNames, 'You'];

  const lines: string[] = [];
  lines.push('<!DOCTYPE html>');
  lines.push('<html lang="en"><head>');
  lines.push('<meta charset="utf-8">');
  lines.push(`<title>${htmlEscape(buildFilenameStem(participantNames) || 'Thread')}</title>`);
  lines.push('<style>');
  lines.push(HTML_THEME_CSS);
  lines.push(HTML_THREAD_CSS);
  lines.push('</style>');
  lines.push('</head><body>');
  lines.push(`<div class="participants">${headerNames.map(htmlEscape).join(', ')}</div>`);

  let lastTimestampDate = 0;
  const TIMESTAMP_GAP_MS = 15 * 60_000;

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    const prev = i > 0 ? messages[i - 1]! : null;
    const dayChange = prev === null || !sameDay(prev.date, m.date);
    const gap = m.date - lastTimestampDate;
    const showTimestamp = dayChange || gap >= TIMESTAMP_GAP_MS;
    if (showTimestamp) {
      lastTimestampDate = m.date;
      const label = dayChange
        ? `${formatDateHeader(m.date)}, ${formatTimeOfDay(m.date)}`
        : formatTimeOfDay(m.date);
      lines.push(`<div class="timestamp">${htmlEscape(label)}</div>`);
    }

    const isSent = m.type === 2;
    const sender = isSent ? 'Me' : (phoneToName.get(normalizePhone(m.address)) ?? formatPhone(m.address || ''));
    const rowClass = isSent ? 'sent' : 'received';
    const avatarFile = isSent ? null : (contactPhotoMap.get(normalizePhone(m.address)) ?? null);
    const isGroup = participantNames.length > 1;

    lines.push(`<div class="bubble-row ${rowClass}">`);
    if (!isSent && avatarFile) {
      lines.push(`  <img class="avatar" src="${htmlEscape(encodeURI(avatarFile))}" alt="">`);
    } else if (!isSent) {
      // Reserve space for alignment even without photo
      lines.push(`  <div class="avatar"></div>`);
    }
    lines.push(`  <div class="bubble ${rowClass}">`);
    if (!isSent && isGroup) {
      lines.push(`    <span class="sender-label">${htmlEscape(sender)}</span>`);
    }
    if (m.attachments && m.attachments.length > 0) {
      lines.push(`    <div class="attachments">`);
      for (const a of m.attachments) {
        const key = `${a.part_id}:${m._id}`;
        const fname = attachmentTargetNames.get(key) ?? buildAttachmentFilename(m.date, a.part_id, a.mime_type, a.filename);
        const href = encodeURI(fname);
        if (mimeIsImage(a.mime_type)) {
          lines.push(`      <a href="${htmlEscape(href)}" target="_blank"><img src="${htmlEscape(href)}" alt=""></a>`);
        } else if (a.mime_type.startsWith('video/')) {
          lines.push(`      <a class="file" href="${htmlEscape(href)}" target="_blank">\u25B6 ${htmlEscape(fname)}</a>`);
        } else {
          lines.push(`      <a class="file" href="${htmlEscape(href)}" target="_blank">${htmlEscape(fname)}</a>`);
        }
      }
      lines.push(`    </div>`);
    }
    if (m.body && m.body.length > 0) {
      lines.push(`    <p class="body">${htmlEscape(m.body)}</p>`);
    }
    lines.push(`  </div>`);
    lines.push(`</div>`);
  }

  lines.push('</body></html>');
  return lines.join('\n');
}

function buildIndexHtml(entries: Array<{
  filename: string;
  displayName: string;
  snippet: string;
  date: number;
  avatarSrc: string | null;
  avatarInitials: string;
  avatarColor: string;
}>): string {
  const lines: string[] = [];
  lines.push('<!DOCTYPE html>');
  lines.push('<html lang="en"><head>');
  lines.push('<meta charset="utf-8">');
  lines.push('<title>Message Backup</title>');
  lines.push('<style>');
  lines.push(HTML_THEME_CSS);
  lines.push(HTML_INDEX_CSS);
  lines.push('</style>');
  lines.push('</head><body>');
  lines.push('<aside class="sidebar">');
  lines.push('<h1>Threads</h1>');
  lines.push('<div class="filter-wrap">');
  lines.push('  <input id="filter-input" class="filter-input" type="search" placeholder="Filter threads" autocomplete="off">');
  lines.push('</div>');
  lines.push('<ul class="thread-list" id="thread-list">');
  for (const e of entries) {
    const href = encodeRelativePath(`${e.filename}/${e.filename}.html`);
    const dateLabel = e.date > 0 ? formatDateHeader(e.date) : '';
    const avatarHtml = e.avatarSrc
      ? `<div class="avatar"><img src="${htmlEscape(encodeRelativePath(e.avatarSrc))}" alt=""></div>`
      : `<div class="avatar" style="background:${htmlEscape(e.avatarColor)}">${htmlEscape(e.avatarInitials)}</div>`;
    // Lowercase haystack for filter matching
    const search = `${e.displayName} ${e.snippet}`.toLowerCase();
    lines.push('<li>');
    lines.push(`  <a class="thread-item" href="#" data-src="${htmlEscape(href)}" data-search="${htmlEscape(search)}">`);
    lines.push(`    ${avatarHtml}`);
    lines.push(`    <div class="body">`);
    lines.push(`      <span class="name">${htmlEscape(e.displayName)}</span>`);
    if (e.snippet) lines.push(`      <span class="snippet">${htmlEscape(e.snippet)}</span>`);
    if (dateLabel) lines.push(`      <span class="date">${htmlEscape(dateLabel)}</span>`);
    lines.push(`    </div>`);
    lines.push(`  </a>`);
    lines.push('</li>');
  }
  lines.push('</ul>');
  lines.push('<div class="empty-filter" id="empty-filter">No threads match.</div>');
  lines.push('</aside>');
  lines.push('<main class="main">');
  lines.push('  <div class="empty" id="empty-state">Select a thread to view it here.</div>');
  lines.push('  <iframe id="thread-frame" style="display:none" title="Thread"></iframe>');
  lines.push('</main>');
  lines.push('<script>');
  lines.push(`(function () {
  var empty = document.getElementById('empty-state');
  var frame = document.getElementById('thread-frame');
  var items = document.querySelectorAll('.thread-item');
  var filterInput = document.getElementById('filter-input');
  var emptyFilter = document.getElementById('empty-filter');

  items.forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      items.forEach(function (x) { x.classList.remove('active'); });
      el.classList.add('active');
      if (empty) empty.style.display = 'none';
      frame.style.display = '';
      frame.src = el.dataset.src;
    });
  });

  function applyFilter() {
    var q = filterInput.value.trim().toLowerCase();
    var visibleCount = 0;
    items.forEach(function (el) {
      var hay = el.dataset.search || '';
      if (!q || hay.indexOf(q) !== -1) {
        el.classList.remove('hidden');
        visibleCount++;
      } else {
        el.classList.add('hidden');
      }
    });
    emptyFilter.style.display = (visibleCount === 0) ? 'block' : 'none';
  }
  filterInput.addEventListener('input', applyFilter);
})();`);
  lines.push('</script>');
  lines.push('</body></html>');
  return lines.join('\n');
}

/** Percent-encode each path segment but keep the forward slashes so the
 *  result is a valid relative URL (e.g. "Alice/contact-Alice.jpg"). */
function encodeRelativePath(relPath: string): string {
  return relPath.split('/').map((seg) => encodeURIComponent(seg)).join('/');
}

const AVATAR_COLORS = [
  '#e57373', '#f06292', '#ba68c8', '#9575cd',
  '#7986cb', '#64b5f6', '#4fc3f7', '#4dd0e1',
  '#4db6ac', '#81c784', '#aed581', '#dce775',
  '#fff176', '#ffd54f', '#ffb74d', '#ff8a65',
] as const;

/** First + last initial (max 2 chars), upper-cased. Mirrors the renderer helper. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return '#';
  if (parts.length === 1) return parts[0]![0]!.toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Deterministic color from a string. */
function getAvatarColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

// --- Contact photo + date helpers ---

function contactPhotoExt(mime: string | null, photoPath: string): string {
  if (mime) {
    const ext = mimeExtension(mime);
    if (ext !== '.bin') return ext;
  }
  const fromPath = path.extname(photoPath);
  return fromPath || '.jpg';
}

function buildPhoneContactMapFromDb(db: DatabaseService): Map<string, ContactRow> {
  const map = new Map<string, ContactRow>();
  for (const c of db.getAllContacts()) {
    const numbers = extractNumbersFromDb(c.phone_numbers);
    for (const n of numbers) {
      map.set(normalizePhone(n), c);
    }
  }
  return map;
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

function formatDateHeader(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - messageDay.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function wasAttachmentCached(db: DatabaseService, partId: number, messageId: number): boolean {
  const att = db.getAttachment(partId, messageId);
  if (!att) return false;
  if (!att.downloaded || !att.local_path) return false;
  try {
    return fs.existsSync(att.local_path);
  } catch {
    return false;
  }
}
