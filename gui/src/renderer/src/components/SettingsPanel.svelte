<script lang="ts">
  import { onMount } from 'svelte'
  import { connection, effectiveState } from '../stores/connection.svelte'
  import { devices, unpairDevice } from '../stores/devices.svelte'
  import { refreshConversations, selectConversation } from '../stores/conversations.svelte'
  import { refreshContacts } from '../stores/contacts.svelte'
  import { loadThread } from '../stores/messages.svelte'
  import { settings } from '../stores/settings.svelte'
  import { t } from '../stores/i18n.svelte'
  import { locales, localeOrder } from '../lib/locales'
  import { themes } from '../lib/themes'
  interface Props {
    onClose: () => void
    onUnpaired: () => void
    onAbout: () => void
    onContactMigration?: () => void
    onSyncConsole?: () => void
  }

  const { onClose, onUnpaired, onAbout, onContactMigration, onSyncConsole }: Props = $props()

  let confirmingUnpair = $state(false)
  let unpairing = $state(false)

  // Update section state
  let appVersion = $state('...')
  let updateStatus = $state<UpdateStatus>({ state: 'idle' })

  onMount(() => {
    void window.api.getAppVersion().then((v) => { appVersion = v })
    void window.api.getUpdateStatus().then((s) => { updateStatus = s })

    const handleStatus = (status: UpdateStatus): void => {
      updateStatus = status
    }

    window.api.onUpdateStatus(handleStatus)
    return () => window.api.offUpdateStatus(handleStatus)
  })

  async function checkForUpdates(): Promise<void> {
    try {
      await window.api.checkForUpdates()
    } catch {
      // Error will come through the status event
    }
  }

  function openReleasePage(): void {
    if (updateStatus.state === 'available') {
      window.api.openExternal(`https://github.com/hansonxyz/fosslink/releases/tag/v${updateStatus.version}`)
    }
  }

  function installUpdate(): void {
    void window.api.installUpdate()
  }

  function updateStatusText(status: UpdateStatus): string {
    switch (status.state) {
      case 'idle': return ''
      case 'checking': return t('updates.checking')
      case 'available': return t('updates.available', { version: status.version })
      case 'not-available': return t('updates.upToDate')
      case 'downloading': return t('updates.downloading', { percent: String(status.percent) })
      case 'downloaded': return t('updates.ready', { version: status.version })
      case 'error': return t('updates.error', { message: status.message })
    }
  }

  // Cache device info
  let cachedName = $state<string | null>(null)
  let hasEverConnected = $state(false)

  const hasPairedDevice = $derived(devices.pairedIds.length > 0)

  $effect(() => {
    const disc = devices.discovered.find((d) => devices.pairedIds.includes(d.deviceId))
    if (disc) {
      cachedName = disc.deviceName
      hasEverConnected = true
    }
    const ctxName = connection.stateContext?.deviceName
    if (ctxName && !cachedName) {
      cachedName = ctxName
      hasEverConnected = true
    }
  })

  const CONNECTED_STATES = new Set(['connected', 'syncing', 'ready'])
  const isConnected = $derived(CONNECTED_STATES.has(effectiveState.current))
  const stateLabel = $derived(
    isConnected ? t('settings.statusConnected') : hasPairedDevice ? t('settings.statusReconnecting') : t('settings.statusDisconnected'),
  )

  // WebDAV filesystem mount state
  let webdavRunning = $state(false)
  let webdavPort = $state(0)
  let webdavLoading = $state(false)

  onMount(() => {
    void refreshWebdavStatus()

    const handleNotification = (method: string): void => {
      if (method === 'webdav.stopped') {
        webdavRunning = false
        webdavPort = 0
      }
    }
    window.api.onNotification(handleNotification)
    return () => window.api.offNotification(handleNotification)
  })

  async function refreshWebdavStatus(): Promise<void> {
    try {
      const status = await window.api.invoke('webdav.status') as { running: boolean; port: number; url: string }
      webdavRunning = status.running
      webdavPort = status.port
    } catch {
      // Not connected yet
    }
  }

  async function toggleWebdav(): Promise<void> {
    webdavLoading = true
    try {
      if (webdavRunning) {
        await window.api.invoke('webdav.stop')
        webdavRunning = false
        webdavPort = 0
      } else {
        const result = await window.api.invoke('webdav.start') as { port: number; url: string }
        webdavRunning = true
        webdavPort = result.port
      }
    } catch (err) {
      console.error('WebDAV toggle failed:', err)
    } finally {
      webdavLoading = false
    }
  }

  async function handlePhoneFiles(): Promise<void> {
    if (webdavRunning) {
      // Unmount: disconnect OS-level mount, then stop server
      if (webdavPort) {
        window.api.closeWebdav(webdavPort)
      }
      await toggleWebdav()
    } else {
      // Mount: start server, then open in file manager
      await toggleWebdav()
      if (webdavRunning && webdavPort) {
        window.api.openWebdav(webdavPort)
      }
    }
  }

  async function handleResync(): Promise<void> {
    await window.api.invoke('sms.resync_all')
    selectConversation(null)
    loadThread(null)
    onClose()
    await refreshConversations()
    await refreshContacts()
  }

  async function handleUnpair(): Promise<void> {
    const deviceId = devices.pairedIds[0]
    if (!deviceId) return
    unpairing = true
    await unpairDevice(deviceId)
    unpairing = false
    confirmingUnpair = false
    onUnpaired()
  }
