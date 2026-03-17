<script lang="ts">
  import {
    devices,
    requestPairing,
    unpairDevice
  } from '../stores/devices.svelte'
  import { t } from '../stores/i18n.svelte'

  function isPaired(deviceId: string): boolean {
    return devices.pairedIds.includes(deviceId)
  }

  const pairedDiscovered = $derived(
    devices.discovered.filter((d) => isPaired(d.deviceId))
  )

  const pairedOffline = $derived(
    devices.pairedIds.filter((id) => !devices.discovered.some((d) => d.deviceId === id))
  )

  const unpaired = $derived(
    devices.discovered.filter((d) => !isPaired(d.deviceId))
  )
</script>

{#if devices.pairedIds.length > 0}
  <div class="device-list__section">
    <h3 class="device-list__section-title">{t('devices.pairedDevices')}</h3>
    {#each pairedDiscovered as device (device.deviceId)}
      <div class="device-list__item device-list__item--paired">
        <div class="device-list__info">
          <span class="device-list__name">{device.deviceName}</span>
          <span class="device-list__meta">{device.address}</span>
        </div>
        <button
          class="device-list__btn device-list__btn--danger"
          onclick={() => unpairDevice(device.deviceId)}
        >
          {t('devices.unpair')}
        </button>
      </div>
    {/each}
    {#each pairedOffline as deviceId (deviceId)}
      <div class="device-list__item device-list__item--offline">
        <div class="device-list__info">
          <span class="device-list__name device-list__name--muted">
            {deviceId.substring(0, 8)}...
          </span>
          <span class="device-list__meta">{t('devices.offline')}</span>
        </div>
        <button
          class="device-list__btn device-list__btn--danger"
          onclick={() => unpairDevice(deviceId)}
        >
          {t('devices.unpair')}
        </button>
      </div>
    {/each}
  </div>
{/if}

<div class="device-list__section">
  <h3 class="device-list__section-title">{t('devices.nearbyDevices')}</h3>
  {#each unpaired as device (device.deviceId)}
    <div class="device-list__item">
      <div class="device-list__info">
        <span class="device-list__name">{device.deviceName}</span>
        <span class="device-list__meta">{device.deviceType} &middot; {device.address}</span>
      </div>
      <button
        class="device-list__btn device-list__btn--primary"
        onclick={() => requestPairing(device.deviceId)}
      >
        {t('devices.pair')}
      </button>
    </div>
  {:else}
    <p class="device-list__empty">{t('devices.noDevices')}</p>
  {/each}
</div>

<style>
  .device-list__section {
    margin-bottom: var(--space-6);
  }

  .device-list__section-title {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-3);
  }

  .device-list__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    transition: background-color 0.15s;
  }

  .device-list__item:hover {
    background-color: var(--bg-hover);
  }

  .device-list__item--offline {
    opacity: 0.6;
  }

  .device-list__info {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .device-list__name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .device-list__name--muted {
    color: var(--text-muted);
    font-family: monospace;
    font-size: var(--font-size-sm);
  }

  .device-list__meta {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .device-list__btn {
    flex-shrink: 0;
    padding: var(--space-1) var(--space-3);
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .device-list__btn--primary {
    background-color: var(--accent-primary);
    color: #fff;
  }

  .device-list__btn--primary:hover {
    background-color: #4a7ddf;
  }

  .device-list__btn--danger {
    background-color: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }

  .device-list__btn--danger:hover {
    background-color: var(--danger);
    color: #fff;
    border-color: var(--danger);
  }

  .device-list__empty {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    padding: var(--space-4);
    text-align: center;
  }
</style>
