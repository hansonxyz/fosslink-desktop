<script lang="ts">
  interface Props {
    onClose: () => void
  }

  import { t } from '../stores/i18n.svelte'

  let { onClose }: Props = $props()

  let url = $state('')
  let error = $state('')
  let sending = $state(false)

  function isValidUrl(value: string): boolean {
    return value.startsWith('http://') || value.startsWith('https://')
  }

  async function handleShare(): Promise<void> {
    if (!isValidUrl(url)) {
      error = t('shareUrl.invalidUrl')
      return
    }
    sending = true
    try {
      await window.api.invoke('url.share', { url })
      onClose()
    } catch {
      error = 'Failed to share URL'
    } finally {
      sending = false
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !sending) {
      void handleShare()
    }
  }

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="share-overlay" onclick={handleBackdropClick}>
  <div class="share-dialog">
    <h3 class="share-dialog__title">{t('shareUrl.title')}</h3>
    <input
      class="share-dialog__input"
      type="url"
      placeholder={t('shareUrl.placeholder')}
      bind:value={url}
      onkeydown={handleKeydown}
      oninput={() => { error = '' }}
      autofocus
    />
    {#if error}
      <p class="share-dialog__error">{error}</p>
    {/if}
    <div class="share-dialog__actions">
      <button class="share-dialog__btn share-dialog__btn--cancel" onclick={onClose}>
        {t('shareUrl.cancel')}
      </button>
      <button
        class="share-dialog__btn share-dialog__btn--share"
        onclick={() => void handleShare()}
        disabled={sending || !url.trim()}
      >
        {t('shareUrl.share')}
      </button>
    </div>
  </div>
</div>

<style>
  .share-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .share-dialog {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    max-width: 420px;
    width: 90vw;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  }

  .share-dialog__title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin: 0 0 var(--space-4);
  }

  .share-dialog__input {
    width: 100%;
    background-color: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }

  .share-dialog__input:focus {
    border-color: var(--accent-primary);
  }

  .share-dialog__error {
    font-size: var(--font-size-xs);
    color: var(--danger);
    margin: var(--space-2) 0 0;
  }

  .share-dialog__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  .share-dialog__btn {
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .share-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .share-dialog__btn--cancel {
    background-color: var(--bg-surface);
    color: var(--text-secondary);
  }

  .share-dialog__btn--cancel:hover {
    background-color: var(--bg-hover);
  }

  .share-dialog__btn--share {
    background-color: var(--accent-primary);
    color: #fff;
  }

  .share-dialog__btn--share:hover:not(:disabled) {
    opacity: 0.9;
  }
</style>