</script>

<div class="settings-panel">
  <div class="settings-panel__header">
    <h2 class="settings-panel__title">{t('settings.title')}</h2>
    <button class="settings-panel__close" onclick={onClose} title={t('settings.close')}>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path
          fill="currentColor"
          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        />
      </svg>
    </button>
  </div>

  <div class="settings-panel__content">
    <!-- Connection (simplified) -->
    <div class="settings-panel__section">
      <h3 class="settings-panel__section-title">{t('settings.connection')}</h3>
      <div class="settings-panel__row">
        <span class="settings-panel__label">{t('settings.status')}</span>
        <span class="settings-panel__value">{stateLabel}</span>
      </div>
      {#if cachedName}
        <div class="settings-panel__row">
          <span class="settings-panel__label">{t('settings.device')}</span>
          <span class="settings-panel__value">{cachedName}</span>
        </div>
      {:else if hasPairedDevice}
        <div class="settings-panel__row">
          <span class="settings-panel__label">{t('settings.device')}</span>
          <span class="settings-panel__value settings-panel__value--muted">{t('settings.waitingDevice')}</span>
        </div>
      {/if}

      {#if devices.pairedIds.length > 0}
        {#if connection.stateContext?.peerTooOld}
          <button
            class="settings-panel__btn settings-panel__btn--primary"
            onclick={() => void window.api.invoke('device.open_app_store')}
            style="margin-top: var(--space-3)"
          >
            {t('version.updateCompanion')}
          </button>
        {/if}

        <div class="settings-panel__device-actions">
          <button
            class="settings-panel__btn settings-panel__btn--outline"
            onclick={() => void handleResync()}
          >
            {t('settings.resyncBtn')}
          </button>

          {#if confirmingUnpair}
            <div class="settings-panel__confirm">
              <p class="settings-panel__confirm-text">
                {t('settings.unpairConfirm', { device: cachedName ?? 'this device' })}
              </p>
              <div class="settings-panel__confirm-actions">
                <button
                  class="settings-panel__btn settings-panel__btn--danger"
                  onclick={() => void handleUnpair()}
                  disabled={unpairing}
                >
                  {unpairing ? t('settings.unpairing') : t('settings.unpairBtn')}
                </button>
                <button
                  class="settings-panel__btn settings-panel__btn--cancel"
                  onclick={() => (confirmingUnpair = false)}
                  disabled={unpairing}
                >
                  {t('settings.cancelBtn')}
                </button>
              </div>
            </div>
          {:else}
            <button
              class="settings-panel__btn settings-panel__btn--outline-danger"
              onclick={() => (confirmingUnpair = true)}
            >
              {t('settings.unpairDevice')}
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Extras -->
    {#if isConnected}
      <div class="settings-panel__section settings-panel__section--wide">
        <h3 class="settings-panel__section-title">{t('extras.title')}</h3>
        <div class="settings-panel__extras-grid">
          <!-- Phone Files (WebDAV) -->
          <button
            class="settings-panel__extra-card"
            class:settings-panel__extra-card--active={webdavRunning}
            onclick={handlePhoneFiles}
            disabled={webdavLoading}
          >
            <div class="settings-panel__extra-icon">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <path fill="currentColor" d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
            </div>
            <div class="settings-panel__extra-text">
              <span class="settings-panel__extra-title">{t('extras.filesTitle')}</span>
              <span class="settings-panel__extra-subtitle">{webdavRunning ? t('extras.filesMounted') : t('extras.filesSubtitle')}</span>
            </div>
            {#if webdavRunning}
              <div class="settings-panel__extra-badge"></div>
            {/if}
          </button>

          <!-- Contact Migration -->
          <button class="settings-panel__extra-card" onclick={() => onContactMigration?.()}>
            <div class="settings-panel__extra-icon">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
            </div>
            <div class="settings-panel__extra-text">
              <span class="settings-panel__extra-title">{t('extras.migrationTitle')}</span>
              <span class="settings-panel__extra-subtitle">{t('extras.migrationSubtitle')}</span>
            </div>
          </button>
        </div>
      </div>
    {/if}

    <!-- Notifications -->
    <div class="settings-panel__section">
      <h3 class="settings-panel__section-title">{t('settings.notifications')}</h3>
      <div class="settings-panel__row">
        <span class="settings-panel__label">{t('settings.desktopNotifications')}</span>
        <label class="settings-panel__toggle">
          <input
            type="checkbox"
            bind:checked={settings.notificationsEnabled}
          />
          <span class="settings-panel__toggle-track"></span>
        </label>
      </div>
      <div class="settings-panel__row">
        <span class="settings-panel__label">{t('settings.flashTaskbar')} <span class="settings-panel__hint">{t('settings.flashTaskbarHint')}</span></span>
        <label class="settings-panel__toggle">
          <input
            type="checkbox"
            bind:checked={settings.flashTaskbar}
          />
          <span class="settings-panel__toggle-track"></span>
        </label>
      </div>
      <div class="settings-panel__row">
        <span class="settings-panel__label">{t('settings.linkPreviews')}</span>
        <label class="settings-panel__toggle">
          <input
            type="checkbox"
            bind:checked={settings.linkPreviewsEnabled}
          />
          <span class="settings-panel__toggle-track"></span>
        </label>
      </div>
    </div>

    <!-- Language -->
    <div class="settings-panel__section">
      <h3 class="settings-panel__section-title">{t('settings.language')}</h3>
      <div class="settings-panel__row">
        <select
          class="settings-panel__select"
          bind:value={settings.locale}
        >
          <option value="auto">{t('settings.languageAuto')}</option>
          {#each localeOrder as code}
            <option value={code}>{locales[code].name}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Theme -->
    <div class="settings-panel__section settings-panel__section--wide">
      <h3 class="settings-panel__section-title">{t('settings.theme')}</h3>
      <div class="settings-panel__theme-grid">
        {#each themes as theme}
          <button
            class="settings-panel__theme-card"
            class:settings-panel__theme-card--active={settings.theme === theme.id}
            onclick={() => { settings.theme = theme.id }}
            title={theme.name}
          >
            <div class="settings-panel__theme-preview">
              <div class="settings-panel__theme-bg" style:background-color={theme.colors['--bg-primary']}>
                <div class="settings-panel__theme-sidebar" style:background-color={theme.colors['--bg-secondary']}>
                  <div class="settings-panel__theme-sidebar-item" style:background-color={theme.colors['--bg-hover']}></div>
                  <div class="settings-panel__theme-sidebar-item" style:background-color={theme.colors['--bg-selected']}></div>
                  <div class="settings-panel__theme-sidebar-item" style:background-color={theme.colors['--bg-hover']}></div>
                </div>
                <div class="settings-panel__theme-chat">
                  <div class="settings-panel__theme-bubble-recv" style:background-color={theme.colors['--bubble-received']}></div>
                  <div class="settings-panel__theme-bubble-sent" style:background-color={theme.colors['--bubble-sent']}></div>
                  <div class="settings-panel__theme-bubble-recv" style:background-color={theme.colors['--bubble-received']}></div>
                </div>
              </div>
            </div>
            <span
              class="settings-panel__theme-name"
              class:settings-panel__theme-name--active={settings.theme === theme.id}
            >{theme.name}</span>
          </button>
        {/each}
      </div>
    </div>

    <!-- Updates -->
    <div class="settings-panel__section">
      <h3 class="settings-panel__section-title">{t('updates.title')}</h3>

      <div class="settings-panel__row">
        <span class="settings-panel__label">{t('updates.version')}</span>
        <span class="settings-panel__value settings-panel__value--mono">{appVersion}</span>
      </div>

      <div class="settings-panel__row">
        <span class="settings-panel__label">{t('updates.checkAuto')}</span>
        <label class="settings-panel__toggle">
          <input type="checkbox" bind:checked={settings.autoCheckUpdates} />
          <span class="settings-panel__toggle-track"></span>
        </label>
      </div>

      <div class="settings-panel__update-actions">
        {#if updateStatus.state === 'available'}
          <button
            class="settings-panel__btn settings-panel__btn--primary"
            onclick={openReleasePage}
          >
            {t('updates.viewOnGithub')}
          </button>
        {:else if updateStatus.state === 'downloaded'}
          <button
            class="settings-panel__btn settings-panel__btn--primary"
            onclick={installUpdate}
          >
            {t('updates.restartBtn')}
          </button>
        {:else}
          <button
            class="settings-panel__btn settings-panel__btn--outline"
            onclick={() => void checkForUpdates()}
            disabled={updateStatus.state === 'checking' || updateStatus.state === 'downloading'}
          >
            {updateStatus.state === 'checking' ? t('updates.checkingBtn') : t('updates.checkBtn')}
          </button>
        {/if}
      </div>

      {#if updateStatusText(updateStatus)}
        <p
          class="settings-panel__status-text"
          class:settings-panel__status-text--error={updateStatus.state === 'error'}
          class:settings-panel__status-text--success={updateStatus.state === 'not-available'}
        >
          {updateStatusText(updateStatus)}
        </p>
      {/if}

      {#if updateStatus.state === 'downloading'}
        <div class="settings-panel__progress-bar">
          <div class="settings-panel__progress-fill" style:width="{updateStatus.percent}%"></div>
        </div>
      {/if}
    </div>

    <div class="settings-panel__section">
      <div class="settings-panel__device-actions">
        <button
          class="settings-panel__btn settings-panel__btn--outline"
          onclick={onAbout}
        >
          {t('settings.aboutBtn')}
        </button>
        {#if __DEV_BUILD__}
          <button
            class="settings-panel__btn settings-panel__btn--outline"
            onclick={() => onSyncConsole?.()}
          >
            Sync Console
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .settings-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .settings-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
    background-color: var(--bg-secondary);
  }

  .settings-panel__title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .settings-panel__close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
  }

  .settings-panel__close:hover {
    color: var(--text-secondary);
    background-color: var(--bg-hover);
  }

  .settings-panel__content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-6);
  }

  @media (min-width: 1100px) {
    .settings-panel__content {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 450px));
      column-gap: clamp(16px, 3vw, 50px);
      justify-content: center;
      align-content: start;
    }

    .settings-panel__section--wide {
      grid-column: span 2;
    }
  }

  .settings-panel__section {
    margin-bottom: var(--space-8);
  }

  .settings-panel__section-title {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-4);
  }

  .settings-panel__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--border);
  }

  .settings-panel__label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .settings-panel__hint {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .settings-panel__select {
    width: 100%;
    background-color: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .settings-panel__select:focus {
    border-color: var(--accent-primary);
  }

  .settings-panel__select option {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
  }

  .settings-panel__value {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
  }

  .settings-panel__value--mono {
    font-family: monospace;
  }

  .settings-panel__value--muted {
    color: var(--text-muted);
    font-style: italic;
  }

  /* Extras card grid */
  .settings-panel__extras-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-3);
  }

  .settings-panel__extra-card {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    background-color: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color 0.15s, border-color 0.15s;
    text-align: left;
    position: relative;
    font-family: var(--font-family);
  }

  .settings-panel__extra-card:hover:not(:disabled) {
    background-color: var(--bg-hover);
    border-color: var(--accent-primary);
  }

  .settings-panel__extra-card:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .settings-panel__extra-card--active {
    border-color: var(--success);
  }

  .settings-panel__extra-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-primary);
  }

  .settings-panel__extra-card--active .settings-panel__extra-icon {
    color: var(--success);
  }

  .settings-panel__extra-text {
    min-width: 0;
  }

  .settings-panel__extra-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--text-primary);
    display: block;
  }

  .settings-panel__extra-subtitle {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    display: block;
    margin-top: 2px;
  }

  .settings-panel__extra-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background-color: var(--success);
  }

  .settings-panel__device-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }

  /* Buttons and other existing styles */
  .settings-panel__confirm {
    background-color: var(--bg-surface);
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }

  .settings-panel__confirm-text {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-3);
    line-height: 1.4;
  }

  .settings-panel__confirm-actions {
    display: flex;
    gap: var(--space-2);
  }

  .settings-panel__btn {
    padding: var(--space-2) var(--space-4);
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .settings-panel__btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .settings-panel__btn--danger {
    background-color: var(--danger);
    color: #fff;
  }

  .settings-panel__btn--danger:hover:not(:disabled) {
    background-color: #d32f2f;
  }

  .settings-panel__btn--cancel {
    background-color: var(--bg-surface);
    color: var(--text-secondary);
  }

  .settings-panel__btn--cancel:hover:not(:disabled) {
    background-color: var(--bg-hover);
  }

  .settings-panel__btn--outline-danger {
    background: none;
    border: 1px solid var(--danger);
    color: var(--danger);
  }

  .settings-panel__btn--outline-danger:hover {
    background-color: var(--danger);
    color: #fff;
  }

  .settings-panel__toggle {
    position: relative;
    display: inline-block;
    cursor: pointer;
  }

  .settings-panel__toggle input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }

  .settings-panel__toggle-track {
    display: block;
    width: 40px;
    height: 22px;
    background-color: var(--bg-surface);
    border-radius: 11px;
    transition: background-color 0.2s;
    position: relative;
  }

  .settings-panel__toggle-track::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    background-color: var(--text-muted);
    border-radius: var(--radius-full);
    transition: transform 0.2s, background-color 0.2s;
  }

  .settings-panel__toggle input:checked + .settings-panel__toggle-track {
    background-color: var(--accent-primary);
  }

  .settings-panel__toggle input:checked + .settings-panel__toggle-track::after {
    transform: translateX(18px);
    background-color: #fff;
  }

  .settings-panel__update-actions {
    margin-top: var(--space-3);
  }

  .settings-panel__btn--primary {
    background-color: var(--accent-primary);
    color: #fff;
  }

  .settings-panel__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .settings-panel__btn--outline {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .settings-panel__btn--outline:hover:not(:disabled) {
    background-color: var(--bg-hover);
    color: var(--text-primary);
  }

  .settings-panel__status-text {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-top: var(--space-2);
  }

  .settings-panel__status-text--error {
    color: var(--danger);
  }

  .settings-panel__status-text--success {
    color: var(--success);
  }

  .settings-panel__progress-bar {
    height: 4px;
    background-color: var(--bg-surface);
    border-radius: var(--radius-full);
    margin-top: var(--space-2);
    overflow: hidden;
  }

  .settings-panel__progress-fill {
    height: 100%;
    background-color: var(--accent-primary);
    border-radius: var(--radius-full);
    transition: width 0.3s ease;
  }

  /* Theme picker */
  .settings-panel__theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--space-3);
  }

  .settings-panel__theme-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    background: none;
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: border-color 0.15s, background-color 0.15s;
    font-family: var(--font-family);
  }

  .settings-panel__theme-card:hover {
    background-color: var(--bg-hover);
  }

  .settings-panel__theme-card--active {
    border-color: var(--accent-primary);
  }

  .settings-panel__theme-preview {
    width: 100%;
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-sm);
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .settings-panel__theme-bg {
    width: 100%;
    height: 100%;
    display: flex;
  }

  .settings-panel__theme-sidebar {
    width: 30%;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px 3px;
  }

  .settings-panel__theme-sidebar-item {
    height: 8px;
    border-radius: 2px;
  }

  .settings-panel__theme-chat {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 5px;
    justify-content: flex-end;
  }

  .settings-panel__theme-bubble-recv {
    width: 65%;
    height: 7px;
    border-radius: 3px;
    align-self: flex-start;
  }

  .settings-panel__theme-bubble-sent {
    width: 55%;
    height: 7px;
    border-radius: 3px;
    align-self: flex-end;
  }

  .settings-panel__theme-name {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-align: center;
  }

  .settings-panel__theme-name--active {
    color: var(--accent-primary);
    font-weight: var(--font-weight-medium);
  }
</style>
