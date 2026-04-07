import { app, BrowserWindow, Menu, ipcMain, protocol, net, dialog, shell, nativeImage, powerMonitor } from 'electron'
import { join, extname, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { copyFile, stat, writeFile as fsWriteFile } from 'node:fs/promises'
import { DaemonBridge } from './daemon-bridge'
import { initLogger, log, closeLogger } from './logger'
import { setupAutoUpdater } from './auto-updater'
import { initLinkPreviewCache, closeLinkPreviewCache } from './link-preview-cache'
import { fetchLinkPreview } from './link-preview-fetcher'

// Global error handlers — log to file before Electron's default crash dialog
function logCrash(label: string, err: unknown): void {
  const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err)
  const line = `\n--- ${label} ${new Date().toISOString()} ---\n${msg}\n`
  try {
    const crashLog = join(app.getPath('userData'), 'crash.log')
    appendFileSync(crashLog, line)
  } catch { /* best effort */ }
  try {
    // Also append to the GUI log if it's on a network share
    const argv = process.argv
    const logFlag = argv.find(a => a.startsWith('--log-file='))
    if (logFlag) {
      appendFileSync(logFlag.replace('--log-file=', ''), line)
    }
  } catch { /* best effort */ }
}

process.on('uncaughtException', (err) => {
  logCrash('UNCAUGHT EXCEPTION', err)
})

process.on('unhandledRejection', (reason) => {
  logCrash('UNHANDLED REJECTION', reason)
})

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized?: boolean
}

function getWindowStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function loadWindowState(): WindowState {
  try {
    const data = readFileSync(getWindowStatePath(), 'utf-8')
    return JSON.parse(data) as WindowState
  } catch {
    return { width: 1200, height: 800 }
  }
}

function saveWindowState(win: BrowserWindow): void {
  try {
    const bounds = win.getBounds()
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: win.isMaximized(),
    }
    mkdirSync(join(app.getPath('userData')), { recursive: true })
    writeFileSync(getWindowStatePath(), JSON.stringify(state))
  } catch {
    // Ignore save errors
  }
}

function getExtensionForMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'video/3gpp2': '.3g2',
    'video/mpeg': '.mpeg',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/amr': '.amr',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/3gpp': '.3gp',
    'text/vcard': '.vcf',
    'text/x-vcard': '.vcf',
    'application/pdf': '.pdf',
  }
  return map[mime] ?? ''
}

function extToMime(ext: string): string {
  const map: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'mp4': 'video/mp4',
    '3gp': 'video/3gpp',
    'mpeg': 'video/mpeg',
    'webm': 'video/webm',
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'amr': 'audio/amr',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
    'pdf': 'application/pdf',
    'vcf': 'text/vcard',
  }
  return map[ext] ?? 'application/octet-stream'
}

// MMS image preparation: resize and compress for carrier limits
const MMS_IMAGE_RESIZE_THRESHOLD = 300 * 1024 // Only resize images > 300KB
const MMS_IMAGE_MAX_DIMENSION = 1024

interface PreparedFile {
  filePath: string // may be a temp file if resized
  mimeType: string
  size: number
}

