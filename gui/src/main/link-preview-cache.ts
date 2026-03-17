/**
 * Link Preview Cache
 *
 * SQLite-backed cache for Open Graph metadata fetched from URLs.
 * Lives in Electron's userData directory, separate from the daemon DB.
 */

import Database from 'better-sqlite3'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

export interface LinkPreview {
  url: string
  title: string | null
  description: string | null
  imageUrl: string | null
  imageLocalPath: string | null
  siteName: string | null
  status: 'ok' | 'error' | 'no-og'
  fetchedAt: number
}

let db: Database.Database | null = null
let imageDir: string = ''

const OK_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days
const ERROR_TTL = 60 * 60 * 1000 // 1 hour

export function getImageDir(): string {
  return imageDir
}

export function initLinkPreviewCache(userDataPath: string): void {
  imageDir = join(userDataPath, 'link-preview-images')
  mkdirSync(imageDir, { recursive: true })

  const dbPath = join(userDataPath, 'link-preview-cache.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS link_previews (
      url TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      image_url TEXT,
      image_local_path TEXT,
      site_name TEXT,
      fetched_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ok'
    )
  `)
}

export function getCachedPreview(url: string): LinkPreview | null {
  if (!db) return null

  const row = db.prepare(
    'SELECT url, title, description, image_url, image_local_path, site_name, fetched_at, status FROM link_previews WHERE url = ?',
  ).get(url) as {
    url: string
    title: string | null
    description: string | null
    image_url: string | null
    image_local_path: string | null
    site_name: string | null
    fetched_at: number
    status: string
  } | undefined

  if (!row) return null

  const age = Date.now() - row.fetched_at
  const ttl = row.status === 'ok' || row.status === 'no-og' ? OK_TTL : ERROR_TTL
  if (age > ttl) return null

  return {
    url: row.url,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    imageLocalPath: row.image_local_path,
    siteName: row.site_name,
    status: row.status as LinkPreview['status'],
    fetchedAt: row.fetched_at,
  }
}

export function setCachedPreview(preview: LinkPreview): void {
  if (!db) return

  db.prepare(`
    INSERT OR REPLACE INTO link_previews (url, title, description, image_url, image_local_path, site_name, fetched_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    preview.url,
    preview.title,
    preview.description,
    preview.imageUrl,
    preview.imageLocalPath,
    preview.siteName,
    preview.fetchedAt,
    preview.status,
  )
}

export function closeLinkPreviewCache(): void {
  if (db) {
    db.close()
    db = null
  }
}
