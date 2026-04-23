/// <reference types="svelte" />

declare const __DEV_BUILD__: boolean

// Socket-level connection state (from DaemonClient in main process)
type ConnectionState = 'disconnected' | 'connecting' | 'connected'

// Daemon application states (from state machine)
type AppState =
  | 'INIT'
  | 'DISCONNECTED'
  | 'DISCOVERING'
  | 'PAIRING'
  | 'CONNECTED'
  | 'SYNCING'
  | 'READY'
  | 'ERROR'

// Combined socket + daemon state for UI routing
type EffectiveState =
  | 'no-daemon'
  | 'disconnected'
  | 'discovering'
  | 'pairing'
  | 'connected'
  | 'syncing'
  | 'ready'
  | 'error'

// State context from daemon state machine
interface StateContext {
  deviceId?: string
  deviceName?: string
  errorCode?: string
  errorMessage?: string
  previousState?: AppState
  syncPhase?: 'conversations' | 'messages' | 'contacts' | 'attachments'
  pairingDeviceId?: string
  pairingDeviceName?: string
  peerClientType?: string
  peerClientVersion?: string
  peerMinPeerVersion?: string
  versionCompatible?: boolean
  peerTooOld?: boolean
  selfTooOld?: boolean
  peerRootEnabled?: boolean
  peerStorageTotalBytes?: number
  peerStorageFreeBytes?: number
  lastTransitionTime: number
  uptime: number
}

// Response from daemon.status
interface DaemonStatus {
  state: AppState
  pid: number
  uptime: number
  config: Record<string, unknown>
}

// Device discovered via UDP broadcast
interface DiscoveredDevice {
  deviceId: string
  deviceName: string
  deviceType: string
  protocolVersion: number
  tcpPort: number
  address: string
  lastSeen: number
}

// Incoming pairing request from phone
interface IncomingPairingRequest {
  deviceId: string
  deviceName: string
  timestamp: number
}

// Pairing result notification payload
interface PairingResult {
  deviceId: string
  success: boolean
  verificationKey?: string
}

// State change notification payload
interface StateChangeNotification {
  from: string
  to: string
  context: StateContext
  timestamp: number
}

// Database row types (mirror daemon database schema)
interface ConversationRow {
  thread_id: number
  addresses: string
  snippet: string | null
  date: number
  read: number
  unread_count: number
  locally_read_at: number | null
  has_outgoing: number
}

interface PhoneEntry {
  number: string
  type: string
}

interface EmailEntry {
  address: string
  type: string
}

interface AddressEntry {
  formatted: string
  type: string
}

interface ContactRow {
  uid: string
  name: string
  phone_numbers: string
  photo_path: string | null
  photo_mime: string | null
  emails: string | null
  addresses: string | null
  organization: string | null
  notes: string | null
  birthday: string | null
  nickname: string | null
  account_type: string | null
  account_name: string | null
  timestamp: number
}

// Database row for a single message
interface MessageRow {
  _id: number
  thread_id: number
  address: string
  body: string | null
  date: number
  type: number // 1=received, 2=sent
  read: number
  sub_id: number
  event: number
}

// Attachment metadata from daemon database
interface AttachmentInfo {
  partId: number
  messageId: number
  mimeType: string
  downloaded: boolean
  /** Category derived from mimeType */
  kind: 'image' | 'video' | 'audio' | 'other'
  /** Whether a thumbnail exists (for video: ffmpeg-generated WebP) */
  hasThumbnail: boolean
}

// iPhone tapback reaction parsed from SMS text
interface TapbackReaction {
  emoji: string
  senderName: string | null
}

// Enriched message for display in thread view
interface DisplayMessage {
  id: number
  threadId: number
  body: string
  date: number
  isSent: boolean
  senderName: string | null
  /** Show a centered timestamp badge above this message */
  showTimestamp: boolean
  /** Label for the timestamp badge (e.g. "Today 3:42 PM", "Wed, Jan 15, 2:10 PM") */
  timestampLabel: string
  attachments: AttachmentInfo[]
  /** iPhone tapback reactions matched to this message */
  reactions: TapbackReaction[]
}