async function prepareImageForMms(filePath: string, mimeType: string, fileSize: number): Promise<PreparedFile> {
  // Only process image types nativeImage can handle (not GIF — could be animated)
  if (!mimeType.startsWith('image/') || mimeType === 'image/gif') {
    return { filePath, mimeType, size: fileSize }
  }

  // Small images don't need resizing
  if (fileSize <= MMS_IMAGE_RESIZE_THRESHOLD) {
    return { filePath, mimeType, size: fileSize }
  }

  try {
    const img = nativeImage.createFromPath(filePath)
    if (img.isEmpty()) {
      log('mms', 'nativeImage failed to load, sending original', { filePath })
      return { filePath, mimeType, size: fileSize }
    }

    const { width, height } = img.getSize()
    let target = img

    // Downscale if either dimension exceeds max
    if (width > MMS_IMAGE_MAX_DIMENSION || height > MMS_IMAGE_MAX_DIMENSION) {
      const scale = MMS_IMAGE_MAX_DIMENSION / Math.max(width, height)
      target = img.resize({
        width: Math.round(width * scale),
        height: Math.round(height * scale),
      })
    }

    // Encode to JPEG — try quality 85 first, fall back to 60 if still large
    let buffer = target.toJPEG(85)
    if (buffer.length > MMS_IMAGE_RESIZE_THRESHOLD) {
      buffer = target.toJPEG(60)
    }

    const tempPath = join(
      app.getPath('temp'),
      `fosslink_mms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`,
    )
    await fsWriteFile(tempPath, buffer)

    const targetSize = target.getSize()
    log('mms', 'Image resized for MMS', {
      original: `${width}x${height} ${(fileSize / 1024).toFixed(0)}KB`,
      resized: `${targetSize.width}x${targetSize.height} ${(buffer.length / 1024).toFixed(0)}KB`,
    })

    return { filePath: tempPath, mimeType: 'image/jpeg', size: buffer.length }
  } catch (err) {
    log('mms', 'Image resize failed, sending original', {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    })
    return { filePath, mimeType, size: fileSize }
  }
}

let mainWindow: BrowserWindow | null = null
let daemonClient: DaemonBridge | null = null
const isDevBuild: boolean = typeof __DEV_BUILD__ !== 'undefined' && __DEV_BUILD__

// Draft attachments picked by user but not yet sent — maps draftId to file info
const draftAttachments = new Map<string, { filePath: string; mimeType: string }>()

// Track active WebDAV mount port for cleanup on quit
let activeWebdavPort: number | null = null

function parseArgValue(prefix: string): string | null {
  for (const arg of process.argv) {
    if (arg.startsWith(prefix)) {
      return arg.substring(prefix.length)
    }
  }
  return null
}

function createWindow(): void {
  log('main', 'Creating browser window')

  const saved = loadWindowState()

  mainWindow = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 800,
    minHeight: 500,
    title: 'FossLink',
    backgroundColor: '#1a1a2e',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (saved.maximized) {
    mainWindow.maximize()
  }

  mainWindow.on('ready-to-show', () => {
    log('main', 'Window ready to show')
    mainWindow?.show()
  })

  // Save window state on close
  mainWindow.on('close', () => {
    if (mainWindow) saveWindowState(mainWindow)
  })

  // Stop taskbar flash when window gains focus
  mainWindow.on('focus', () => {
    mainWindow?.flashFrame(false)
  })

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    const url = process.env['ELECTRON_RENDERER_URL']
    log('main', 'Loading dev URL', { url })
    mainWindow.loadURL(url)
  } else {
    const htmlPath = join(__dirname, '../renderer/index.html')
    log('main', 'Loading production HTML', { path: htmlPath })
    mainWindow.loadFile(htmlPath)
  }
}

function setupDaemonClient(): void {
  daemonClient = new DaemonBridge({ daemonLogPath: daemonLogFile ?? undefined })

  // Batch high-frequency sms.messages notifications to prevent UI freeze.
  // During sync or after MMS send, the phone can fire 600+ sms.messages
  // notifications in minutes. Each one triggers a synchronous log write and
  // IPC forward — batching reduces this to one event per 500ms.
  let smsBatchNewestDate = 0
  const smsBatchThreadIds = new Set<number>()
  let smsBatchCount = 0
  let smsBatchTimer: ReturnType<typeof setTimeout> | undefined

  function flushSmsBatch(): void {
    smsBatchTimer = undefined
    const threadId = smsBatchThreadIds.size === 1 ? [...smsBatchThreadIds][0] : undefined
    log('daemon', 'sms.messages batch', {
      notifications: String(smsBatchCount),
      threads: String(smsBatchThreadIds.size),
    })
    mainWindow?.webContents.send('daemon:notification', 'sms.messages', {
      threadId,
      newestDate: smsBatchNewestDate || undefined,
    })
    smsBatchNewestDate = 0
    smsBatchThreadIds.clear()
    smsBatchCount = 0
  }

  daemonClient.onNotification((method, params) => {
    if (method === 'sms.messages') {
      const data = params as { threadId?: number; newestDate?: number } | null
      smsBatchCount++
      if (data?.threadId !== undefined) smsBatchThreadIds.add(data.threadId)
      if (data?.newestDate !== undefined && data.newestDate > smsBatchNewestDate) {
        smsBatchNewestDate = data.newestDate
      }
      if (smsBatchTimer === undefined) {
        smsBatchTimer = setTimeout(flushSmsBatch, 500)
      }
      return
    }
    // URL shared from phone — open in desktop browser
    if (method === 'url.shared') {
      const url = (params as Record<string, unknown>)?.url
      if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
        log('daemon', 'Opening shared URL from phone', { url })
        void shell.openExternal(url)
      }
    }
    log('daemon', 'Notification received', { method })
    mainWindow?.webContents.send('daemon:notification', method, params)
  })

  daemonClient.onStateChange((state) => {
    log('daemon', 'Connection state changed', { state })
    mainWindow?.webContents.send('daemon:state-changed', state)
  })

  if (isDevBuild) {
    daemonClient.onLog((level, category, msg, data) => {
      mainWindow?.webContents.send('daemon:log-entry', level, category, msg, data)
    })
  }

  log('daemon', 'Starting embedded daemon')
  daemonClient.connect()
}

