// electron-updater is CJS with a lazy Object.defineProperty getter for autoUpdater.
// electron-vite compiles main to ESM, and Node's CJS-to-ESM interop fails to detect
// the lazy getter as a named export. Use createRequire to load it as CJS directly.
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import type { AppUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { ipcMain, app, net, shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { log } from './logger'

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseNotes?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number; transferred: number; total: number }
  | { state: 'downloaded'; version: string }
  | { state: 'installing'; percent: number; version: string }
  | { state: 'error'; message: string }

let mainWin: BrowserWindow | null = null
let currentStatus: UpdateStatus = { state: 'idle' }
let currentUpdateVersion: string | null = null
let isInstalling = false

function setStatus(status: UpdateStatus): void {
  currentStatus = status
  mainWin?.webContents.send('updater:status', status)
}

export function setupAutoUpdater(win: BrowserWindow): void {
  mainWin = win

  const require = createRequire(import.meta.url)
  const { autoUpdater } = require('electron-updater') as { autoUpdater: AppUpdater }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

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
    currentUpdateVersion = info.version
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

  // Install-now: on Windows, download the installer and run it silently.
  // On other platforms, open the GitHub releases page.
  ipcMain.handle('updater:install-now', async () => {
    const version = currentUpdateVersion

    if (process.platform !== 'win32') {
      const url = version
        ? `https://github.com/hansonxyz/fosslink-desktop/releases/tag/v${version}`
        : 'https://github.com/hansonxyz/fosslink-desktop/releases/latest'
      await shell.openExternal(url)
      return
    }

    if (!version) {
      setStatus({ state: 'error', message: 'No update version available' })
      return
    }

    if (isInstalling) {
      log('updater', 'Install already in progress, ignoring')
      return
    }
    isInstalling = true

    const installerName = `FossLink-Setup-${version}.exe`
    const downloadUrl = `https://github.com/hansonxyz/fosslink-desktop/releases/download/v${version}/${installerName}`
    const tempPath = join(app.getPath('temp'), installerName)

    log('updater', 'Downloading installer', { url: downloadUrl, dest: tempPath })
    setStatus({ state: 'installing', percent: 0, version })

    try {
      const response = await net.fetch(downloadUrl)
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const total = parseInt(response.headers.get('content-length') ?? '0', 10)
      let received = 0
      const chunks: Buffer[] = []

      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(Buffer.from(value))
        received += value.length
        if (total > 0) {
          setStatus({ state: 'installing', percent: Math.round(received / total * 100), version })
        }
      }

      await writeFile(tempPath, Buffer.concat(chunks))
      log('updater', 'Installer downloaded, launching', { path: tempPath })
      setStatus({ state: 'installing', percent: 100, version })

      // Detach and launch installer, then quit this app.
      // /silent: skips all prompts, uninstalls old version, installs new.
      // /run: launches the app after install completes.
      const { spawn } = require('node:child_process') as typeof import('node:child_process')
      spawn(tempPath, ['/silent', '/run'], {
        detached: true,
        stdio: 'ignore',
      }).unref()

      // Give installer a moment to start, then exit.
      setTimeout(() => app.quit(), 1500)
    } catch (err) {
      isInstalling = false
      const message = err instanceof Error ? err.message : String(err)
      log('updater', 'Installer download failed', { error: message })
      setStatus({ state: 'error', message: `Download failed: ${message}` })
    }
  })

  ipcMain.handle('updater:get-status', () => {
    return currentStatus
  })

  ipcMain.handle('updater:get-version', () => {
    return app.getVersion()
  })
}