// Enriched conversation for display
interface DisplayConversation {
  threadId: number
  addresses: string[]
  displayName: string
  snippet: string
  date: number
  read: boolean
  unreadCount: number
  isContact: boolean
  hasOutgoing: boolean
  avatarInitials: string
  avatarColor: string
  avatarPhoto: string | null
}

// A file picked by the user but not yet sent (MMS compose)
interface DraftAttachment {
  draftId: string
  filePath: string
  fileName: string
  mimeType: string
  size: number
  /** Category derived from mimeType */
  kind: 'image' | 'video' | 'audio' | 'other'
}

// Battery state from phone
interface BatteryInfo {
  charge: number // 0-100, or -1 if unknown
  charging: boolean
}

// Auto-updater status from main process
type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseNotes?: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number; transferred: number; total: number }
  | { state: 'downloaded'; version: string }
  | { state: 'installing'; percent: number; version: string }
  | { state: 'error'; message: string }

// Link preview metadata from Open Graph tags
interface LinkPreviewResult {
  url: string
  title: string | null
  description: string | null
  imageUrl: string | null
  imageLocalPath: string | null
  siteName: string | null
  status: 'ok' | 'error' | 'no-og'
  fetchedAt: number
}

// Preload API exposed via contextBridge
interface DaemonApi {
  invoke(method: string, params?: Record<string, unknown>): Promise<unknown>
  getConnectionState(): Promise<ConnectionState>
  log(category: string, message: string, data?: Record<string, unknown>): void
  onNotification(callback: (method: string, params: unknown) => void): void
  offNotification(callback: (method: string, params: unknown) => void): void
  onStateChange(callback: (state: ConnectionState) => void): void
  offStateChange(callback: (state: ConnectionState) => void): void
  showSaveDialog(defaultName: string, filters: { name: string; extensions: string[] }[]): Promise<string | null>
  showDirectoryDialog(title?: string): Promise<string | null>
  showOpenDialog(): Promise<Array<{
    draftId: string
    filePath: string
    fileName: string
    mimeType: string
    size: number
  }>>
  registerDraftFiles(filePaths: string[]): Promise<Array<{
    draftId: string
    filePath: string
    fileName: string
    mimeType: string
    size: number
  }>>
  registerClipboardImage(buffer: ArrayBuffer, fileName: string, mimeType: string): Promise<{
    draftId: string
    filePath: string
    fileName: string
    mimeType: string
    size: number
  }>
  cleanupDrafts(draftIds: string[]): void
  writeFile(filePath: string, content: string): Promise<void>
  saveAttachment(partId: number, messageId: number): Promise<{ saved: boolean; path?: string }>
  showAttachmentContextMenu(partId: number, messageId: number): void
  showGalleryContextMenu(filePath: string): void
  saveGalleryFile(filePath: string): void
  fetchLinkPreview(url: string): Promise<LinkPreviewResult>
  flashTaskbar(flash: boolean): void
  openExternal(url: string): void
  openWebdav(port: number): void
  openWebdavFolder(port: number, folderPath: string): Promise<{ ok: boolean; error?: string }>
  closeWebdav(port: number): void
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  installUpdate(): Promise<void>
  installNow(): Promise<void>
  getUpdateStatus(): Promise<UpdateStatus>
  getAppVersion(): Promise<string>
  onUpdateStatus(callback: (status: UpdateStatus) => void): void
  offUpdateStatus(callback: (status: UpdateStatus) => void): void
  onTelIncoming(callback: (phoneNumber: string) => void): void
  offTelIncoming(callback: (phoneNumber: string) => void): void
}

declare global {
  interface Window {
    api: DaemonApi
  }
}
