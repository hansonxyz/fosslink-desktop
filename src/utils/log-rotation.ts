/**
 * Log rotation utilities
 *
 * Produces date-stamped log filenames, deletes files older than the retention
 * window, and schedules periodic cleanup + midnight rollover.
 *
 * Filename convention: given basePath "/path/to/daemon.log", writes
 * "/path/to/daemon.2026-04-22.log". Old files matching the same stem that
 * encode a date older than the retention cutoff are deleted.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** How many days of logs to keep (startup + hourly cleanup). */
export const LOG_RETENTION_DAYS = 7;

/** Format date as YYYY-MM-DD in local time. */
function dateStamp(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Convert a base path like "/path/daemon.log" to "/path/daemon.YYYY-MM-DD.log". */
export function dateStampedPath(basePath: string, date: Date = new Date()): string {
  const dir = path.dirname(basePath);
  const ext = path.extname(basePath);
  const name = path.basename(basePath, ext);
  return path.join(dir, `${name}.${dateStamp(date)}${ext}`);
}

/** Delete log files matching basePath's stem + date pattern older than cutoff.
 *  Returns the number of files deleted. */
export function cleanupOldLogs(basePath: string, retentionDays = LOG_RETENTION_DAYS): number {
  const dir = path.dirname(basePath);
  const ext = path.extname(basePath);
  const name = path.basename(basePath, ext);
  if (!fs.existsSync(dir)) return 0;

  const prefix = `${name}.`;
  const cutoffMs = Date.now() - retentionDays * 86_400_000;
  let deleted = 0;

  for (const entry of fs.readdirSync(dir)) {
    if (!entry.startsWith(prefix) || !entry.endsWith(ext)) continue;
    const middle = entry.slice(prefix.length, entry.length - ext.length);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(middle);
    if (!match) continue;
    const y = Number(match[1]);
    const mo = Number(match[2]) - 1;
    const d = Number(match[3]);
    const fileTime = new Date(y, mo, d).getTime();
    if (Number.isNaN(fileTime) || fileTime >= cutoffMs) continue;
    try {
      fs.unlinkSync(path.join(dir, entry));
      deleted++;
    } catch { /* ignore */ }
  }
  return deleted;
}

/** Milliseconds until the next local-time midnight. */
export function msUntilMidnight(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/**
 * Schedule midnight rollover and hourly cleanup. Returns a dispose function.
 *
 * - `onMidnight` is called at local-time midnight (schedules itself for the
 *   next midnight after firing).
 * - `onHourly` runs every hour and should invoke `cleanupOldLogs`.
 */
export function scheduleLogRotation(
  onMidnight: () => void,
  onHourly: () => void,
): () => void {
  let midnightTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleNextMidnight = (): void => {
    midnightTimer = setTimeout(() => {
      try { onMidnight(); } catch { /* ignore */ }
      scheduleNextMidnight();
    }, msUntilMidnight() + 1_000); // +1s safety margin across the boundary
  };
  scheduleNextMidnight();

  const hourlyTimer = setInterval(() => {
    try { onHourly(); } catch { /* ignore */ }
  }, 60 * 60_000);

  return () => {
    if (midnightTimer) clearTimeout(midnightTimer);
    clearInterval(hourlyTimer);
  };
}
