// electron-updater is CJS with a lazy Object.defineProperty getter for autoUpdater.
// electron-vite compiles main to ESM, and Node's CJS-to-ESM interop fails to detect
// the lazy getter as a named export. Use createRequire to load it as CJS directly.
import { createRequire } from 'node:module'
import type { AppUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { ipcMain, app } from 'electron'
import type { BrowserWindow } from 'electron'
import { log } from './logger'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseNotes?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number; transferred: number; total: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

let mainWin: BrowserWindow | null = null
let currentStatus: UpdateStatus = { state: 'idle' }

function setStatus(status: UpdateStatus): void {
  currentStatus = status
  mainWin?.webContents.send('updater:status', status)
}

export function setupAutoUpdater(win: BrowserWindow): void {
  mainWin = win

  const require = createRequire(import.meta.url)
  const { autoUpdater } = require('electron-updater') as { autoUpdater: AppUpdater }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.autoRunAppAfterInstall = true

  const feedUrl = process.env['FOSSLINK_UPDATE_URL']
  if (feedUrl) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: feedUrl,
    })
    log('updater', 'Feed URL overridden', { url: feedUrl })
  }

  autoUpdater.on('checking-for-update', () => {
    log('updater', 'Checking for update')
    setStatus({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log('updater', 'Update available', { version: info.version })
    setStatus({
      state: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : undefined,
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log('updater', 'Up to date', { version: info.version })
    setStatus({ state: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    setStatus({
      state: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log('updater', 'Update downloaded', { version: info.version })
    setStatus({ state: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err: Error) => {
    log('updater', 'Update error', { error: err.message })
    setStatus({ state: 'error', message: err.message })
  })

  ipcMain.handle('updater:check', async () => {
    log('updater', 'Manual check triggered')
    return autoUpdater.checkForUpdates()
  })

  ipcMain.handle('updater:download', async () => {
    log('updater', 'Download triggered')
    return autoUpdater.downloadUpdate()
  })

  ipcMain.handle('updater:install', () => {
    log('updater', 'Install triggered, quitting and installing')
    autoUpdater.quitAndInstall(false, true)
  })

  ipcMain.handle('updater:get-status', () => {
    return currentStatus
  })

  ipcMain.handle('updater:get-version', () => {
    return app.getVersion()
  })
}
