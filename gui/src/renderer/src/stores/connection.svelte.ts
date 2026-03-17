/**
 * Connection Store
 *
 * Tracks both the daemon socket connection state and the daemon's
 * application state, combining them into a single effective state
 * that drives all UI routing.
 */

const APP_STATE_MAP: Record<AppState, EffectiveState> = {
  INIT: 'disconnected',
  DISCONNECTED: 'disconnected',
  DISCOVERING: 'discovering',
  PAIRING: 'pairing',
  CONNECTED: 'connected',
  SYNCING: 'syncing',
  READY: 'ready',
  ERROR: 'error'
}

// Reactive state object — mutate properties, never reassign the export
export const connection = $state({
  socketState: 'disconnected' as ConnectionState,
  appState: null as AppState | null,
  stateContext: null as StateContext | null
})

/** Sync progress percentage (0-100), null when not syncing */
export const syncProgress = $state({ percent: null as number | null })

// Derived effective state combining socket + app state
export const effectiveState: { current: EffectiveState } = {
  get current(): EffectiveState {
    if (connection.socketState !== 'connected' || connection.appState === null) {
      return 'no-daemon'
    }
    return APP_STATE_MAP[connection.appState] ?? 'disconnected'
  }
}

async function syncState(): Promise<void> {
  window.api.log('renderer', 'syncState called')
  const state = await window.api.getConnectionState()
  window.api.log('renderer', 'getConnectionState returned', { state })
  connection.socketState = state

  if (state === 'connected') {
    const status = (await window.api.invoke('daemon.status')) as DaemonStatus
    window.api.log('renderer', 'daemon.status returned', { appState: status.state })
    connection.appState = status.state

    const ctx = (await window.api.invoke('state.context')) as StateContext
    connection.stateContext = ctx
    window.api.log('renderer', 'State synced', { effectiveState: APP_STATE_MAP[status.state] })
  }
}

/**
 * Initialize the connection store. Call from App.svelte onMount.
 * Returns a cleanup function to unregister listeners.
 */
export function initConnectionStore(): () => void {
  const handleSocketStateChange = (state: ConnectionState): void => {
    connection.socketState = state

    if (state === 'connected') {
      void syncState().catch(() => {})
    } else {
      connection.appState = null
      connection.stateContext = null
    }
  }

  const handleNotification = (method: string, params: unknown): void => {
    if (method === 'state.changed') {
      const data = params as StateChangeNotification
      connection.appState = data.to as AppState
      connection.stateContext = data.context
      // Clear progress when leaving syncing state
      if (data.to !== 'SYNCING') {
        syncProgress.percent = null
      }
    } else if (method === 'sync.progress') {
      const data = params as { percent: number }
      syncProgress.percent = data.percent
    } else if (method === 'sync.completed') {
      syncProgress.percent = null
    }
  }

  window.api.onStateChange(handleSocketStateChange)
  window.api.onNotification(handleNotification)

  // Poll every second until we have a valid state.
  // The bridge may emit 'connected' before the renderer mounts,
  // so the IPC message gets lost. This catches up within 1s.
  const pollTimer = setInterval(() => {
    if (connection.socketState === 'connected' && connection.appState !== null) {
      window.api.log('renderer', 'Poll complete, state synced', {
        socketState: connection.socketState,
        appState: connection.appState,
      })
      clearInterval(pollTimer)
      return
    }
    void syncState().catch((err) => {
      window.api.log('renderer', 'syncState poll error', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }, 1000)

  // Immediate first attempt
  window.api.log('renderer', 'initConnectionStore called, starting sync')
  void syncState().catch((err) => {
    window.api.log('renderer', 'syncState initial error', {
      error: err instanceof Error ? err.message : String(err),
    })
  })

  return () => {
    clearInterval(pollTimer)
    window.api.offStateChange(handleSocketStateChange)
    window.api.offNotification(handleNotification)
  }
}
