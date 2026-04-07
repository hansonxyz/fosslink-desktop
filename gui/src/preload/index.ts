import { contextBridge, ipcRenderer } from 'electron'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected'
type NotificationCallback = (method: string, params: unknown) => void
type StateChangeCallback = (state: ConnectionState) => void
type UpdateStatusCallback = (status: unknown) => void

const notificationCallbacks = new Set<NotificationCallback>()
const stateChangeCallbacks = new Set<StateChangeCallback>()
const updateStatusCallbacks = new Set<UpdateStatusCallback>()

ipcRenderer.on('daemon:notification', (_event, method: string, params: unknown) => {
  console.log(`[daemon] ${method}`, params)
  for (const cb of notificationCallbacks) {
    cb(method, params)
  }
})

ipcRenderer.on('daemon:state-changed', (_event, state: ConnectionState) => {
  console.log(`[daemon] state-changed → ${state}`)
  for (const cb of stateChangeCallbacks) {
    cb(state)
  }
})

ipcRenderer.on('daemon:log-entry', (_event, level: string, category: string, msg: string, data?: Record<string, unknown>) => {
  const prefix = `[daemon:${category}]`
  if (data && Object.keys(data).length > 0) {
    console.log(`${prefix} ${msg}`, data)
  } else {
    console.log(`${prefix} ${msg}`)
  }
})

ipcRenderer.on('updater:status', (_event, status: unknown) => {
  for (const cb of updateStatusCallbacks) {
    cb(status)
  }
})

const telIncomingCallbacks = new Set<(phoneNumber: string) => void>()

ipcRenderer.on('tel:incoming', (_event, phoneNumber: string) => {
  console.log(`[tel] incoming: ${phoneNumber}`)
  for (const cb of telIncomingCallbacks) {
    cb(phoneNumber)
  }
})

const api = {
  invoke(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return ipcRenderer.invoke('daemon:invoke', method, params)
  },

  getConnectionState(): Promise<ConnectionState> {
    return ipcRenderer.invoke('daemon:state') as Promise<ConnectionState>
  },

  log(category: string, message: string, data?: Record<string, unknown>): void {
    console.log(`[${category}] ${message}`, data ?? '')
    ipcRenderer.send('daemon:log', category, message, data)
  },

  onNotification(callback: NotificationCallback): void {
    notificationCallbacks.add(callback)
  },

  offNotification(callback: NotificationCallback): void {
    notificationCallbacks.delete(callback)
  },

  onStateChange(callback: StateChangeCallback): void {
    stateChangeCallbacks.add(callback)
  },

  offStateChange(callback: StateChangeCallback): void {
    stateChangeCallbacks.delete(callback)
  },

  showSaveDialog(defaultName: string, filters: { name: string; extensions: string[] }[]): Promise<string | null> {
    return ipcRenderer.invoke('dialog:save', defaultName, filters) as Promise<string | null>
  },

  showOpenDialog(): Promise<Array<{
    draftId: string
    filePath: string
    fileName: string
    mimeType: string
    size: number
  }>> {
    return ipcRenderer.invoke('dialog:open-files') as Promise<Array<{
      draftId: string
      filePath: string
      fileName: string
      mimeType: string
      size: number
    }>>
  },

  registerDraftFiles(filePaths: string[]): Promise<Array<{
    draftId: string
    filePath: string
    fileName: string
    mimeType: string
    size: number
  }>> {
    return ipcRenderer.invoke('draft:register-files', filePaths) as Promise<Array<{
      draftId: string
      filePath: string
      fileName: string
      mimeType: string
      size: number
    }>>
  },

  registerClipboardImage(buffer: ArrayBuffer, fileName: string, mimeType: string): Promise<{
    draftId: string
    filePath: string
    fileName: string
    mimeType: string
    size: number
  }> {
    return ipcRenderer.invoke('draft:register-clipboard', buffer, fileName, mimeType) as Promise<{
      draftId: string
      filePath: string
      fileName: string
      mimeType: string
      size: number
    }>
  },

  cleanupDrafts(draftIds: string[]): void {
    ipcRenderer.send('draft:cleanup', draftIds)
  },

  writeFile(filePath: string, content: string): Promise<void> {
    return ipcRenderer.invoke('fs:writeFile', filePath, content) as Promise<void>
  },

  saveAttachment(partId: number, messageId: number): Promise<{ saved: boolean; path?: string }> {
    return ipcRenderer.invoke('attachment:save', partId, messageId) as Promise<{ saved: boolean; path?: string }>
  },

  showAttachmentContextMenu(partId: number, messageId: number): void {
    ipcRenderer.send('attachment:context-menu', partId, messageId)
  },

  showGalleryContextMenu(filePath: string): void {
    ipcRenderer.send('gallery:context-menu', filePath)
  },

  saveGalleryFile(filePath: string): void {
    ipcRenderer.send('gallery:save', filePath)
  },

  fetchLinkPreview(url: string): Promise<unknown> {
    return ipcRenderer.invoke('link-preview:fetch', url)
  },

  flashTaskbar(flash: boolean): void {
    ipcRenderer.send('window:flash-frame', flash)
  },

  openExternal(url: string): void {
    ipcRenderer.send('shell:open-external', url)
  },

  openWebdav(port: number): void {
    ipcRenderer.send('shell:open-webdav', port)
  },

  openWebdavFolder(port: number, folderPath: string): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke('shell:open-webdav-folder', port, folderPath)
  },

  closeWebdav(port: number): void {
    ipcRenderer.send('shell:close-webdav', port)
  },

  checkForUpdates(): Promise<unknown> {
    return ipcRenderer.invoke('updater:check')
  },

  downloadUpdate(): Promise<unknown> {
    return ipcRenderer.invoke('updater:download')
  },

  installUpdate(): Promise<void> {
    return ipcRenderer.invoke('updater:install') as Promise<void>
  },

  getUpdateStatus(): Promise<unknown> {
    return ipcRenderer.invoke('updater:get-status')
  },

  getAppVersion(): Promise<string> {
    return ipcRenderer.invoke('updater:get-version') as Promise<string>
  },

  onUpdateStatus(callback: UpdateStatusCallback): void {
    updateStatusCallbacks.add(callback)
  },

  offUpdateStatus(callback: UpdateStatusCallback): void {
    updateStatusCallbacks.delete(callback)
  },

  onTelIncoming(callback: (phoneNumber: string) => void): void {
    telIncomingCallbacks.add(callback)
  },

  offTelIncoming(callback: (phoneNumber: string) => void): void {
    telIncomingCallbacks.delete(callback)
  },
}

contextBridge.exposeInMainWorld('api', api)
