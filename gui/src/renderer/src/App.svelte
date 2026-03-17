<script lang="ts">
  import { onMount } from 'svelte'
  import { initConnectionStore, effectiveState, connection } from './stores/connection.svelte'
  import { initDeviceStore, refreshDevices, devices } from './stores/devices.svelte'
  import { initContactsStore, refreshContacts } from './stores/contacts.svelte'
  import {
    initConversationsStore,
    refreshConversations,
    conversations,
    selectConversation,
    startCompose,
    exitCompose,
    setSearchQuery,
  } from './stores/conversations.svelte'
  import { initMessagesStore, messages, loadThread } from './stores/messages.svelte'
  import { lightbox, closeLightbox } from './stores/lightbox.svelte'
  import { initSendQueueStore } from './stores/send-queue.svelte'
  import { initBatteryStore } from './stores/battery.svelte'
  import { settings, initSettingsStore } from './stores/settings.svelte'
  import { getThemeById, applyTheme } from './lib/themes'
  import { t } from './stores/i18n.svelte'
  import StatusIndicator from './components/StatusIndicator.svelte'
  import ConversationList from './components/ConversationList.svelte'
  import MessageThread from './components/MessageThread.svelte'
  import NewConversation from './components/NewConversation.svelte'
  import FindMyPhone from './components/FindMyPhone.svelte'
  import SettingsPanel from './components/SettingsPanel.svelte'
  import ResizeHandle from './components/ResizeHandle.svelte'
  import UpdateBanner from './components/UpdateBanner.svelte'
  import Lightbox from './components/Lightbox.svelte'
  import AboutDialog from './components/AboutDialog.svelte'
  import ShareUrlDialog from './components/ShareUrlDialog.svelte'
  import DialConfirmDialog from './components/DialConfirmDialog.svelte'
  import VersionLockout from './components/VersionLockout.svelte'
  import StorageAnalyzer from './components/StorageAnalyzer.svelte'
  import ContactMigration from './components/ContactMigration.svelte'
  import PhoneGallery from './components/PhoneGallery.svelte'
  import PairingPage from './pages/PairingPage.svelte'

  const CONVERSATION_STATES: Set<EffectiveState> = new Set([
    'connected',
    'syncing',
    'ready',
  ])

  // --- Window-level file drop ---
  // Allows dropping files anywhere in the window to attach to the active conversation.
  let windowDragOver = $state(false)
  let dragLeaveTimer: ReturnType<typeof setTimeout> | undefined

  const hasActiveCompose = $derived(
    conversations.composingNew || conversations.selectedThreadId !== null,
  )

  function handleWindowDragOver(e: DragEvent): void {
    // Always preventDefault to stop Electron from navigating to dropped files
    e.preventDefault()
    if (!e.dataTransfer?.types?.includes('Files')) return
    if (e.dataTransfer) e.dataTransfer.dropEffect = hasActiveCompose ? 'copy' : 'none'
    if (hasActiveCompose) {
      // Use a timer to debounce dragleave events that fire when crossing child elements
      clearTimeout(dragLeaveTimer)
      windowDragOver = true
    }
  }

  function handleWindowDragLeave(): void {
    dragLeaveTimer = setTimeout(() => { windowDragOver = false }, 50)
  }

  async function handleWindowDrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    windowDragOver = false
    clearTimeout(dragLeaveTimer)

    if (!hasActiveCompose) return
    if (!e.dataTransfer?.files?.length) return

    // If drop landed on the compose area, its own handler (with stopPropagation) already handled it
    const target = e.target as HTMLElement | null
    if (target?.closest('.compose')) return

    try {
      const paths: string[] = []
      for (const file of e.dataTransfer.files) {
        const filePath = (file as File & { path?: string }).path
        if (filePath) paths.push(filePath)
      }
      if (paths.length === 0) return

      window.api.log('renderer', 'Window drop: registering files', { count: String(paths.length) })
      const picked = await window.api.registerDraftFiles(paths)
      if (picked.length === 0) return

      const drafts = picked.map((p) => ({
        ...p,
        kind: (p.mimeType.startsWith('image/') ? 'image'
          : p.mimeType.startsWith('video/') ? 'video'
          : p.mimeType.startsWith('audio/') ? 'audio'
          : 'other') as 'image' | 'video' | 'audio' | 'other',
      }))

      window.dispatchEvent(new CustomEvent('fosslink:external-drop', { detail: drafts }))
    } catch (err) {
      window.api.log('renderer', 'Window drop error', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Once we've been in a messaging state, stay on conversation view
  // even during brief disconnections (phone reconnects every ~5s)
  let hasBeenConnected = $state(false)

  $effect(() => {
    if (CONVERSATION_STATES.has(effectiveState.current)) {
      hasBeenConnected = true
    }
  })

  // Auto-sync on reconnect after a meaningful disconnect (>30s).
  // Brief disconnect/reconnect cycles (~25s) happen normally and don't need a sync.
  // Only when the phone has been gone long enough for the UI to show "disconnected"
  // do we re-sync to pick up messages received while offline.
  const RECONNECT_SYNC_THRESHOLD = 30_000
  let needsSyncOnReconnect = $state(false)
  let disconnectTimer: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    const state = effectiveState.current
    if (CONVERSATION_STATES.has(state)) {
      if (disconnectTimer !== undefined) {
        clearTimeout(disconnectTimer)
        disconnectTimer = undefined
      }
      if (needsSyncOnReconnect) {
        needsSyncOnReconnect = false
        triggerSync()
      }
    } else if (hasBeenConnected && disconnectTimer === undefined) {
      disconnectTimer = setTimeout(() => {
        disconnectTimer = undefined
        needsSyncOnReconnect = true
      }, RECONNECT_SYNC_THRESHOLD)
    }
  })

  function triggerSync(): void {
    void window.api.invoke('sms.request_sync').catch(() => {})
  }

  const showConversations = $derived(
    CONVERSATION_STATES.has(effectiveState.current) || hasBeenConnected || devices.pairedIds.length > 0,
  )
  const showPairing = $derived(!showConversations)

  let showSettings = $state(false)
  let showFindPhone = $state(false)
  let showStorageAnalyzer = $state(false)
  let showContactMigration = $state(false)
  let showGallery = $state(false)
  let showAbout = $state(false)
  let showShareUrl = $state(false)
  let telDialNumber = $state<string | null>(null)

  function closeExtras(): void {
    showSettings = false
    showFindPhone = false
    showStorageAnalyzer = false
    showContactMigration = false
    showGallery = false
  }

  /** Open a non-SMS panel: close other extras, deselect any thread so
   *  clicking any conversation (even the previously selected one) will
   *  trigger the $effect that closes the panel and shows the thread. */
  function openExtraPanel(setter: () => void): void {
    closeExtras()
    setter()
    selectConversation(null)
    loadThread(null)
    exitCompose()
  }

  const isEnhancedMode = $derived(connection.stateContext?.peerClientType === 'fosslink')
  const versionIncompatible = $derived(
    connection.stateContext?.versionCompatible === false &&
    connection.stateContext?.peerClientType === 'fosslink',
  )

  let appVersion = $state('...')

  // Close overlays when user selects a conversation
  $effect(() => {
    if (conversations.selectedThreadId !== null) {
      closeExtras()
    }
  })

  function handleUnpaired(): void {
    closeExtras()
    hasBeenConnected = false
    selectConversation(null)
    loadThread(null)
    conversations.raw.length = 0
  }

  const MIN_SIDEBAR = 200
  const MAX_SIDEBAR = 480

  function handleResize(deltaX: number): void {
    settings.sidebarWidth = Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, settings.sidebarWidth + deltaX))
  }

  // Sync persisted showSpam setting into conversations store
  conversations.showSpam = settings.showSpam
  $effect(() => {
    settings.showSpam = conversations.showSpam
  })

  async function confirmTelDial(): Promise<void> {
    if (!telDialNumber) return
    try {
      await window.api.invoke('phone.dial', { phoneNumber: telDialNumber })
    } catch {
      // silently ignore — phone may not be connected
    }
    telDialNumber = null
  }

  function handleTelIncoming(phoneNumber: string): void {
    telDialNumber = phoneNumber
  }

  // Apply theme on load and whenever it changes
  applyTheme(getThemeById(settings.theme))
  $effect(() => {
    applyTheme(getThemeById(settings.theme))
  })

  onMount(() => {
    initSettingsStore()
    const cleanupConnection = initConnectionStore()
    const cleanupDevices = initDeviceStore()
    const cleanupContacts = initContactsStore()
    const cleanupConversations = initConversationsStore()
    const cleanupMessages = initMessagesStore()
    const cleanupSendQueue = initSendQueueStore()
    const cleanupBattery = initBatteryStore()

    void window.api.getAppVersion().then((v) => { appVersion = v })

    // Listen for tel: link activations (from OS protocol handler)
    window.api.onTelIncoming(handleTelIncoming)

    // Auto-check for updates on startup if enabled
    if (settings.autoCheckUpdates) {
      setTimeout(() => {
        void window.api.checkForUpdates().catch(() => {})
      }, 5000)
    }

    return () => {
      window.api.offTelIncoming(handleTelIncoming)
      cleanupConnection()
      cleanupDevices()
      cleanupContacts()
      cleanupConversations()
      cleanupMessages()
      cleanupSendQueue()
      cleanupBattery()
      clearTimeout(disconnectTimer)
    }
  })

  // Global keyboard shortcuts
  function handleKeydown(e: KeyboardEvent): void {
    // Don't intercept when typing in an input/textarea
    const tag = (e.target as HTMLElement).tagName
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA'

    if (e.key === 'Escape') {
      if (lightbox.current) { closeLightbox(); return }
      if (showShareUrl) { showShareUrl = false; return }
      if (showAbout) { showAbout = false; return }
      if (showGallery) { showGallery = false; return }
      if (showContactMigration) { showContactMigration = false; return }
      if (showStorageAnalyzer) { showStorageAnalyzer = false; return }
      if (showSettings) { showSettings = false; return }
      if (showFindPhone) { showFindPhone = false; return }
      if (conversations.composingNew) { exitCompose(); return }
      if (conversations.selectedThreadId !== null) {
        selectConversation(null)
        loadThread(null)
        return
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault()
      startCompose()
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      // Focus the search input in the sidebar
      const searchInput = document.querySelector('.search-bar__input') as HTMLInputElement | null
      if (searchInput) searchInput.focus()
      return
    }
  }

  // Refresh device lists on any daemon state change (pairedIds needed for unpair button)
  $effect(() => {
    const state = effectiveState.current
    if (state !== 'no-daemon') {
      refreshDevices()
    }
  })

  // Fetch conversations + contacts as soon as daemon is up (show cached data
  // from DB immediately, even before phone connects — critical for fast 2FA access)
  $effect(() => {
    const state = effectiveState.current
    if (state !== 'no-daemon') {
      void refreshContacts()
      void refreshConversations()
    }
  })
</script>

<svelte:window onkeydown={handleKeydown} />
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:document
  ondragover={handleWindowDragOver}
  ondragleave={handleWindowDragLeave}
  ondrop={(e) => void handleWindowDrop(e)}
/>
<div class="layout">
  <aside class="sidebar" style:width="{settings.sidebarWidth}px">
    <div class="sidebar__header">
      <div class="sidebar__title-row">
        <button class="sidebar__title" onclick={() => (showAbout = true)} title={t('app.about')}>{t('app.title')}</button>
        <div class="sidebar__actions">
          <button
            class="sidebar__icon-btn"
            class:sidebar__icon-btn--active={conversations.composingNew}
            onclick={() => { closeExtras(); startCompose() }}
            title={t('app.newMessage')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
              />
            </svg>
          </button>
          <button
            class="sidebar__icon-btn"
            class:sidebar__icon-btn--active={showFindPhone}
            onclick={() => { if (showFindPhone) { showFindPhone = false } else { openExtraPanel(() => { showFindPhone = true }) } }}
            title={t('app.findPhone')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
              />
            </svg>
          </button>
          {#if isEnhancedMode}
            <button
              class="sidebar__icon-btn"
              class:sidebar__icon-btn--active={showGallery}
              onclick={() => { if (showGallery) { showGallery = false } else { openExtraPanel(() => { showGallery = true }) } }}
              title={t('app.gallery')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="currentColor"
                  d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
                />
              </svg>
            </button>
            <button
              class="sidebar__icon-btn"
              onclick={() => { openExtraPanel(() => { showShareUrl = true }) }}
              title={t('app.shareUrl')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="currentColor"
                  d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
                />
              </svg>
            </button>
          {/if}
          <button
            class="sidebar__icon-btn"
            class:sidebar__icon-btn--active={showSettings}
            onclick={() => { if (showSettings) { showSettings = false } else { openExtraPanel(() => { showSettings = true }) } }}
            title={t('app.settings')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path
                fill="currentColor"
                d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.61 3.61 0 0112 15.6z"
              />
            </svg>
          </button>
        </div>
      </div>
      <StatusIndicator />
    </div>
    <div class="sidebar__content">
      {#if showConversations}
        <ConversationList />
      {:else if showPairing}
        <p class="sidebar__placeholder">{t('app.sidebarPlaceholder')}</p>
      {:else}
        <p class="sidebar__placeholder">{t('app.sidebarPlaceholderAlt')}</p>
      {/if}
    </div>
  </aside>
  <ResizeHandle onResize={handleResize} />
  <main class="main-panel" class:main-panel--drop-target={windowDragOver && hasActiveCompose}>
    {#if windowDragOver && hasActiveCompose}
      <div class="main-panel__drop-overlay">Drop files to attach</div>
    {/if}
    <UpdateBanner />
    {#if showGallery}
      <PhoneGallery onClose={() => (showGallery = false)} />
    {:else if showContactMigration}
      <ContactMigration onClose={() => (showContactMigration = false)} />
    {:else if showStorageAnalyzer}
      <StorageAnalyzer onClose={() => (showStorageAnalyzer = false)} />
    {:else if showSettings}
      <SettingsPanel onClose={() => (showSettings = false)} onUnpaired={handleUnpaired} onAbout={() => (showAbout = true)} onAnalyzeStorage={() => { showSettings = false; showStorageAnalyzer = true }} onContactMigration={() => { showSettings = false; showContactMigration = true }} />
    {:else if showFindPhone}
      <FindMyPhone onClose={() => (showFindPhone = false)} />
    {:else if versionIncompatible}
      <VersionLockout
        peerTooOld={connection.stateContext?.peerTooOld === true}
        selfTooOld={connection.stateContext?.selfTooOld === true}
        peerVersion={connection.stateContext?.peerClientVersion ?? 'unknown'}
        desktopVersion={appVersion}
      />
    {:else if showPairing}
      <PairingPage />
    {:else if conversations.composingNew}
      <NewConversation />
    {:else if conversations.selectedThreadId !== null}
      <MessageThread />
    {:else}
      <div class="main-panel__empty">
        <p class="main-panel__empty-text">{t('app.emptyState')}</p>
      </div>
    {/if}
  </main>
  <Lightbox />
  {#if showAbout}
    <AboutDialog onClose={() => (showAbout = false)} />
  {/if}
  {#if showShareUrl}
    <ShareUrlDialog onClose={() => (showShareUrl = false)} />
  {/if}
  {#if telDialNumber}
    <DialConfirmDialog
      phoneNumber={telDialNumber}
      onConfirm={() => void confirmTelDial()}
      onCancel={() => { telDialNumber = null }}
    />
  {/if}
</div>

<style>
  .layout {
    display: flex;
    width: 100%;
    height: 100%;
  }

  .sidebar {
    min-width: 200px;
    max-width: 480px;
    background-color: var(--bg-secondary);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
  }

  .sidebar__header {
    padding: var(--space-4);
    border-bottom: 1px solid var(--border);
  }

  .sidebar__title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }

  .sidebar__title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    transition: color 0.15s;
  }

  .sidebar__title:hover {
    color: var(--accent-primary);
  }

  .sidebar__actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .sidebar__icon-btn {
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

  .sidebar__icon-btn:hover {
    color: var(--text-secondary);
    background-color: var(--bg-hover);
  }

  .sidebar__icon-btn--active {
    color: var(--accent-primary);
  }


  .sidebar__content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .sidebar__placeholder {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    padding: var(--space-4);
    text-align: center;
    margin: auto;
  }

  .main-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-primary);
    overflow: hidden;
  }

  .main-panel__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .main-panel__empty-text {
    color: var(--text-muted);
    font-size: var(--font-size-lg);
  }

  .main-panel--drop-target {
    position: relative;
  }

  .main-panel__drop-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(75, 120, 220, 0.08);
    border: 2px dashed var(--accent-primary);
    font-size: var(--font-size-lg);
    color: var(--accent-primary);
    font-weight: var(--font-weight-medium);
    pointer-events: none;
  }
</style>
