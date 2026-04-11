<script lang="ts">
  import { onMount } from 'svelte'
  import { t } from '../stores/i18n.svelte'
  import {
    gallery,
    scanGallery,
    getFilteredItems,
    getItemsByFolder,
    getThumbnailState,
    getGalleryThumbnailUrl,
    requestThumbnail,
    requestFullFile,
    openGallery,
    closeGallery,
    subscribeGalleryEvents,
    subscribeFsWatchEvents,
    watchFolder,
    unwatchFolder,
    handleGalleryScanBatch,
    type GalleryItem,
    type ViewMode,
  } from '../stores/gallery.svelte'
  import { openGalleryLightbox, updateLightboxSrc } from '../stores/lightbox.svelte'
  import { effectiveState } from '../stores/connection.svelte'

  interface Props {
    onClose: () => void
  }
  let { onClose }: Props = $props()

  let observer: IntersectionObserver | undefined
  let galleryBodyEl: HTMLDivElement | undefined = $state()

  // Reset scroll to top when view mode or folder changes
  $effect(() => {
    // Track these reactive values to trigger on change
    void gallery.viewMode
    void gallery.selectedFolder
    if (galleryBodyEl) {
      galleryBodyEl.scrollTop = 0
    }
  })

  // Derived state
  const filteredItems = $derived(getFilteredItems())
  const folderGroups = $derived(getItemsByFolder())
  const inFolderDetail = $derived(gallery.viewMode === 'folders' && gallery.selectedFolder !== null)

  // Cell sizes
  const THUMB_SIZE = 80
  const MOSAIC_SIZE = 180
  const cellSize = $derived(gallery.sizeMode === 'thumbnail' ? THUMB_SIZE : MOSAIC_SIZE)

  // Device connectivity
  const isDeviceConnected = $derived(
    effectiveState.current === 'ready' || effectiveState.current === 'connected' || effectiveState.current === 'syncing'
  )

  // Auto-retry gallery scan every 5s when gallery is open, device appears connected,
  // but the gallery has no items (scan failed, or data was wiped by resync)
  let retryTimer: ReturnType<typeof setInterval> | undefined

  $effect(() => {
    const needsRetry = isDeviceConnected && (
      gallery.scanState === 'error' ||
      (gallery.scanState === 'ready' && gallery.items.length === 0)
    )
    if (needsRetry) {
      if (!retryTimer) {
        retryTimer = setInterval(() => {
          if (gallery.scanState !== 'scanning') {
            void scanGallery()
          }
        }, 5000)
      }
    } else {
      if (retryTimer) {
        clearInterval(retryTimer)
        retryTimer = undefined
      }
    }
  })

  // Watch the active folder for filesystem changes
  $effect(() => {
    if (gallery.scanState !== 'ready') return

    if (inFolderDetail && gallery.selectedFolder) {
      watchFolder('/' + gallery.selectedFolder)
    } else if (gallery.viewMode === 'dcim') {
      watchFolder('/DCIM')
    } else if (gallery.viewMode === 'screenshots') {
      watchFolder('/Pictures/Screenshots')
    } else {
      unwatchFolder()
    }
  })

  onMount(() => {
    openGallery()
    void scanGallery()

    const unsubscribeEvents = subscribeGalleryEvents()
    const unsubscribeWatchEvents = subscribeFsWatchEvents()

    // Listen for progressive gallery scan batches
    const handleBatch = (method: string, params: unknown): void => {
      if (method === 'gallery.scan.batch') {
        const data = params as { items: GalleryItem[] }
        if (data.items?.length > 0) {
          handleGalleryScanBatch(data.items)
        }
      }
    }
    window.api.onNotification(handleBatch)

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const path = (entry.target as HTMLElement).dataset['path']
            if (path) requestThumbnail(path)
          }
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 },
    )

    return () => {
      observer?.disconnect()
      unsubscribeEvents()
      unsubscribeWatchEvents()
      window.api.offNotification(handleBatch)
      unwatchFolder()
      closeGallery()
      if (retryTimer) {
        clearInterval(retryTimer)
        retryTimer = undefined
      }
    }
  })

  function handleItemClick(item: GalleryItem, itemList: GalleryItem[], index: number): void {
    if (item.kind === 'video') {
      // Show lightbox immediately with spinner, then load video
      openGalleryLightbox('video', '', item.path, itemList, index)
      void requestFullFile(item.path, item.size).then((url) => {
        openGalleryLightbox('video', url, item.path, itemList, index)
      })
      return
    }
    // Image: show thumbnail immediately, upgrade to full-res in background
    const thumbSrc = getGalleryThumbnailUrl(item.path)
    openGalleryLightbox('image', thumbSrc, item.path, itemList, index)
    void requestFullFile(item.path, item.size).then((fullUrl) => {
      updateLightboxSrc(item.path, fullUrl)
    }).catch(() => {
      // Keep showing thumbnail if full download fails
    })
  }

  function handleContextMenu(e: MouseEvent, item: GalleryItem): void {
    e.preventDefault()
    window.api.showGalleryContextMenu(item.path)
  }

  function handleBackClick(): void {
    if (inFolderDetail) {
      gallery.selectedFolder = null
    } else {
      onClose()
    }
  }

  function observeCell(node: HTMLElement): { destroy: () => void } {
    observer?.observe(node)
    return {
      destroy() {
        observer?.unobserve(node)
      },
    }
  }

  const viewModes: Array<{ key: ViewMode; label: string }> = [
    { key: 'dcim', label: 'gallery.viewDcim' },
    { key: 'screenshots', label: 'gallery.viewScreenshots' },
    { key: 'folders', label: 'gallery.viewFolders' },
    { key: 'all', label: 'gallery.viewAll' },
  ]

  // "Show in Explorer" — visible in DCIM mode or when viewing a single folder
  const showExplorerBtn = $derived(
    gallery.viewMode === 'dcim' || gallery.viewMode === 'screenshots' || inFolderDetail,
  )

  const explorerFolderPath = $derived(
    gallery.viewMode === 'dcim' ? 'DCIM'
      : gallery.viewMode === 'screenshots' ? 'Pictures/Screenshots'
      : gallery.selectedFolder ?? '',
  )

  let explorerLoading = $state(false)
  let explorerError = $state('')

  async function handleShowInExplorer(): Promise<void> {
    if (!explorerFolderPath) return
    explorerLoading = true
    explorerError = ''
    try {
      // Ensure WebDAV is running
      let port = 0
      try {
        const status = await window.api.invoke('webdav.status') as { running: boolean; port: number }
        if (status.running) {
          port = status.port
        }
      } catch {
        // Not connected — will try to start
      }

      if (!port) {
        const result = await window.api.invoke('webdav.start') as { port: number }
        port = result.port
      }

      const result = await window.api.openWebdavFolder(port, explorerFolderPath)
      if (!result.ok) {
        explorerError = result.error ?? 'Failed to open folder'
      }
    } catch (err) {
      explorerError = err instanceof Error ? err.message : 'Failed to open folder'
    } finally {
      explorerLoading = false
    }
  }
