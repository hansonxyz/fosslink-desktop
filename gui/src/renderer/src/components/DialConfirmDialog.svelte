<script lang="ts">
  import { formatPhone } from '../lib/phone'
  import { t } from '../stores/i18n.svelte'

  interface Props {
    phoneNumber: string
    onConfirm: () => void
    onCancel: () => void
  }

  const { phoneNumber, onConfirm, onCancel }: Props = $props()

  const formatted = $derived(formatPhone(phoneNumber))

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      onCancel()
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') onCancel()
    if (e.key === 'Enter') onConfirm()
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="dial-overlay" onclick={handleBackdropClick}>
  <div class="dial-dialog">
    <div class="dial-dialog__icon">
      <svg viewBox="0 0 24 24" width="32" height="32">
        <path fill="currentColor" d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
      </svg>
    </div>
    <p class="dial-dialog__text">
      {t('dial.confirm', { number: formatted })}
    </p>
    <div class="dial-dialog__actions">
      <button class="dial-dialog__btn dial-dialog__btn--cancel" onclick={onCancel}>
        {t('dial.cancel')}
      </button>
      <button class="dial-dialog__btn dial-dialog__btn--ok" onclick={onConfirm}>
        {t('dial.ok')}
      </button>
    </div>
  </div>
</div>

<style>
  .dial-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dial-dialog {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    max-width: 360px;
    width: 90vw;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
    text-align: center;
  }

  .dial-dialog__icon {
    color: var(--accent-primary);
    margin-bottom: var(--space-3);
  }

  .dial-dialog__text {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    margin: 0 0 var(--space-5);
    line-height: 1.5;
  }

  .dial-dialog__actions {
    display: flex;
    justify-content: center;
    gap: var(--space-3);
  }

  .dial-dialog__btn {
    padding: var(--space-2) var(--space-5);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background-color 0.15s;
    min-width: 80px;
  }

  .dial-dialog__btn--cancel {
    background-color: var(--bg-surface);
    color: var(--text-secondary);
  }

  .dial-dialog__btn--cancel:hover {
    background-color: var(--bg-hover);
  }

  .dial-dialog__btn--ok {
    background-color: var(--accent-primary);
    color: #fff;
  }

  .dial-dialog__btn--ok:hover {
    opacity: 0.9;
  }
</style>
