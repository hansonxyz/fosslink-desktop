/**
 * Gallery Store
 *
 * Manages phone gallery state: scanning, thumbnail loading, file downloads,
 * view modes, and folder navigation.
 */

export interface GalleryItem {
  path: string
  filename: string
  folder: string
  mtime: number
  size: number
  mimeType: string
  isHidden: boolean
  kind: 'image' | 'video'
}

type ScanState = 'idle' | 'scanning' | 'ready' | 'error'
type ThumbnailState = 'idle' | 'loading' | 'ready' | 'failed'
type DownloadState = 'idle' | 'downloading' | 'ready'
export type ViewMode = 'dcim' | 'screenshots' | 'folders' | 'all' | 'thread_media'
export type SizeMode = 'thumbnail' | 'mosaic'

interface DownloadEntry {
  state: DownloadState
  progress: number
}

let items: GalleryItem[] = $state([])
let scanState: ScanState = $state('idle')
let scanError: string = $state('')
let viewMode: ViewMode = $state('dcim')
/** Thread ID for thread_media mode */
let threadMediaId: number | null = $state(null)
let threadMediaName: string = $state('')
let sizeMode: SizeMode = $state('thumbnail')
let hideHidden: boolean = $state(true)
let selectedFolder: string | null = $state(null)
const thumbnailStates: Record<string, ThumbnailState> = $state({})
const downloadStates: Record<string, DownloadEntry> = $state({})

// In-flight download promises (deduplication) and abort controllers
const downloadPromises = new Map<string, Promise<string>>()
const downloadAbortControllers = new Map<string, AbortController>()

/** Max concurrent thumbnail fetches to avoid overwhelming the connection */
const MAX_CONCURRENT_THUMBS = 5
let activeThumbRequests = 0
const thumbQueue: string[] = []


export const gallery = {
  get items(): GalleryItem[] { return items },
  get scanState(): ScanState { return scanState },
  get scanError(): string { return scanError },
  get viewMode(): ViewMode { return viewMode },
  set viewMode(v: ViewMode) {
    const changed = viewMode !== v
    viewMode = v
    selectedFolder = null
    threadMediaId = null
    threadMediaName = ''
    // Trigger a new scoped scan when switching views
    if (changed && v !== 'thread_media') void scanGallery()
  },
  get threadMediaId(): number | null { return threadMediaId },
  get threadMediaName(): string { return threadMediaName },
  get sizeMode(): SizeMode { return sizeMode },
  set sizeMode(v: SizeMode) { sizeMode = v },
  get hideHidden(): boolean { return hideHidden },
  set hideHidden(v: boolean) { hideHidden = v },
  get selectedFolder(): string | null { return selectedFolder },
  set selectedFolder(v: string | null) { selectedFolder = v },
}

