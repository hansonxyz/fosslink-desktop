<script lang="ts">
  import { effectiveState, syncProgress, connection, orchestratorSyncing } from '../stores/connection.svelte'
  import { devices } from '../stores/devices.svelte'
  import { battery } from '../stores/battery.svelte'
  import { t } from '../stores/i18n.svelte'
  import { GITHUB_DESKTOP_URL } from '../lib/links'

  const stateColors: Record<EffectiveState, 'red' | 'yellow' | 'green'> = {
    'no-daemon': 'red',
    disconnected: 'red',
    discovering: 'yellow',
    pairing: 'yellow',
    connected: 'green',
    syncing: 'yellow',
    ready: 'green',
    error: 'red',
  }

  const stateKeys: Record<EffectiveState, string> = {
    'no-daemon': 'status.noDaemon',
    disconnected: 'status.disconnected',
    discovering: 'status.discovering',
    pairing: 'status.pairing',
    connected: 'status.connected',
    syncing: 'status.syncing',
    ready: 'status.ready',
    error: 'status.error',
  }

  // Phone reconnects every ~5s causing effectiveState to cycle through
  // discovering/disconnected/syncing. Use sticky logic:
  // - Once initial sync completes (ready), always show "Device connected"
  // - Only show "Syncing..." during the very first sync of a session
  // - Grace period before degrading to disconnected states
  const GOOD_STATES: Set<EffectiveState> = new Set(['connected', 'syncing', 'ready'])
  const GRACE_MS = 15_000

  let displayState = $state<EffectiveState>(effectiveState.current)
  let initialSyncDone = $state(false)
  let degradeTimer: ReturnType<typeof setTimeout> | undefined

  // Reset initialSyncDone when unpaired (no paired devices)
  $effect(() => {
    if (devices.pairedIds.length === 0) {
      initialSyncDone = false
    }
  })

  $effect(() => {
    const state = effectiveState.current

    // Once we've reached 'ready' or 'connected' after syncing, initial sync is done
    if (state === 'ready' || (initialSyncDone && GOOD_STATES.has(state))) {
      initialSyncDone = true
    }

    if (GOOD_STATES.has(state)) {
      clearTimeout(degradeTimer)
      degradeTimer = undefined
      // After initial sync, collapse ready/connected to 'connected'
      // but still show 'syncing' when a manual or reconnect sync is active
      displayState = (initialSyncDone && state !== 'syncing') ? 'connected' : state
    } else if (GOOD_STATES.has(displayState) || displayState === 'connected') {
      // Was in a good state — delay before showing degraded state
      if (degradeTimer === undefined) {
        degradeTimer = setTimeout(() => {
          degradeTimer = undefined
          displayState = effectiveState.current
        }, GRACE_MS)
      }
    } else {
      // Not in a good state and wasn't before — show immediately
      displayState = state
    }
  })

  // Orchestrator syncing flag overrides the display state when connected
  const showSyncing = $derived(
    orchestratorSyncing.active && GOOD_STATES.has(effectiveState.current)
  )

  const config = $derived({
    color: showSyncing ? 'yellow' as const : stateColors[displayState],
    label: showSyncing
      ? (syncProgress.percent !== null ? `${t('status.syncing')} ${syncProgress.percent}%` : t('status.syncing'))
      : t(stateKeys[displayState]),
  })

  const batteryColor = $derived(
    battery.charging || battery.charge > 20 ? 'var(--success)' : 'var(--danger)'
  )
  const batteryFill = $derived(Math.max(0, Math.min(100, battery.charge)))

  const versionMismatch = $derived(
    connection.stateContext?.versionCompatible === false &&
    connection.stateContext?.peerClientType === 'fosslink'
  )

  const versionLabel = $derived(
    connection.stateContext?.selfTooOld
      ? t('version.outdatedStatus')
      : connection.stateContext?.peerTooOld
        ? t('version.companionOutdatedStatus')
        : ''
  )

  function handleVersionClick(): void {
    if (connection.stateContext?.selfTooOld) {
      window.api.openExternal(GITHUB_DESKTOP_URL + '/releases')
    } else {
      window.dispatchEvent(new Event('fosslink:version-click'))
    }
  }
</script>

<div class="status-indicator">
  <div class="status-indicator__left">
    {#if versionMismatch}
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <span class="status-indicator__version-warn" onclick={handleVersionClick}>
        <span class="status-indicator__dot status-indicator__dot--yellow"></span>
        <span class="status-indicator__label status-indicator__label--clickable">{versionLabel}</span>
      </span>
    {:else}
      <span
        class="status-indicator__dot"
        class:status-indicator__dot--red={config.color === 'red'}
        class:status-indicator__dot--yellow={config.color === 'yellow'}
        class:status-indicator__dot--green={config.color === 'green'}
      ></span>
      <span class="status-indicator__label">{config.label}</span>
    {/if}
  </div>
  {#if battery.charge >= 0}
    <div class="status-indicator__battery">
      <svg viewBox="0 0 28 14" width="22" height="11" class="battery-icon">
        <!-- Battery outline -->
        <rect x="0.5" y="0.5" width="23" height="13" rx="2" ry="2"
          fill="none" stroke="var(--text-muted)" stroke-width="1" />
        <!-- Battery cap -->
        <rect x="24" y="4" width="3" height="6" rx="1" ry="1"
          fill="var(--text-muted)" />
        <!-- Battery fill -->
        <rect x="2" y="2" width={19 * batteryFill / 100} height="10" rx="1" ry="1"
          fill={batteryColor} />
        <!-- Charging bolt -->
        {#if battery.charging}
          <polygon points="14,1 9,7.5 12,7.5 10,13 16,6.5 13,6.5" fill="#F5C542" />
        {/if}
      </svg>
      <span class="battery-label">{battery.charge}%</span>
    </div>
  {/if}
</div>

<style>
  .status-indicator {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .status-indicator__left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .status-indicator__battery {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .battery-icon {
    flex-shrink: 0;
  }

  .battery-label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .status-indicator__dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
  }

  .status-indicator__dot--red {
    background-color: var(--danger);
  }

  .status-indicator__dot--yellow {
    background-color: var(--warning);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .status-indicator__dot--green {
    background-color: var(--success);
  }

  .status-indicator__label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .status-indicator__version-warn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
  }

  .status-indicator__label--clickable {
    cursor: pointer;
  }

  .status-indicator__label--clickable:hover {
    color: var(--text-primary);
    text-decoration: underline;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
</style>
