/**
 * Link Preview Fetcher
 *
 * Fetches Open Graph metadata from URLs using Electron's net.fetch.
 * Downloads OG images locally for offline/cached display.
 */

import { net } from 'electron'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  getCachedPreview,
  setCachedPreview,
  getImageDir,
  type LinkPreview,
} from './link-preview-cache'
import { log } from './logger'

// Limit concurrent fetches
let activeFetches = 0
const MAX_CONCURRENT = 3
const pendingQueue: Array<{ url: string; resolve: (v: LinkPreview) => void }> = []

// Media file extensions — no point fetching OG from these
const MEDIA_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
  '.mp4', '.webm', '.avi', '.mov', '.mkv',
  '.mp3', '.m4a', '.ogg', '.wav', '.flac',
  '.pdf', '.zip', '.tar', '.gz',
])

function isPrivateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.16.') ||
      host.endsWith('.local')
    )
  } catch {
    return true
  }
}

function isMediaUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return MEDIA_EXTENSIONS.has(pathname.slice(pathname.lastIndexOf('.')))
  } catch {
    return false
  }
}

function extractOgTags(html: string): {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
} {
  // Only look at <head> to avoid false matches in body content
  const headEnd = html.indexOf('</head>')
  const head = headEnd > 0 ? html.slice(0, headEnd) : html.slice(0, 20000)

  const result = { title: null as string | null, description: null as string | null, image: null as string | null, siteName: null as string | null }

  // Match og: and twitter: meta tags (both attribute orders)
  const metaRegex = /<meta\s+[^>]*?(?:(?:property|name)\s*=\s*["']([^"']+)["'][^>]*?content\s*=\s*["']([^"']*?)["']|content\s*=\s*["']([^"']*?)["'][^>]*?(?:property|name)\s*=\s*["']([^"']+)["'])[^>]*?\/?>/gi

  let match: RegExpExecArray | null
  while ((match = metaRegex.exec(head)) !== null) {
    const prop = (match[1] || match[4] || '').toLowerCase()
    const content = match[2] ?? match[3] ?? ''

    if (prop === 'og:title' && !result.title) result.title = content
    else if (prop === 'og:description' && !result.description) result.description = content
    else if (prop === 'og:image' && !result.image) result.image = content
    else if (prop === 'og:site_name' && !result.siteName) result.siteName = content
    else if (prop === 'twitter:title' && !result.title) result.title = content
    else if (prop === 'twitter:description' && !result.description) result.description = content
    else if (prop === 'twitter:image' && !result.image) result.image = content
  }

  // Fallback: extract <title> if no og:title
  if (!result.title) {
    const titleMatch = head.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) result.title = titleMatch[1].trim()
  }

  return result
}

function urlHash(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

async function downloadImage(imageUrl: string, sourceUrl: string): Promise<string | null> {
  try {
    const dir = getImageDir()
    if (!dir) return null

    // Determine extension from URL
    let ext = '.jpg'
    try {
      const pathname = new URL(imageUrl).pathname.toLowerCase()
      const dotIdx = pathname.lastIndexOf('.')
      if (dotIdx > 0) {
        const urlExt = pathname.slice(dotIdx)
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(urlExt)) {
          ext = urlExt
        }
      }
    } catch { /* use default */ }

    const fileName = `${urlHash(sourceUrl)}${ext}`
    const localPath = join(dir, fileName)

    // Skip if already downloaded
    if (existsSync(localPath)) return localPath

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const response = await net.fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    clearTimeout(timeout)

    if (!response.ok || !response.body) return null

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length > 500 * 1024) return null // Skip images > 500KB

    await writeFile(localPath, buffer)
    return localPath
  } catch {
    return null
  }
}

async function doFetch(url: string): Promise<LinkPreview> {
  // Check cache first
  const cached = getCachedPreview(url)
  if (cached) return cached

  // Validate URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return makeError(url)
  }
  if (isPrivateUrl(url) || isMediaUrl(url)) {
    return makeError(url)
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const response = await net.fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const result = makeError(url)
      setCachedPreview(result)
      return result
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      const result: LinkPreview = { url, title: null, description: null, imageUrl: null, imageLocalPath: null, siteName: null, status: 'no-og', fetchedAt: Date.now() }
      setCachedPreview(result)
      return result
    }

    // Read first 50KB only
    const reader = response.body?.getReader()
    if (!reader) return makeError(url)

    let html = ''
    const decoder = new TextDecoder()
    let totalBytes = 0
    const MAX_BYTES = 50 * 1024

    while (totalBytes < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
      totalBytes += value.byteLength
    }
    reader.cancel().catch(() => {})

    const og = extractOgTags(html)

    if (!og.title && !og.description && !og.image) {
      const result: LinkPreview = { url, title: null, description: null, imageUrl: null, imageLocalPath: null, siteName: null, status: 'no-og', fetchedAt: Date.now() }
      setCachedPreview(result)
      return result
    }

    // Download OG image if present
    let imageLocalPath: string | null = null
    if (og.image) {
      // Resolve relative image URLs
      let absoluteImageUrl = og.image
      if (og.image.startsWith('//')) {
        absoluteImageUrl = 'https:' + og.image
      } else if (og.image.startsWith('/')) {
        try {
          const base = new URL(url)
          absoluteImageUrl = `${base.protocol}//${base.host}${og.image}`
        } catch { /* use as-is */ }
      }
      imageLocalPath = await downloadImage(absoluteImageUrl, url)
    }

    const result: LinkPreview = {
      url,
      title: og.title ? decodeEntities(og.title) : null,
      description: og.description ? decodeEntities(og.description) : null,
      imageUrl: og.image,
      imageLocalPath,
      siteName: og.siteName ? decodeEntities(og.siteName) : null,
      status: 'ok',
      fetchedAt: Date.now(),
    }

    setCachedPreview(result)
    log('link-preview', 'Fetched preview', { url, title: result.title ?? '(none)' })
    return result
  } catch (err) {
    log('link-preview', 'Fetch failed', { url, error: err instanceof Error ? err.message : String(err) })
    const result = makeError(url)
    setCachedPreview(result)
    return result
  }
}

function makeError(url: string): LinkPreview {
  return { url, title: null, description: null, imageUrl: null, imageLocalPath: null, siteName: null, status: 'error', fetchedAt: Date.now() }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
}

function processQueue(): void {
  while (activeFetches < MAX_CONCURRENT && pendingQueue.length > 0) {
    const item = pendingQueue.shift()!
    activeFetches++
    doFetch(item.url)
      .then(item.resolve)
      .catch(() => item.resolve(makeError(item.url)))
      .finally(() => {
        activeFetches--
        processQueue()
      })
  }
}

export async function fetchLinkPreview(url: string): Promise<LinkPreview> {
  // Check cache synchronously first
  const cached = getCachedPreview(url)
  if (cached) return cached

  if (activeFetches < MAX_CONCURRENT) {
    activeFetches++
    try {
      return await doFetch(url)
    } finally {
      activeFetches--
      processQueue()
    }
  }

  // Queue the request
  return new Promise((resolve) => {
    pendingQueue.push({ url, resolve })
  })
}