/** Unique folder names derived from scanned items */
export function getFolders(): Array<{ name: string; count: number }> {
  const map = new Map<string, number>()
  for (const item of items) {
    if (hideHidden && item.isHidden) continue
    map.set(item.folder, (map.get(item.folder) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Get filtered items based on current view mode and settings */
export function getFilteredItems(): GalleryItem[] {
  // Thread media mode — items are already filtered to the thread
  if (viewMode === 'thread_media') return items

  let result = items
  if (hideHidden) {
    result = result.filter((i) => !i.isHidden)
  }
  if (viewMode === 'dcim') {
    result = result.filter((i) => i.folder.startsWith('DCIM'))
  } else if (viewMode === 'screenshots') {
    result = result.filter((i) => i.folder.includes('Screenshots'))
  } else if (viewMode === 'folders' && selectedFolder) {
    result = result.filter((i) => i.folder === selectedFolder)
  }
  return result
}

/** Load media items for a specific message thread. */
export async function loadThreadMedia(id: number, name: string): Promise<void> {
  threadMediaId = id
  threadMediaName = name
  viewMode = 'thread_media'
  scanState = 'scanning'
  scanError = ''
  items = []

  try {
    const result = (await window.api.invoke('threads.media', { threadId: id })) as {
      items: Array<{
        partId: number
        messageId: number
        mimeType: string
        filename: string
        date: number
        kind: 'image' | 'video'
      }>
    }

    // Convert thread media items to GalleryItem format
    // Use mms://{partId}/{messageId} as the path key
    items = (result.items ?? []).map(m => ({
      path: `mms://${m.partId}/${m.messageId}`,
      filename: m.filename || `${m.kind}_${m.partId}`,
      folder: `Thread ${id}`,
      mtime: Math.floor(m.date / 1000),
      size: 0,
      mimeType: m.mimeType,
      isHidden: false,
      kind: m.kind,
      // Store part/message IDs for attachment-based thumbnail/download
      _partId: m.partId,
      _messageId: m.messageId,
    } as GalleryItem))

    scanState = 'ready'
  } catch (err) {
    scanError = err instanceof Error ? err.message : String(err)
    scanState = 'error'
  }
}

/** Exit thread media mode and return to DCIM gallery view. */
export function exitThreadMedia(): void {
  if (viewMode !== 'thread_media') return
  threadMediaId = null
  threadMediaName = ''
  viewMode = 'dcim'
  items = []
  scanState = 'idle'
  // Trigger a fresh DCIM scan
  void scanGallery()
}

/** Get all items grouped by folder (for inline folder view) */
export function getItemsByFolder(): Array<{ folder: string; items: GalleryItem[] }> {
  const map = new Map<string, GalleryItem[]>()
  for (const item of items) {
    if (hideHidden && item.isHidden) continue
    let list = map.get(item.folder)
    if (!list) {
      list = []
      map.set(item.folder, list)
    }
    list.push(item)
  }
  return Array.from(map.entries())
    .map(([folder, folderItems]) => ({ folder, items: folderItems }))
    .sort((a, b) => a.folder.localeCompare(b.folder))
}

/** Track all paths from the current scan for delete detection */
let scanAllPaths: Set<string> | null = null

/** Map view mode to scan scope */
function viewModeToScope(mode: ViewMode): string {
  switch (mode) {
    case 'dcim': return 'dcim'
    case 'screenshots': return 'screenshots'
    default: return 'all'
  }
}

/** Scan the phone gallery — items arrive progressively via batches */
export async function scanGallery(): Promise<void> {
  const scope = viewModeToScope(viewMode)
  scanState = 'scanning'
  scanError = ''
  // Clear stale states on fresh scan (unpair/resync)
  if (items.length === 0) {
    for (const k of Object.keys(thumbnailStates)) delete thumbnailStates[k]
    for (const k of Object.keys(downloadStates)) delete downloadStates[k]
    thumbQueue.length = 0
    activeThumbRequests = 0
  }
  scanAllPaths = new Set()

  try {
    await window.api.invoke('gallery.scan', { scope })
    // Batches were processed via handleGalleryScanBatch during the await.
    // Now remove any items that weren't in the scan results (deleted on phone).
    if (scanAllPaths && scanAllPaths.size > 0) {
      const before = items.length
      items = items.filter(i => scanAllPaths!.has(i.path))
      const removed = before - items.length
      if (removed > 0) {
        // Clean up thumbnail states for removed items
        for (const k of Object.keys(thumbnailStates)) {
          if (!scanAllPaths!.has(k)) delete thumbnailStates[k]
        }
      }
    }
    scanAllPaths = null
    scanState = 'ready'
  } catch (err) {
    scanAllPaths = null
    scanError = err instanceof Error ? err.message : String(err)
    scanState = 'error'
  }
}

/** Handle a streaming batch of gallery items from the phone */
export function handleGalleryScanBatch(batchItems: GalleryItem[]): void {
  // Track all paths for delete detection at end of scan
  if (scanAllPaths) {
    for (const item of batchItems) {
      scanAllPaths.add(item.path)
    }
  }

  if (items.length === 0) {
    // First batch — just set the items
    items = batchItems
  } else {
    // Merge: add new items in correct position (items are sorted newest-first)
    const existingPaths = new Set(items.map(i => i.path))
    const newItems = batchItems.filter(i => !existingPaths.has(i.path))
    if (newItems.length > 0) {
      // Insert new items maintaining sort order (newest first by mtime)
      const merged = [...items, ...newItems]
      merged.sort((a, b) => b.mtime - a.mtime)
      items = merged
    }
  }

  // Mark as ready as soon as first batch arrives
  if (scanState === 'scanning') {
    scanState = 'ready'
  }
}

/** Get thumbnail state for a gallery item */
export function getThumbnailState(path: string): ThumbnailState {
  return thumbnailStates[path] ?? 'idle'
}

/** Parse mms:// path into partId and messageId */
function parseMmsPath(path: string): { partId: number; messageId: number } | null {
  if (!path.startsWith('mms://')) return null
  const parts = path.slice(6).split('/')
  if (parts.length !== 2) return null
  return { partId: parseInt(parts[0]!, 10), messageId: parseInt(parts[1]!, 10) }
}

/** Build the thumbnail URL for a gallery item (only valid when state is 'ready') */
export function getGalleryThumbnailUrl(filePath: string): string {
  const mms = parseMmsPath(filePath)
  if (mms) {
    // Use the MMS thumbnail protocol (small cached thumbnails)
    return `xyzattachment://thumb/${mms.partId}/${mms.messageId}`
  }
  return `xyzattachment://gallery-thumb/${encodeURIComponent(filePath)}`
}

/** Build the full file URL for a gallery item */
export function getGalleryFileUrl(filePath: string): string {
  const mms = parseMmsPath(filePath)
  if (mms) {
    // Use the full MMS attachment file
    return `xyzattachment://file/${mms.partId}/${mms.messageId}`
  }
  return `xyzattachment://gallery-file/${encodeURIComponent(filePath)}`
}

/** Request a thumbnail for a gallery item (lazy, deduplicated) */
export function requestThumbnail(filePath: string): void {
  const current = thumbnailStates[filePath]
  if (current === 'loading' || current === 'ready' || current === 'failed') return

  // MMS attachments — thumbnails were saved to disk by the threads.media IPC handler.
  // The xyzattachment://thumb/ protocol serves them directly.
  const mms = parseMmsPath(filePath)
  if (mms) {
    // Mark as ready immediately — the thumbnail was saved when threads.media loaded
    thumbnailStates[filePath] = 'ready'
    return
  }

  if (activeThumbRequests >= MAX_CONCURRENT_THUMBS) {
    // Queue it — will be processed when a slot opens
    if (!thumbQueue.includes(filePath)) {
      thumbQueue.push(filePath)
    }
    return
  }

  fetchThumbnail(filePath)
}

function fetchThumbnail(filePath: string): void {
  activeThumbRequests++
  thumbnailStates[filePath] = 'loading'

  void window.api
    .invoke('gallery.thumbnail', { path: filePath })
    .then((result) => {
      const r = result as { localPath: string; failed: boolean }
      thumbnailStates[filePath] = r.failed ? 'failed' : 'ready'
    })
    .catch(() => {
      thumbnailStates[filePath] = 'failed'
    })
    .finally(() => {
      activeThumbRequests--
      drainThumbQueue()
    })
}

function drainThumbQueue(): void {
  while (thumbQueue.length > 0 && activeThumbRequests < MAX_CONCURRENT_THUMBS) {
    const next = thumbQueue.shift()!
    // Skip if already loaded while queued
    const state = thumbnailStates[next]
    if (state === 'loading' || state === 'ready' || state === 'failed') {
      continue
    }
    fetchThumbnail(next)
  }
}

/** Get download state for a gallery item */
export function getDownloadState(filePath: string): DownloadEntry {
  return downloadStates[filePath] ?? { state: 'idle', progress: 0 }
}

/** Request full file download (for video playback or save) */
export async function requestFullFile(filePath: string, expectedSize: number = 0): Promise<string> {
  const current = downloadStates[filePath]
  if (current?.state === 'ready') {
    return getGalleryFileUrl(filePath)
  }

  // MMS attachments — download via attachment system
  const mms = parseMmsPath(filePath)
  if (mms) {
    const existing = downloadPromises.get(filePath)
    if (existing) return existing

    downloadStates[filePath] = { state: 'downloading', progress: 0 }
    const promise = window.api.invoke('sms.get_attachment', {
      partId: mms.partId,
      messageId: mms.messageId,
    }).then(() => {
      downloadStates[filePath] = { state: 'ready', progress: 100 }
      downloadPromises.delete(filePath)
      return getGalleryFileUrl(filePath)
    }).catch((err) => {
      downloadStates[filePath] = { state: 'idle', progress: 0 }
      downloadPromises.delete(filePath)
      throw err
    })
    downloadPromises.set(filePath, promise)
    return promise
  }

  // Deduplicate: return existing in-flight promise
  const existing = downloadPromises.get(filePath)
  if (existing) return existing

  const ac = new AbortController()
  downloadAbortControllers.set(filePath, ac)
  downloadStates[filePath] = { state: 'downloading', progress: 0 }

  const promise = (async () => {
    try {
      // Check abort before starting
      if (ac.signal.aborted) throw new Error('Download cancelled')

      const result = (await window.api.invoke('gallery.download', {
        path: filePath,
        expectedSize,
      })) as { localPath: string }

      if (ac.signal.aborted) throw new Error('Download cancelled')

      downloadStates[filePath] = { state: 'ready', progress: 100 }
      return getGalleryFileUrl(filePath)
    } catch (err) {
      if (!ac.signal.aborted) {
        downloadStates[filePath] = { state: 'idle', progress: 0 }
      }
      throw err
    } finally {
      downloadPromises.delete(filePath)
      downloadAbortControllers.delete(filePath)
    }
  })()

  downloadPromises.set(filePath, promise)
  return promise
}

/** Cancel a pending download for a file */
export function cancelDownload(filePath: string): void {
  const ac = downloadAbortControllers.get(filePath)
  if (ac) {
    ac.abort()
    downloadAbortControllers.delete(filePath)
    downloadPromises.delete(filePath)
    // Reset state only if it was downloading
    const current = downloadStates[filePath]
    if (current?.state === 'downloading') {
      downloadStates[filePath] = { state: 'idle', progress: 0 }
    }
  }
}

/** Cancel all pending downloads except the given file path */
export function cancelOtherDownloads(keepFilePath: string): void {
  for (const [path] of downloadAbortControllers) {
    if (path !== keepFilePath) {
      cancelDownload(path)
    }
  }
}

/** Notify the daemon that gallery is open (starts cache eviction) */
export function openGallery(): void {
  void window.api.invoke('gallery.open').catch(() => {})
}

/** Notify the daemon that gallery is closed (stops cache eviction) */
export function closeGallery(): void {
  void window.api.invoke('gallery.close').catch(() => {})
}

/** Subscribe to real-time gallery media events from the phone */
export function subscribeGalleryEvents(): () => void {
  const handler = (method: string, params: unknown): void => {
    if (method !== 'gallery.items_added') return
    const data = params as { items: GalleryItem[] }
    if (!Array.isArray(data.items) || data.items.length === 0) return

    // Merge new items, avoiding duplicates by path
    const existingPaths = new Set(items.map((i) => i.path))
    const newItems = data.items.filter((i) => !existingPaths.has(i.path))
    if (newItems.length > 0) {
      items = [...newItems, ...items] // newest first
    }
  }
  window.api.onNotification(handler)
  return () => window.api.offNotification(handler)
}

// --- Filesystem watch for live gallery updates ---

let watchedFolder: string | null = null

/** Start watching a folder on the phone for filesystem changes */
export function watchFolder(folderPath: string): void {
  if (watchedFolder === folderPath) return
  if (watchedFolder) {
    void window.api.invoke('fs.unwatch', { path: watchedFolder }).catch(() => {})
  }
  watchedFolder = folderPath
  void window.api.invoke('fs.watch', { path: folderPath }).catch(() => {})
}

/** Stop watching the current folder */
export function unwatchFolder(): void {
  if (watchedFolder) {
    void window.api.invoke('fs.unwatch', { path: watchedFolder }).catch(() => {})
    watchedFolder = null
  }
}

/** Image/video extensions for classifying new files from watch events */
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heif', 'heic'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'mkv', 'webm', 'avi', 'mov', '3gp', 'm4v'])

/** Subscribe to filesystem watch events and update gallery items accordingly */
export function subscribeFsWatchEvents(): () => void {
  const handler = (method: string, params: unknown): void => {
    if (method !== 'fs.watch_event') return
    const event = params as {
      watchPath: string
      path: string
      filename: string
      event: 'created' | 'deleted' | 'modified'
      isDir: boolean
      size: number
      mtime: number
    }

    // Only process events for media files
    const ext = event.filename.split('.').pop()?.toLowerCase() ?? ''
    const isImage = IMAGE_EXTENSIONS.has(ext)
    const isVideo = VIDEO_EXTENSIONS.has(ext)
    if (!isImage && !isVideo) return

    if (event.event === 'deleted') {
      // Remove item from gallery
      const idx = items.findIndex((i) => i.path === event.path)
      if (idx !== -1) {
        items = [...items.slice(0, idx), ...items.slice(idx + 1)]
      }
    } else if (event.event === 'created') {
      // Add new item to gallery (prepend — newest first)
      const exists = items.some((i) => i.path === event.path)
      if (!exists) {
        const folder = event.watchPath === '/' ? '' : event.watchPath.replace(/^\//, '')
        const newItem: GalleryItem = {
          path: event.path,
          filename: event.filename,
          folder,
          mtime: event.mtime,
          size: event.size,
          mimeType: '',
          isHidden: event.filename.startsWith('.'),
          kind: isVideo ? 'video' : 'image',
        }
        items = [newItem, ...items]
      }
    }
  }
  window.api.onNotification(handler)
  return () => window.api.offNotification(handler)
}

/** Reset gallery state */
export function resetGallery(): void {
  unwatchFolder()
  items = []
  scanState = 'idle'
  scanError = ''
  selectedFolder = null
  // Clear thumbnail/download states
  for (const k of Object.keys(thumbnailStates)) delete thumbnailStates[k]
  for (const k of Object.keys(downloadStates)) delete downloadStates[k]
  thumbQueue.length = 0
  activeThumbRequests = 0
}

/** Handle download progress notifications from daemon */
export function handleDownloadProgress(filePath: string, progress: number): void {
  const current = downloadStates[filePath]
  if (current && current.state === 'downloading') {
    downloadStates[filePath] = { state: 'downloading', progress }
  }
}
