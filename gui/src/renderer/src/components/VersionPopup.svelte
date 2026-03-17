<script lang="ts">
  import { t } from '../stores/i18n.svelte'
  import { GITHUB_DESKTOP_URL } from '../lib/links'

  interface Props {
    peerTooOld: boolean
    selfTooOld: boolean
    peerVersion: string
    desktopVersion: string
    onClose: () => void
  }

  const { peerTooOld, selfTooOld, peerVersion, desktopVersion, onClose }: Props = $props()

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
    window.api.openExternal(GITHUB_DESKTOP_URL + '/releases')
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose()
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="version-overlay" onclick={handleBackdropClick}>
  <div class="version-dialog">
    <svg class="version-dialog__icon" viewBox="0 0 24 24" width="40" height="40">
      <path fill="var(--warning)" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>

    {#if selfTooOld}
      <h3 class="version-dialog__title">{t('version.desktopUpdateRequired')}</h3>
      <p class="version-dialog__desc">
        {t('version.desktopUpdateDesc', { peerVersion, desktopVersion })}
      </p>
      <div class="version-dialog__actions">
        <button class="version-dialog__btn version-dialog__btn--primary" onclick={handleDownloadUpdate}>
          {t('version.downloadUpdate')}
        </button>
        <button class="version-dialog__btn" onclick={onClose}>{t('version.dismiss')}</button>
      </div>
    {:else if peerTooOld}
      <h3 class="version-dialog__title">{t('version.companionUpdateRequired')}</h3>
      <p class="version-dialog__desc">
        {t('version.companionUpdateDesc', { peerVersion, desktopVersion })}
      </p>
      <div class="version-dialog__actions">
        <button class="version-dialog__btn version-dialog__btn--primary" onclick={() => void handleUpdateCompanion()}>
          {t('version.updateCompanion')}
        </button>
        <button class="version-dialog__btn" onclick={onClose}>{t('version.dismiss')}</button>
      </div>
      {#if sentToPhone}
        <p class="version-dialog__sent">{t('version.sentToPhone')}</p>
      {/if}
    {/if}
  </div>
</div>

<style>
  .version-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .version-dialog {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    max-width: 420px;
    width: 90vw;
    text-align: center;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  }

  .version-dialog__icon {
    margin-bottom: var(--space-3);
  }

  .version-dialog__title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-2);
  }

  .version-dialog__desc {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: var(--space-4);
  }

  .version-dialog__actions {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
  }

  .version-dialog__btn {
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    background: var(--bg-primary);
    color: var(--text-secondary);
  }

  .version-dialog__btn--primary {
    background-color: var(--accent-primary);
    color: #fff;
    border-color: var(--accent-primary);
  }

  .version-dialog__sent {
    font-size: var(--font-size-xs);
    color: var(--success);
    margin-top: var(--space-2);
  }
</style>