</script>

{#snippet galleryCell(item: GalleryItem, itemList: GalleryItem[], index: number)}
  {@const thumbState = getThumbnailState(item.path)}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="gallery__cell"
    data-path={item.path}
    use:observeCell
    onclick={() => handleItemClick(item, itemList, index)}
    oncontextmenu={(e) => handleContextMenu(e, item)}
  >
    {#if thumbState === 'ready'}
      <img
        class="gallery__thumb"
        src={getGalleryThumbnailUrl(item.path)}
        alt={item.filename}
        loading="lazy"
      />
    {:else if thumbState === 'failed'}
      <div class="gallery__placeholder gallery__placeholder--failed">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
        </svg>
      </div>
    {:else}
      <div class="gallery__placeholder gallery__placeholder--loading">
        <div class="gallery__shimmer"></div>
      </div>
    {/if}
    {#if item.kind === 'video'}
      <div class="gallery__video-badge">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path fill="currentColor" d="M8 5v14l11-7z"/>
        </svg>
      </div>
    {/if}
  </div>
{/snippet}

<div class="gallery">
  <div class="gallery__header">
    <div class="gallery__header-left">
      <button class="gallery__back" onclick={handleBackClick} title={inFolderDetail ? 'Back' : t('gallery.close')}>
        {#if inFolderDetail}
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        {/if}
      </button>
      <h2 class="gallery__title">{inFolderDetail ? gallery.selectedFolder : t('gallery.title')}</h2>
    </div>
    <div class="gallery__controls">
      {#if showExplorerBtn}
        <button
          class="gallery__explorer-btn"
          onclick={() => void handleShowInExplorer()}
          disabled={explorerLoading}
          title="Open in file manager"
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
          </svg>
          {explorerLoading ? 'Opening...' : 'Show in Explorer'}
        </button>
        {#if explorerError}
          <span class="gallery__explorer-error" title={explorerError}>Mount failed</span>
        {/if}
        <div class="gallery__separator"></div>
      {/if}
      <div class="gallery__tabs">
        {#each viewModes as mode}
          <button
            class="gallery__tab"
            class:gallery__tab--active={gallery.viewMode === mode.key}
            onclick={() => { gallery.viewMode = mode.key }}
          >
            {t(mode.label)}
          </button>
        {/each}
      </div>
      <div class="gallery__toggles">
        <button
          class="gallery__toggle-btn"
          class:gallery__toggle-btn--active={gallery.sizeMode === 'thumbnail'}
          onclick={() => { gallery.sizeMode = 'thumbnail' }}
          title={t('gallery.sizeSmall')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>
          </svg>
        </button>
        <button
          class="gallery__toggle-btn"
          class:gallery__toggle-btn--active={gallery.sizeMode === 'mosaic'}
          onclick={() => { gallery.sizeMode = 'mosaic' }}
          title={t('gallery.sizeLarge')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"/>
          </svg>
        </button>
        <button
          class="gallery__toggle-btn"
          class:gallery__toggle-btn--active={gallery.hideHidden}
          onclick={() => { gallery.hideHidden = !gallery.hideHidden }}
          title={t('gallery.toggleHidden')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            {#if gallery.hideHidden}
              <path fill="currentColor" d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
            {:else}
              <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            {/if}
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div class="gallery__body" bind:this={galleryBodyEl}>
    {#if gallery.scanState === 'scanning' && (gallery.viewMode === 'folders' || gallery.viewMode === 'all' || filteredItems.length === 0)}
      <div class="gallery__status">
        <div class="gallery__spinner"></div>
        <p>{t('gallery.scanning')}</p>
      </div>
    {:else if gallery.scanState === 'error'}
      <div class="gallery__status">
        {#if !isDeviceConnected}
          <svg viewBox="0 0 24 24" width="32" height="32" style="color: var(--text-muted);">
            <path fill="currentColor" d="M17 7h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.43-.98 2.63-2.31 2.98l1.46 1.46C20.88 15.61 22 13.95 22 12c0-2.76-2.24-5-5-5zm-1 4h-2.19l2 2H16v-2zM2 4.27l3.11 3.11C3.29 8.12 2 9.91 2 12c0 2.76 2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1 0-1.59 1.21-2.9 2.76-3.07L8.73 11H8v2h2.73L13 15.27V17h1.73l4.01 4L20 19.74 3.27 3 2 4.27z"/>
          </svg>
          <p class="gallery__error">Device not connected</p>
        {:else}
          <div class="gallery__spinner"></div>
          <p>{t('gallery.scanning')}</p>
        {/if}
      </div>
    {:else if gallery.viewMode === 'folders' && !inFolderDetail}
      <!-- Folder list with preview rows -->
      {#if folderGroups.length === 0}
        <div class="gallery__status">
          <p class="gallery__empty">{t('gallery.noFolders')}</p>
        </div>
      {:else}
        {#each folderGroups as group}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div class="gallery__folder-row" onclick={() => { gallery.selectedFolder = group.folder }}>
            <div class="gallery__folder-header">
              <svg viewBox="0 0 24 24" width="18" height="18" class="gallery__folder-icon">
                <path fill="currentColor" d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
              </svg>
              <span class="gallery__folder-name">{group.folder}</span>
              <span class="gallery__folder-count">{group.items.length}</span>
              <svg class="gallery__folder-chevron" viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </div>
            <div class="gallery__folder-preview" style:--cell-size="{cellSize}px">
              {#each group.items as item (item.path)}
                {@const thumbState = getThumbnailState(item.path)}
                <div class="gallery__cell gallery__cell--preview" data-path={item.path} use:observeCell>
                  {#if thumbState === 'ready'}
                    <img class="gallery__thumb" src={getGalleryThumbnailUrl(item.path)} alt={item.filename} loading="lazy" />
                  {:else if thumbState === 'failed'}
                    <div class="gallery__placeholder gallery__placeholder--failed">
                      <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                    </div>
                  {:else}
                    <div class="gallery__placeholder gallery__placeholder--loading">
                      <div class="gallery__shimmer"></div>
                    </div>
                  {/if}
                  {#if item.kind === 'video'}
                    <div class="gallery__video-badge">
                      <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    {:else}
      <!-- Full grid: DCIM / All / Folder detail -->
      {#if filteredItems.length === 0}
        <div class="gallery__status">
          <p class="gallery__empty">{t('gallery.empty')}</p>
        </div>
      {:else}
        <div class="gallery__grid" style:--cell-size="{cellSize}px">
          {#each filteredItems as item, index (item.path)}
            {@render galleryCell(item, filteredItems, index)}
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .gallery__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    min-width: 0;
    overflow: hidden;
  }

  .gallery__header-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    overflow: hidden;
  }

  .gallery__back {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    transition: color 0.15s;
  }

  .gallery__back:hover {
    color: var(--text-primary);
  }

  .gallery__title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gallery__controls {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-shrink: 0;
  }

  .gallery__explorer-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .gallery__explorer-btn:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
  }

  .gallery__explorer-btn:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .gallery__explorer-error {
    font-size: var(--font-size-xs);
    color: var(--danger);
    cursor: help;
  }

  .gallery__separator {
    width: 1px;
    height: 20px;
    background: var(--border);
  }

  .gallery__tabs {
    display: flex;
    gap: 1px;
    background: var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .gallery__tab {
    padding: var(--space-1) var(--space-3);
    background: var(--bg-secondary);
    border: none;
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: color 0.15s, background-color 0.15s;
  }

  .gallery__tab:hover {
    color: var(--text-primary);
  }

  .gallery__tab--active {
    background: var(--accent-primary);
    color: white;
  }

  .gallery__toggles {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .gallery__toggle-btn {
    background: none;
    border: 1px solid transparent;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    transition: color 0.15s, border-color 0.15s;
  }

  .gallery__toggle-btn:hover {
    color: var(--text-primary);
  }

  .gallery__toggle-btn--active {
    color: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .gallery__body {
    flex: 1;
    min-width: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: var(--space-3);
  }

  .gallery__status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8);
    gap: var(--space-3);
    color: var(--text-muted);
  }

  .gallery__spinner {
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

  .gallery__error {
    color: var(--danger);
  }

  .gallery__retry-btn {
    padding: var(--space-2) var(--space-4);
    background: var(--accent-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: var(--font-size-sm);
  }

  .gallery__empty {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    text-align: center;
    padding: var(--space-8);
  }

  /* Folder list rows */
  .gallery__folder-row {
    cursor: pointer;
    border-bottom: 1px solid var(--border);
    padding: var(--space-2) 0;
    overflow: hidden;
    transition: background-color 0.15s;
  }

  .gallery__folder-row:hover {
    background: var(--bg-hover);
  }

  .gallery__folder-row:last-child {
    border-bottom: none;
  }

  .gallery__folder-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    margin-bottom: var(--space-2);
  }

  .gallery__folder-icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .gallery__folder-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .gallery__folder-count {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    flex: 1;
  }

  .gallery__folder-chevron {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .gallery__folder-preview {
    display: flex;
    gap: 2px;
    overflow: hidden;
    padding: 0 var(--space-2);
  }

  .gallery__cell--preview {
    flex-shrink: 0;
    width: var(--cell-size);
    height: var(--cell-size);
    pointer-events: none;
  }

  /* Grid */
  .gallery__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--cell-size), 1fr));
    gap: 2px;
  }

  .gallery__cell {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 2px;
    cursor: pointer;
    background: var(--bg-secondary);
  }

  .gallery__cell:hover {
    opacity: 0.85;
  }

  .gallery__thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .gallery__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .gallery__placeholder--loading {
    overflow: hidden;
  }

  .gallery__placeholder--failed {
    color: var(--text-muted);
  }

  .gallery__shimmer {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--bg-secondary) 25%,
      var(--bg-hover) 50%,
      var(--bg-secondary) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .gallery__video-badge {
    position: absolute;
    bottom: 4px;
    right: 4px;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }
</style>
