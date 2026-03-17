<script lang="ts">
  import { t } from '../stores/i18n.svelte'

  interface Props {
    onClose: () => void
  }

  const { onClose }: Props = $props()

  type Phase = 'idle' | 'scanning' | 'results' | 'migrating' | 'complete' | 'error'
  let phase = $state<Phase>('idle')

  interface DeviceContact {
    contactId: number
    rawContactId: number
    displayName: string
    phoneNumber: string
    accountType: string
    accountName: string
    selected: boolean
  }

  let contacts = $state<DeviceContact[]>([])
  let googleAccounts = $state<string[]>([])
  let selectedAccount = $state('')
  let error = $state('')
  let migrateResult = $state<{ migrated: number; failed: number; errors: string[] } | null>(null)

  const selectedCount = $derived(contacts.filter(c => c.selected).length)
  const allSelected = $derived(contacts.length > 0 && contacts.every(c => c.selected))

  function toggleAll(): void {
    const newState = !allSelected
    contacts = contacts.map(c => ({ ...c, selected: newState }))
  }

  async function scan(): Promise<void> {
    phase = 'scanning'
    error = ''
    try {
      const result = await window.api.invoke('contacts.migration_scan') as {
        contacts: Array<Omit<DeviceContact, 'selected'>>
        googleAccounts: string[]
        totalDeviceOnly: number
      }
      contacts = result.contacts.map(c => ({ ...c, selected: true }))
      googleAccounts = result.googleAccounts
      selectedAccount = googleAccounts[0] ?? ''
      if (contacts.length > 0) {
        phase = 'results'
      } else {
        migrateResult = { migrated: 0, failed: 0, errors: [] }
        phase = 'complete'
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      phase = 'error'
    }
  }

  async function migrate(): Promise<void> {
    if (selectedCount === 0 || !selectedAccount) return
    phase = 'migrating'
    try {
      const ids = contacts.filter(c => c.selected).map(c => c.rawContactId)
      const result = await window.api.invoke('contacts.migration_execute', {
        rawContactIds: ids,
        targetAccount: selectedAccount,
      }) as { migrated: number; failed: number; errors: string[] }
      migrateResult = result
      phase = 'complete'
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      phase = 'error'
    }
  }
</script>

<div class="migration">
  <div class="migration__header">
    <button class="migration__back" onclick={onClose}>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
    </button>
    <h2 class="migration__title">{t('migration.title')}</h2>
  </div>

  <div class="migration__content">
    {#if phase === 'idle'}
      <div class="migration__center">
        <div class="migration__icon">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
        </div>
        <p class="migration__intro">{t('migration.intro')}</p>
        <button class="migration__btn migration__btn--primary" onclick={() => void scan()}>
          {t('migration.scanBtn')}
        </button>
      </div>

    {:else if phase === 'scanning'}
      <div class="migration__center">
        <div class="migration__spinner"></div>
        <p class="migration__status">{t('migration.scanning')}</p>
      </div>

    {:else if phase === 'results'}
      <div class="migration__results">
        <p class="migration__found">{t('migration.found', { count: String(contacts.length) })}</p>

        {#if googleAccounts.length > 1}
          <div class="migration__account-picker">
            <span class="migration__account-label">Migrate to:</span>
            <select class="migration__select" bind:value={selectedAccount}>
              {#each googleAccounts as acct}
                <option value={acct}>{acct}</option>
              {/each}
            </select>
          </div>
        {:else if googleAccounts.length === 1}
          <p class="migration__account">{t('migration.migrateTo', { account: selectedAccount })}</p>
        {:else}
          <p class="migration__warning">{t('migration.noGoogle')}</p>
        {/if}

        <div class="migration__select-all">
          <label class="migration__checkbox-label">
            <input type="checkbox" checked={allSelected} onchange={toggleAll} />
            <span>{t('migration.selectAll', { count: String(contacts.length) })}</span>
          </label>
        </div>

        <div class="migration__list">
          {#each contacts as contact, i}
            <label class="migration__item">
              <input type="checkbox" bind:checked={contacts[i].selected} />
              <div class="migration__item-info">
                <span class="migration__item-name">{contact.displayName}</span>
                {#if contact.phoneNumber}
                  <span class="migration__item-phone">{contact.phoneNumber}</span>
                {/if}
              </div>
            </label>
          {/each}
        </div>

        <div class="migration__actions">
          <button
            class="migration__btn migration__btn--primary"
            onclick={() => void migrate()}
            disabled={selectedCount === 0 || !selectedAccount || googleAccounts.length === 0}
          >
            {t('migration.migrateBtn', { count: String(selectedCount) })}
          </button>
          <button class="migration__btn migration__btn--outline" onclick={onClose}>
            {t('settings.cancelBtn')}
          </button>
        </div>
      </div>

    {:else if phase === 'migrating'}
      <div class="migration__center">
        <div class="migration__spinner"></div>
        <p class="migration__status">{t('migration.migrating')}</p>
      </div>

    {:else if phase === 'complete'}
      <div class="migration__center">
        {#if migrateResult}
          {#if migrateResult.migrated > 0}
            <div class="migration__icon migration__icon--success">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
            <p class="migration__success">{t('migration.success', { count: String(migrateResult.migrated) })}</p>
          {/if}
          {#if migrateResult.failed > 0}
            <p class="migration__error-text">{t('migration.failed', { count: String(migrateResult.failed) })}</p>
            {#each migrateResult.errors as err}
              <p class="migration__error-detail">{err}</p>
            {/each}
          {/if}
          {#if contacts.length === 0 && migrateResult.migrated === 0}
            <div class="migration__icon migration__icon--success">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
            <p class="migration__success">{t('migration.allGood')}</p>
          {/if}
        {/if}
        <button class="migration__btn migration__btn--outline" onclick={onClose}>
          {t('migration.done')}
        </button>
      </div>

    {:else if phase === 'error'}
      <div class="migration__center">
        <p class="migration__error-text">{error}</p>
        <button class="migration__btn migration__btn--outline" onclick={() => void scan()}>
          {t('migration.retry')}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .migration {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .migration__header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
    background-color: var(--bg-secondary);
  }

  .migration__back {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
  }

  .migration__back:hover {
    color: var(--text-secondary);
    background-color: var(--bg-hover);
  }

  .migration__title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .migration__content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
  }

  .migration__center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--space-12) var(--space-6);
    max-width: 400px;
    margin: 0 auto;
    gap: var(--space-4);
  }

  .migration__icon {
    color: var(--accent-primary);
  }

  .migration__icon--success {
    color: var(--success);
  }

  .migration__intro {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .migration__status {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .migration__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Results phase */
  .migration__results {
    max-width: 600px;
    margin: 0 auto;
  }

  .migration__found {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: var(--font-weight-medium);
    margin-bottom: var(--space-3);
  }

  .migration__account-picker {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .migration__account-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .migration__select {
    flex: 1;
    background-color: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-1) var(--space-2);
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    outline: none;
  }

  .migration__select:focus {
    border-color: var(--accent-primary);
  }

  .migration__account {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-3);
  }

  .migration__warning {
    font-size: var(--font-size-sm);
    color: var(--warning);
    margin-bottom: var(--space-3);
  }

  .migration__select-all {
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: var(--space-2);
  }

  .migration__checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    cursor: pointer;
  }

  .migration__checkbox-label input {
    accent-color: var(--accent-primary);
  }

  .migration__list {
    max-height: 400px;
    overflow-y: auto;
    margin-bottom: var(--space-4);
  }

  .migration__item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
  }

  .migration__item:hover {
    background-color: var(--bg-hover);
  }

  .migration__item input {
    accent-color: var(--accent-primary);
    flex-shrink: 0;
  }

  .migration__item-info {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .migration__item-name {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: var(--font-weight-medium);
  }

  .migration__item-phone {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .migration__actions {
    display: flex;
    gap: var(--space-2);
  }

  /* Buttons */
  .migration__btn {
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .migration__btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .migration__btn--primary {
    background-color: var(--accent-primary);
    color: #fff;
  }

  .migration__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .migration__btn--outline {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .migration__btn--outline:hover:not(:disabled) {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }

  /* Status text */
  .migration__success {
    font-size: var(--font-size-sm);
    color: var(--success);
    font-weight: var(--font-weight-medium);
  }

  .migration__error-text {
    font-size: var(--font-size-sm);
    color: var(--danger);
  }

  .migration__error-detail {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }
</style>