function setupIpcHandlers(): void {
  ipcMain.handle('daemon:invoke', async (_event, method: string, params?: Record<string, unknown>) => {
    log('ipc', 'Renderer invoke', { method })
    if (!daemonClient || !daemonClient.isConnected()) {
      throw new Error('Daemon not connected')
    }
    return await daemonClient.call(method, params)
  })

  ipcMain.handle('daemon:state', () => {
    const state = daemonClient?.getState() ?? 'disconnected'
    log('ipc', 'Renderer getConnectionState', { state })
    return state
  })

  ipcMain.on('daemon:log', (_event, category: string, message: string, data?: Record<string, unknown>) => {
    log(category, message, data)
  })

  ipcMain.handle('dialog:save', async (_event, defaultName: string, filters: { name: string; extensions: string[] }[]) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters,
    })
    return result.canceled ? null : result.filePath ?? null
  })

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    const { writeFile } = await import('node:fs/promises')
    await writeFile(filePath, content, 'utf-8')
  })

  ipcMain.handle('attachment:save', async (_event, partId: number, messageId: number) => {
    if (!daemonClient || !daemonClient.isConnected()) {
      throw new Error('Daemon not connected')
    }
    if (!mainWindow) return { saved: false }

    const result = (await daemonClient.call('sms.attachment_path', {
      partId,
      messageId,
    })) as { localPath: string; mimeType: string } | null

    if (!result || !result.localPath) {
      throw new Error('Attachment not found')
    }

    const ext = getExtensionForMime(result.mimeType)
    // Use the original filename's extension as fallback, or derive from the file on disk
    const diskExt = extname(result.localPath)
    const finalExt = ext || diskExt || '.bin'
    const defaultName = `attachment_${partId}_${messageId}${finalExt}`

    // Build filters: specific type first, then all files
    const extNoDot = finalExt.slice(1)
    const filters = [
      { name: `${result.mimeType} (*.${extNoDot})`, extensions: [extNoDot] },
      { name: 'All Files', extensions: ['*'] },
    ]

    const dialogResult = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters,
    })

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { saved: false }
    }

    await copyFile(result.localPath, dialogResult.filePath)
    return { saved: true, path: dialogResult.filePath }
  })

  ipcMain.on('attachment:context-menu', (event, partId: number, messageId: number) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Save As\u2026',
        click: () => {
          void (async () => {
            try {
              // Reuse the same save logic as the save button
              const result = (await daemonClient.call('sms.attachment_path', {
                partId,
                messageId,
              })) as { localPath: string; mimeType: string } | null

              if (!result || !result.localPath || !mainWindow) return

              const ext = getExtensionForMime(result.mimeType)
              const diskExt = extname(result.localPath)
              const finalExt = ext || diskExt || '.bin'
              const defaultName = `attachment_${partId}_${messageId}${finalExt}`
              const extNoDot = finalExt.slice(1)
              const filters = [
                { name: `${result.mimeType} (*.${extNoDot})`, extensions: [extNoDot] },
                { name: 'All Files', extensions: ['*'] },
              ]

              const dialogResult = await dialog.showSaveDialog(mainWindow, {
                defaultPath: defaultName,
                filters,
              })

              if (!dialogResult.canceled && dialogResult.filePath) {
                await copyFile(result.localPath, dialogResult.filePath)
              }
            } catch (err) {
              log('gui.main', 'Context menu save failed', {
                error: err instanceof Error ? err.message : String(err),
              })
            }
          })()
        },
      },
    ])
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      menu.popup({ window: win })
    }
  })

  ipcMain.on('gallery:context-menu', (event, filePath: string) => {
    const menu = Menu.buildFromTemplate([
      {
        label: 'Save As\u2026',
        click: () => {
          void (async () => {
            try {
              if (!daemonClient || !daemonClient.isConnected() || !mainWindow) return

              // Download the file first (returns cached path if already downloaded)
              const result = (await daemonClient.call('gallery.download', {
                path: filePath,
              })) as { localPath: string }

              if (!result?.localPath) return

              const diskExt = extname(result.localPath)
              const fileName = basename(filePath)
              const defaultName = fileName || `gallery_file${diskExt}`
              const extNoDot = (diskExt || '.bin').slice(1)
              const mime = extToMime(extNoDot)
              const filters = [
                { name: `${mime} (*.${extNoDot})`, extensions: [extNoDot] },
                { name: 'All Files', extensions: ['*'] },
              ]

              const dialogResult = await dialog.showSaveDialog(mainWindow, {
                defaultPath: defaultName,
                filters,
              })

              if (!dialogResult.canceled && dialogResult.filePath) {
                await copyFile(result.localPath, dialogResult.filePath)
              }
            } catch (err) {
              log('gui.main', 'Gallery context menu save failed', {
                error: err instanceof Error ? err.message : String(err),
              })
            }
          })()
        },
      },
    ])
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      menu.popup({ window: win })
    }
  })

  ipcMain.on('gallery:save', (_event, filePath: string) => {
    void (async () => {
      try {
        if (!daemonClient || !daemonClient.isConnected() || !mainWindow) return

        const result = (await daemonClient.call('gallery.download', {
          path: filePath,
        })) as { localPath: string }

        if (!result?.localPath) return

        const diskExt = extname(result.localPath)
        const fileName = basename(filePath)
        const defaultName = fileName || `gallery_file${diskExt}`
        const extNoDot = (diskExt || '.bin').slice(1)
        const mime = extToMime(extNoDot)
        const filters = [
          { name: `${mime} (*.${extNoDot})`, extensions: [extNoDot] },
          { name: 'All Files', extensions: ['*'] },
        ]

        const dialogResult = await dialog.showSaveDialog(mainWindow, {
          defaultPath: defaultName,
          filters,
        })

        if (!dialogResult.canceled && dialogResult.filePath) {
          await copyFile(result.localPath, dialogResult.filePath)
        }
      } catch (err) {
        log('gui.main', 'Gallery save failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    })()
  })

  ipcMain.on('window:flash-frame', (_event, flash: boolean) => {
    mainWindow?.flashFrame(flash)
  })

  ipcMain.on('shell:open-external', (_event, url: string) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      void shell.openExternal(url)
    }
  })

  ipcMain.on('shell:open-webdav', (_event, port: number) => {
    if (typeof port !== 'number' || port < 1 || port > 65535) return
    activeWebdavPort = port
    const { exec } = require('node:child_process') as typeof import('node:child_process')
    if (process.platform === 'win32') {
      exec(`explorer.exe "\\\\localhost@${port}\\DavWWWRoot"`)
    } else if (process.platform === 'darwin') {
      exec(`open "http://localhost:${port}/"`)
    } else {
      exec(`xdg-open "dav://localhost:${port}/"`)
    }
  })

  ipcMain.handle('shell:open-webdav-folder', async (_event, port: number, folderPath: string) => {
    if (typeof port !== 'number' || port < 1 || port > 65535) {
      return { ok: false, error: 'Invalid port' }
    }
    if (typeof folderPath !== 'string') {
      return { ok: false, error: 'Invalid folder path' }
    }
    activeWebdavPort = port
    const { exec } = require('node:child_process') as typeof import('node:child_process')
    const subPath = folderPath.replace(/\//g, '\\')

    if (process.platform === 'win32') {
      const uncPath = `\\\\localhost@${port}\\DavWWWRoot\\${subPath}`
      // Test WebDAV connectivity first with dir command (faster than net use)
      return new Promise<{ ok: boolean; error?: string }>((resolve) => {
        exec(`dir "${uncPath}"`, { timeout: 10000 }, (err) => {
          if (err) {
            log('main', 'WebDAV mount test failed', { uncPath, error: err.message })
            resolve({ ok: false, error: 'Could not connect to phone filesystem. The phone may be disconnected or the WebDAV server is not ready.' })
          } else {
            exec(`explorer.exe "${uncPath}"`)
            resolve({ ok: true })
          }
        })
      })
    } else if (process.platform === 'darwin') {
      exec(`open "http://localhost:${port}/${folderPath}"`)
      return { ok: true }
    } else {
      exec(`xdg-open "dav://localhost:${port}/${folderPath}"`)
      return { ok: true }
    }
  })

  ipcMain.on('shell:close-webdav', (_event, port: number) => {
    if (typeof port !== 'number' || port < 1 || port > 65535) return
    activeWebdavPort = null
    const { exec } = require('node:child_process') as typeof import('node:child_process')
    if (process.platform === 'win32') {
      exec(`net use \\\\localhost@${port}\\DavWWWRoot /delete /y`, () => {})
    } else if (process.platform === 'darwin') {
      exec(`umount "http://localhost:${port}/"`, () => {})
    } else {
      exec(`umount "dav://localhost:${port}/"`, () => {})
    }
  })

  ipcMain.handle('dialog:open-files', async () => {
    log('ipc', 'dialog:open-files called')
    if (!mainWindow) {
      log('ipc', 'dialog:open-files: no mainWindow')
      return []
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select attachments',
      filters: [
        { name: 'Media Files', extensions: [
          'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
          'mp4', '3gp', 'mpeg', 'webm',
          'mp3', 'm4a', 'amr', 'ogg', 'wav',
        ]},
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
        { name: 'Videos', extensions: ['mp4', '3gp', 'mpeg', 'webm'] },
        { name: 'Audio', extensions: ['mp3', 'm4a', 'amr', 'ogg', 'wav'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      log('ipc', 'dialog:open-files: user canceled or no files')
      return []
    }

    log('ipc', 'dialog:open-files: picked files', { count: String(result.filePaths.length) })

    const drafts: Array<{
      draftId: string
      filePath: string
      fileName: string
      mimeType: string
      size: number
    }> = []

    for (const filePath of result.filePaths) {
      try {
        const fileStat = await stat(filePath)
        const fileName = basename(filePath)
        const ext = extname(filePath).toLowerCase().slice(1)
        const rawMimeType = extToMime(ext)
        const draftId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

        // Resize images for MMS compatibility
        const prepared = await prepareImageForMms(filePath, rawMimeType, fileStat.size)

        draftAttachments.set(draftId, { filePath: prepared.filePath, mimeType: prepared.mimeType })
        drafts.push({ draftId, filePath: prepared.filePath, fileName, mimeType: prepared.mimeType, size: prepared.size })
        log('ipc', 'dialog:open-files: added draft', { draftId, fileName, mimeType: prepared.mimeType, size: String(prepared.size) })
      } catch (err) {
        log('ipc', 'dialog:open-files: failed to process file', {
          filePath,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return drafts
  })

  ipcMain.handle('draft:register-files', async (_event, filePaths: string[]) => {
    log('ipc', 'draft:register-files called', { count: String(filePaths.length) })
    const drafts: Array<{
      draftId: string
      filePath: string
      fileName: string
      mimeType: string
      size: number
    }> = []

    for (const filePath of filePaths) {
      try {
        const fileStat = await stat(filePath)
        const fileName = basename(filePath)
        const ext = extname(filePath).toLowerCase().slice(1)
        const rawMimeType = extToMime(ext)
        const draftId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

        // Resize images for MMS compatibility
        const prepared = await prepareImageForMms(filePath, rawMimeType, fileStat.size)

        draftAttachments.set(draftId, { filePath: prepared.filePath, mimeType: prepared.mimeType })
        drafts.push({ draftId, filePath: prepared.filePath, fileName, mimeType: prepared.mimeType, size: prepared.size })
        log('ipc', 'draft:register-files: added draft', { draftId, fileName, mimeType: prepared.mimeType, size: String(prepared.size) })
      } catch (err) {
        log('ipc', 'draft:register-files: failed to process file', {
          filePath,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    return drafts
  })

  ipcMain.handle('draft:register-clipboard', async (_event, buffer: ArrayBuffer, fileName: string, mimeType: string) => {
    log('ipc', 'draft:register-clipboard called', { fileName, mimeType, size: String(buffer.byteLength) })

    const tempPath = join(
      app.getPath('temp'),
      `fosslink_mms_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${fileName}`,
    )
    await fsWriteFile(tempPath, Buffer.from(buffer))

    const draftId = `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const prepared = await prepareImageForMms(tempPath, mimeType, buffer.byteLength)

    draftAttachments.set(draftId, { filePath: prepared.filePath, mimeType: prepared.mimeType })
    log('ipc', 'draft:register-clipboard: added draft', { draftId, fileName, mimeType: prepared.mimeType, size: String(prepared.size) })

    return { draftId, filePath: prepared.filePath, fileName, mimeType: prepared.mimeType, size: prepared.size }
  })

  ipcMain.on('draft:cleanup', (_event, draftIds: string[]) => {
    for (const id of draftIds) {
      draftAttachments.delete(id)
    }
  })

  ipcMain.handle('link-preview:fetch', async (_event, url: string) => {
    return await fetchLinkPreview(url)
  })
}

// Register custom protocol for serving attachment files to the renderer
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'xyzattachment',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

const logFile = parseArgValue('--log-file=')
const daemonLogFile = parseArgValue('--daemon-log=')
if (logFile) {
  initLogger(logFile)
} else {
  // Auto-enable logging to userData directory
  const autoLogPath = join(app.getPath('userData'), 'gui-debug.log')
  mkdirSync(join(app.getPath('userData')), { recursive: true })
  initLogger(autoLogPath)
}

log('main', 'App starting', {
  argv: process.argv,
  platform: process.platform,
  packaged: app.isPackaged,
  version: app.getVersion()
})

// Extract phone number from a tel: URL (command-line arg or protocol URL)
function extractTelNumber(url: string): string | null {
  if (!url.startsWith('tel:')) return null
  try {
    const raw = url.slice(4) // strip 'tel:'
    return decodeURIComponent(raw).replace(/^\/\//, '').trim() || null
  } catch {
    return null
  }
}

// Send a tel: number to the renderer
function handleTelUrl(url: string): void {
  const phoneNumber = extractTelNumber(url)
  if (phoneNumber) {
    log('main', 'Handling tel: URL', { phoneNumber })
    mainWindow?.webContents.send('tel:incoming', phoneNumber)
  }
}

// Register as handler for tel: links
app.setAsDefaultProtocolClient('tel')

// macOS: tel: URLs arrive via open-url event
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleTelUrl(url)
})

// Single instance lock — if another instance is already running, focus it and quit
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  log('main', 'Another instance is already running, quitting')
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
    // Windows/Linux: tel: URL comes as a command-line arg in the second instance
    const telArg = argv.find((a) => a.startsWith('tel:'))
    if (telArg) {
      handleTelUrl(telArg)
    }
  })
}

app.whenReady().then(() => {
  log('main', 'App ready')

  // __DEV_BUILD__ is a compile-time constant set by electron-vite define.
  // Dev builds (npm run build) bake in true; release builds bake in false.
  log('main', 'Menu bar mode', { isDevBuild })
  if (isDevBuild) {
    const devMenu = Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [{ role: 'quit' }]
      },
      {
        label: 'View',
        submenu: [
          { role: 'toggleDevTools' },
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      }
    ])
    Menu.setApplicationMenu(devMenu)
  } else {
    Menu.setApplicationMenu(null)
  }

  // In-process cache for attachment file paths. Keyed by URL, stores the local
  // file path. Avoids daemon IPC round-trip on every virtual scroll mount.
  // Attachment files are immutable (same partId always maps to same file), so
  // entries never need invalidation.
  const pathCache = new Map<string, string>()

  /** Serve a local file with immutable caching headers and Range request support. */
  async function serveCached(localPath: string, request?: Request): Promise<Response> {
    const fileStat = await stat(localPath)
    const totalSize = fileStat.size
    const contentType = extToMime(extname(localPath).toLowerCase().slice(1))

    // Check for Range header (required for video seeking)
    const rangeHeader = request?.headers.get('Range')
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1], 10)
        const end = match[2] ? parseInt(match[2], 10) : totalSize - 1
        const chunkSize = end - start + 1

        const { createReadStream } = await import('node:fs')
        const stream = createReadStream(localPath, { start, end })

        // Convert Node stream to Web ReadableStream
        const readable = new ReadableStream({
          start(controller) {
            stream.on('data', (chunk: Buffer) => controller.enqueue(chunk))
            stream.on('end', () => controller.close())
            stream.on('error', (err) => controller.error(err))
          },
          cancel() {
            stream.destroy()
          },
        })

        return new Response(readable, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Content-Length': String(chunkSize),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      }
    }

    // Full file response — still advertise Range support
    const fileResponse = await net.fetch(pathToFileURL(localPath).href)
    return new Response(fileResponse.body, {
      status: fileResponse.status,
      statusText: fileResponse.statusText,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(totalSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  // Handle xyzattachment:// — serves downloaded attachment files and thumbnails
  // URL format: xyzattachment://file/{partId}/{messageId} (full file)
  //             xyzattachment://thumb/{partId}/{messageId} (thumbnail)
  protocol.handle('xyzattachment', async (request) => {
    try {
      const url = new URL(request.url)
      const host = url.hostname // 'file' or 'thumb'
      const parts = url.pathname.split('/').filter(Boolean)
      const partId = parseInt(parts[0] ?? '0', 10)
      const messageId = parseInt(parts[1] ?? '0', 10)

      if (host === 'draft') {
        // URL: xyzattachment://draft/{draftId} — serve files picked for MMS compose
        const draftId = parts[0]
        if (!draftId) {
          return new Response('Missing draftId', { status: 400 })
        }
        const draft = draftAttachments.get(draftId)
        if (!draft) {
          return new Response('Draft not found', { status: 404 })
        }
        return net.fetch(pathToFileURL(draft.filePath).href)
      }

      // Check in-process path cache first (skips daemon IPC entirely)
      const cacheKey = request.url
      const cachedPath = pathCache.get(cacheKey)
      if (cachedPath) {
        return serveCached(cachedPath, request)
      }

      if (!daemonClient || !daemonClient.isConnected()) {
        return new Response('Daemon not connected', { status: 503 })
      }

      if (host === 'contact-photo') {
        // URL: xyzattachment://contact-photo/{uid}
        const uid = parts[0]
        if (!uid) {
          return new Response('Missing uid', { status: 400 })
        }
        const result = (await daemonClient.call('contacts.photo_path', { uid })) as {
          localPath: string
          mimeType: string
        } | null
        if (!result || !result.localPath) {
          return new Response('Not found', { status: 404 })
        }
        pathCache.set(cacheKey, result.localPath)
        return serveCached(result.localPath, request)
      }

      if (host === 'link-preview') {
        // URL: xyzattachment://link-preview/{hash}.ext — serve cached OG image
        const fileName = parts.join('/')
        if (!fileName) {
          return new Response('Missing filename', { status: 400 })
        }
        const { getImageDir } = await import('./link-preview-cache')
        const imgPath = join(getImageDir(), fileName)
        try {
          return await serveCached(imgPath)
        } catch {
          return new Response('Not found', { status: 404 })
        }
      }

      if (host === 'gallery-thumb') {
        // URL: xyzattachment://gallery-thumb/{encodedPath}
        const filePath = decodeURIComponent(parts.join('/'))
        if (!filePath) {
          return new Response('Missing path', { status: 400 })
        }
        const result = (await daemonClient.call('gallery.thumbnail', { path: filePath })) as {
          localPath: string
          failed: boolean
        }
        if (!result?.localPath || result.failed) {
          return new Response('Not found', { status: 404 })
        }
        pathCache.set(cacheKey, result.localPath)
        return serveCached(result.localPath, request)
      }

      if (host === 'gallery-file') {
        // URL: xyzattachment://gallery-file/{encodedPath}
        const filePath = decodeURIComponent(parts.join('/'))
        if (!filePath) {
          return new Response('Missing path', { status: 400 })
        }
        const result = (await daemonClient.call('gallery.download', { path: filePath })) as {
          localPath: string
        }
        if (!result?.localPath) {
          return new Response('Not found', { status: 404 })
        }
        pathCache.set(cacheKey, result.localPath)
        return serveCached(result.localPath, request)
      }

      if (host === 'thumb') {
        const result = (await daemonClient.call('sms.attachment_thumbnail_path', {
          partId,
          messageId,
        })) as { thumbnailPath: string; mimeType: string } | null

        if (!result || !result.thumbnailPath) {
          return new Response('Not found', { status: 404 })
        }

        log('protocol', 'xyzattachment serving thumbnail', { partId: String(partId), messageId: String(messageId) })
        pathCache.set(cacheKey, result.thumbnailPath)
        return serveCached(result.thumbnailPath, request)
      }

      // Default: serve full file
      const result = (await daemonClient.call('sms.attachment_path', {
        partId,
        messageId,
      })) as { localPath: string; mimeType: string } | null

      if (!result || !result.localPath) {
        log('protocol', 'xyzattachment not found', { partId: String(partId), messageId: String(messageId) })
        return new Response('Not found', { status: 404 })
      }

      log('protocol', 'xyzattachment serving file', { partId: String(partId), messageId: String(messageId), localPath: result.localPath })
      pathCache.set(cacheKey, result.localPath)
      return serveCached(result.localPath, request)
    } catch (err) {
      log('protocol', 'xyzattachment error', {
        url: request.url,
        error: err instanceof Error ? err.message : String(err),
      })
      return new Response('Internal error', { status: 500 })
    }
  })

  initLinkPreviewCache(app.getPath('userData'))

  setupIpcHandlers()
  createWindow()
  setupDaemonClient()
  setupAutoUpdater(mainWindow!)

  // On OS resume from sleep/standby, immediately check if phone connection is stale
  powerMonitor.on('resume', () => {
    log('main', 'OS resumed from sleep, checking connections')
    daemonClient?.checkConnections()
  })

  // Handle tel: URL passed as command-line arg on fresh launch (Windows/Linux)
  const telArg = process.argv.find((a) => a.startsWith('tel:'))
  if (telArg) {
    // Delay until renderer is ready to receive IPC
    mainWindow!.webContents.once('did-finish-load', () => {
      handleTelUrl(telArg)
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  log('main', 'All windows closed, shutting down')
  // Disconnect OS-level WebDAV mount before shutting down
  if (activeWebdavPort) {
    const { exec } = require('node:child_process') as typeof import('node:child_process')
    const port = activeWebdavPort
    activeWebdavPort = null
    if (process.platform === 'win32') {
      exec(`net use \\\\localhost@${port}\\DavWWWRoot /delete /y`, () => {})
    } else if (process.platform === 'darwin') {
      exec(`umount "http://localhost:${port}/"`, () => {})
    } else {
      exec(`umount "dav://localhost:${port}/"`, () => {})
    }
  }
  const shutdown = async (): Promise<void> => {
    try {
      if (daemonClient) {
        // Wait for daemon to stop, but don't hang forever
        await Promise.race([
          daemonClient.disconnect(),
          new Promise<void>((resolve) => setTimeout(resolve, 3000)),
        ])
      }
    } catch (err) {
      log('main', 'Error during daemon shutdown', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
    closeLinkPreviewCache()
    closeLogger()
    if (process.platform !== 'darwin') {
      app.quit()
    }
    // Force exit after a short delay — open network handles (TCP/UDP)
    // can prevent the process from exiting on Windows
    setTimeout(() => process.exit(0), 1000)
  }
  void shutdown()
})
