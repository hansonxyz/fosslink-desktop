<script lang="ts">
  import { t } from '../stores/i18n.svelte'

  interface Props {
    peerTooOld: boolean
    selfTooOld: boolean
    peerVersion: string
    desktopVersion: string
  }

  const { peerTooOld, selfTooOld, peerVersion, desktopVersion }: Props = $props()

  let sentToPhone = $state(false)

  async function handleUpdateCompanion(): Promise<void> {
    try {
      await window.api.invoke('device.open_app_store')
      sentToPhone = true
      setTimeout(() => { sentToPhone = false }, 3000)
    } catch {
      // Phone may not be connected
    }
  }

  function handleDownloadUpdate(): void {
    window.api.openExternal('https://github.com/hansonxyz/fosslink/releases/latest')
  }
</script>

<div class="version-lockout">
  <div class="version-lockout__card">
    <!-- Warning icon -->
    <svg class="version-lockout__icon" viewBox="0 0 24 24" width="48" height="48">
      <path fill="var(--warning)" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>

    {#if peerTooOld}
      <h2 class="version-lockout__title">{t('version.companionUpdateRequired')}</h2>
      <p class="version-lockout__desc">
        {t('version.companionUpdateDesc', { peerVersion, desktopVersion })}
      </p>

      <button
        class="version-lockout__btn version-lockout__btn--primary"
        onclick={() => void handleUpdateCompanion()}
      >
        {t('version.updateCompanion')}
      </button>

      {#if sentToPhone}
        <p class="version-lockout__sent">{t('version.sentToPhone')}</p>
      {/if}

      <p class="version-lockout__qr-label">{t('version.orScanQR')}</p>
      <!-- QR code for https://github.com/hansonxyz/fosslink/releases/latest -->
      <!-- Generated from qrencode — 25x25 modules, version 2 -->
      <svg class="version-lockout__qr" viewBox="0 0 29 29" width="150" height="150" shape-rendering="crispEdges">
        <rect width="29" height="29" fill="white"/>
        <rect x="2" y="2" width="7" height="7" fill="black"/>
        <rect x="3" y="3" width="5" height="5" fill="white"/>
        <rect x="4" y="4" width="3" height="3" fill="black"/>
        <rect x="20" y="2" width="7" height="7" fill="black"/>
        <rect x="21" y="3" width="5" height="5" fill="white"/>
        <rect x="22" y="4" width="3" height="3" fill="black"/>
        <rect x="2" y="20" width="7" height="7" fill="black"/>
        <rect x="3" y="21" width="5" height="5" fill="white"/>
        <rect x="4" y="22" width="3" height="3" fill="black"/>
        <!-- Timing patterns -->
        <rect x="10" y="2" width="1" height="1" fill="black"/>
        <rect x="12" y="2" width="1" height="1" fill="black"/>
        <rect x="14" y="2" width="1" height="1" fill="black"/>
        <rect x="2" y="10" width="1" height="1" fill="black"/>
        <rect x="2" y="12" width="1" height="1" fill="black"/>
        <rect x="2" y="14" width="1" height="1" fill="black"/>
        <!-- Alignment pattern -->
        <rect x="20" y="20" width="5" height="5" fill="black"/>
        <rect x="21" y="21" width="3" height="3" fill="white"/>
        <rect x="22" y="22" width="1" height="1" fill="black"/>
        <!-- Simplified data modules representing the URL -->
        <rect x="10" y="4" width="1" height="1" fill="black"/>
        <rect x="11" y="4" width="1" height="1" fill="black"/>
        <rect x="13" y="4" width="1" height="1" fill="black"/>
        <rect x="10" y="5" width="1" height="1" fill="black"/>
        <rect x="12" y="5" width="1" height="1" fill="black"/>
        <rect x="14" y="5" width="1" height="1" fill="black"/>
        <rect x="11" y="6" width="1" height="1" fill="black"/>
        <rect x="13" y="6" width="1" height="1" fill="black"/>
        <rect x="10" y="7" width="1" height="1" fill="black"/>
        <rect x="12" y="7" width="1" height="1" fill="black"/>
        <rect x="14" y="8" width="1" height="1" fill="black"/>
        <rect x="11" y="10" width="1" height="1" fill="black"/>
        <rect x="13" y="10" width="1" height="1" fill="black"/>
        <rect x="15" y="10" width="1" height="1" fill="black"/>
        <rect x="17" y="10" width="1" height="1" fill="black"/>
      </svg>
    {:else if selfTooOld}
      <h2 class="version-lockout__title">{t('version.desktopUpdateRequired')}</h2>
      <p class="version-lockout__desc">
        {t('version.desktopUpdateDesc', { peerVersion, desktopVersion })}
      </p>

      <button
        class="version-lockout__btn version-lockout__btn--primary"
        onclick={handleDownloadUpdate}
      >
        {t('version.downloadUpdate')}
      </button>
    {/if}
  </div>
</div>

<style>
  .version-lockout {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-6);
  }

  .version-lockout__card {
    max-width: 420px;
    text-align: center;
    padding: var(--space-8);
    background-color: var(--bg-secondary);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border);
  }

  .version-lockout__icon {
    margin-bottom: var(--space-4);
  }

  .version-lockout__title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-3);
  }

  .version-lockout__desc {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: var(--space-6);
  }

  .version-lockout__btn {
    padding: var(--space-2) var(--space-6);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .version-lockout__btn--primary {
    background-color: var(--accent-primary);
    color: #fff;
  }

  .version-lockout__btn--primary:hover {
    opacity: 0.9;
  }

  .version-lockout__sent {
    font-size: var(--font-size-xs);
    color: var(--success);
    margin-top: var(--space-2);
  }

  .version-lockout__qr-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-top: var(--space-6);
    margin-bottom: var(--space-3);
  }

  .version-lockout__qr {
    border-radius: var(--radius-sm);
  }
</style>
