<script lang="ts">
  interface Props {
    onClose: () => void
  }

  import { t } from '../stores/i18n.svelte'

  const { onClose }: Props = $props()

  let state: 'confirm' | 'ringing' | 'error' = $state('confirm')
  let errorMsg = $state('')

  async function ring(): Promise<void> {
    state = 'ringing'
    try {
      await window.api.invoke('phone.ring')
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err)
      state = 'error'
    }
  }
</script>

<div class="find-phone">
  <button class="find-phone__close" onclick={onClose} title={t('findPhone.close')}>
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  </button>

  {#if state === 'confirm'}
    <div class="find-phone__icon">
      <svg viewBox="0 0 24 24" width="64" height="64">
        <path fill="currentColor" d="M15.05 5A7 7 0 0119 11.95l2-.05A9 9 0 0013.05 3v2zm-2 0A5 5 0 0117 8.95l2-.05A7 7 0 0011.05 3v2zM20.29 17.29l-3.71-3.71a1 1 0 00-1.41 0l-2.83 2.83a14.9 14.9 0 01-4.95-4.95l2.83-2.83a1 1 0 000-1.41l-3.71-3.71a1 1 0 00-1.41 0L3.44 5.15a2 2 0 00-.55 1.57 18.85 18.85 0 0014.39 14.39 2 2 0 001.57-.55l1.73-1.86a1 1 0 00-.29-1.41z"/>
      </svg>
    </div>
    <h2 class="find-phone__title">{t('findPhone.title')}</h2>
    <p class="find-phone__desc">{t('findPhone.description')}</p>
    <button class="find-phone__btn find-phone__btn--primary" onclick={ring}>
      {t('findPhone.ring')}
    </button>

  {:else if state === 'ringing'}
    <div class="find-phone__icon find-phone__icon--ringing">
      <svg viewBox="0 0 24 24" width="64" height="64">
        <path fill="currentColor" d="M15.05 5A7 7 0 0119 11.95l2-.05A9 9 0 0013.05 3v2zm-2 0A5 5 0 0117 8.95l2-.05A7 7 0 0011.05 3v2zM20.29 17.29l-3.71-3.71a1 1 0 00-1.41 0l-2.83 2.83a14.9 14.9 0 01-4.95-4.95l2.83-2.83a1 1 0 000-1.41l-3.71-3.71a1 1 0 00-1.41 0L3.44 5.15a2 2 0 00-.55 1.57 18.85 18.85 0 0014.39 14.39 2 2 0 001.57-.55l1.73-1.86a1 1 0 00-.29-1.41z"/>
      </svg>
    </div>
    <h2 class="find-phone__title">{t('findPhone.ringing')}</h2>
    <p class="find-phone__desc">{t('findPhone.ringingDesc')}</p>
    <button class="find-phone__btn find-phone__btn--secondary" onclick={() => (state = 'confirm')}>
      {t('findPhone.ringAgain')}
    </button>

  {:else}
    <div class="find-phone__icon">
      <svg viewBox="0 0 24 24" width="64" height="64">
        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
    </div>
    <h2 class="find-phone__title">{t('findPhone.errorTitle')}</h2>
    <p class="find-phone__desc">{errorMsg}</p>
    <button class="find-phone__btn find-phone__btn--primary" onclick={() => (state = 'confirm')}>
      {t('findPhone.tryAgain')}
    </button>
  {/if}
</div>

<style>
  .find-phone {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: var(--space-8);
    position: relative;
  }

  .find-phone__close {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    transition: color 0.15s, background-color 0.15s;
  }

  .find-phone__close:hover {
    color: var(--text-secondary);
    background-color: var(--bg-hover);
  }

  .find-phone__icon {
    color: var(--text-muted);
  }

  .find-phone__icon--ringing {
    color: var(--accent-primary);
    animation: ring-pulse 1s ease-in-out infinite;
  }

  .find-phone__title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .find-phone__desc {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    text-align: center;
    max-width: 300px;
  }

  .find-phone__btn {
    padding: var(--space-2) var(--space-6);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .find-phone__btn--primary {
    background-color: var(--accent-primary);
    color: white;
  }

  .find-phone__btn--primary:hover {
    background-color: var(--accent-hover);
  }

  .find-phone__btn--secondary {
    background-color: var(--bg-surface);
    color: var(--text-secondary);
  }

  .find-phone__btn--secondary:hover {
    background-color: var(--bg-hover);
  }

  @keyframes ring-pulse {
    0%, 100% { transform: rotate(0deg) scale(1); }
    15% { transform: rotate(15deg) scale(1.05); }
    30% { transform: rotate(-15deg) scale(1.05); }
    45% { transform: rotate(10deg) scale(1); }
    60% { transform: rotate(-10deg) scale(1); }
    75% { transform: rotate(5deg) scale(1); }
  }
</style>
