import { Daemon } from '@daemon/core/daemon'
import { createMethodMap, wireNotifications } from '@daemon/ipc/handlers'
import type { MethodHandler } from '@daemon/ipc/handlers'
import { setLogTap, clearLogTap } from '@daemon/utils/logger'
import { log } from './logger'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected'

type NotificationCallback = (method: string, params: unknown) => void
type StateChangeCallback = (state: ConnectionState) => void
type LogCallback = (level: string, category: string, msg: string, data?: Record<string, unknown>) => void

/**
 * In-process daemon bridge for embedded mode.
 * Same callback interface as DaemonClient (socket-based),
 * but runs the daemon directly in the Electron main process.
 */
export class DaemonBridge {
  private daemon: Daemon
  private methods: Map<string, MethodHandler> | undefined
  private state: ConnectionState = 'disconnected'
  private notificationCallbacks: NotificationCallback[] = []
  private stateChangeCallbacks: StateChangeCallback[] = []
  private logCallbacks: LogCallback[] = []
  private daemonLogPath: string | undefined

  constructor(options?: { daemonLogPath?: string }) {
    this.daemon = new Daemon()
    this.daemonLogPath = options?.daemonLogPath
  }

  connect(): void {
    if (this.state !== 'disconnected') return

    this.setState('connecting')

    // Async init+start — fire and forget, emit state changes
    void this.startDaemon().catch((err) => {
      log('daemon-bridge', 'Failed to start embedded daemon', {
        error: err instanceof Error ? err.message : String(err),
      })
      this.setState('disconnected')
    })
  }

  private async startDaemon(): Promise<void> {
    await this.daemon.init({ logToFile: true, logFilePath: this.daemonLogPath })
    await this.daemon.start({
      skipPidFile: true,
      skipSignalHandlers: true,
      skipIpcServer: true,
      skipKeepalive: true,
    })

    this.methods = createMethodMap(this.daemon)
    wireNotifications(this.daemon, (method, params) => {
      for (const cb of this.notificationCallbacks) {
        cb(method, params)
      }
    })

    setLogTap((level, category, msg, data) => {
      for (const cb of this.logCallbacks) {
        cb(level, category, msg, data)
      }
    })

    this.setState('connected')
    log('daemon-bridge', 'Embedded daemon started')
  }

  async disconnect(): Promise<void> {
    clearLogTap()
    this.methods = undefined
    this.setState('disconnected')
    await this.daemon.stop()
  }

  isConnected(): boolean {
    return this.state === 'connected'
  }

  /** Ping all WebSocket connections immediately. Stale ones will be terminated. */
  checkConnections(): void {
    try {
      this.daemon.getWsServer()?.pingAll()
    } catch {
      // Daemon may not be fully initialized
    }
  }

  getState(): ConnectionState {
    return this.state
  }

  call(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.methods || this.state !== 'connected') {
      return Promise.reject(new Error('Not connected'))
    }
    const handler = this.methods.get(method)
    if (!handler) {
      return Promise.reject(new Error(`Unknown method: ${method}`))
    }
    return handler(params)
  }

  onNotification(callback: NotificationCallback): void {
    this.notificationCallbacks.push(callback)
  }

  onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.push(callback)
  }

  onLog(callback: LogCallback): void {
    this.logCallbacks.push(callback)
  }

  private setState(state: ConnectionState): void {
    if (this.state === state) return
    this.state = state
    for (const cb of this.stateChangeCallbacks) {
      cb(state)
    }
  }
}
