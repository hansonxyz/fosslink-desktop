<script lang="ts">
  import { closeLightbox, lightbox, navigateLightbox, openGalleryLightbox, updateLightboxSrc } from '../stores/lightbox.svelte'
  import { requestFullFile, getDownloadState, cancelOtherDownloads } from '../stores/gallery.svelte'

  /** Prefetch the next image ahead of the current gallery position */
  function prefetchAhead(): void {
    const items = lightbox.current?.galleryItems
    const idx = lightbox.current?.galleryIndex
    if (!items || idx === undefined) return

    // Don't prefetch if the current image is still downloading
    const currentPath = lightbox.current?.galleryPath
    if (currentPath) {
      const currentDl = getDownloadState(currentPath)
      if (currentDl.state === 'downloading') return
    }

    const nextIdx = idx + 1
    if (nextIdx >= items.length) return
    const item = items[nextIdx]!
    if (item.kind !== 'image') return
    const dl = getDownloadState(item.path)
    if (dl.state !== 'idle') return
    void requestFullFile(item.path, item.size).catch(() => {})
  }

  // Trigger prefetch whenever the gallery index changes
  $effect(() => {
    if (lightbox.current?.galleryItems && lightbox.current.galleryIndex !== undefined) {
      prefetchAhead()
    }
  })

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      if (isZoomed) {
        resetZoom()
      } else {
        closeLightbox()
      }
    }
  }

  function toggleVideoPlayback(video: HTMLVideoElement): void {
    if (video.ended) {
      video.currentTime = 0
      void video.play()
    } else if (video.paused) {
      void video.play()
    } else {
      video.pause()
    }
  }

  // Hidden proxy element that receives keyboard focus instead of the video's
  // shadow DOM controls. We redirect focus here after mouse interactions with
  // the video so that space/escape/arrows are handled by our code.
  let proxyEl: HTMLDivElement | undefined = $state()

  function handleProxyKeydown(e: KeyboardEvent): void {
    if (!lightbox.current) return

    if (e.key === 'Escape') {
      e.preventDefault()
      if (isZoomed) {
        resetZoom()
      } else {
        closeLightbox()
      }
      return
    }

    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault()
      if (lightbox.current.type === 'video') {
        const video = document.querySelector('.lightbox__media') as HTMLVideoElement | null
        if (video) toggleVideoPlayback(video)
      }
      return
    }

    if (lightbox.isGallery) {
      if (e.key === 'ArrowLeft' && lightbox.canPrev) {
        e.preventDefault()
        navigateAndLoad(-1)
      }
      if (e.key === 'ArrowRight' && lightbox.canNext) {
        e.preventDefault()
        navigateAndLoad(1)
      }
    }
  }

  // After any mouse interaction with the video (scrubbing, clicking controls),
  // pull focus back to our proxy so keyboard shortcuts work.
  function handleVideoMouseUp(): void {
    // Small delay to let the native control finish its click handling
    setTimeout(() => proxyEl?.focus(), 50)
  }

  // Also reclaim focus whenever it enters the video element
  function handleVideoFocusIn(): void {
    setTimeout(() => proxyEl?.focus(), 50)
  }

  // Focus the proxy when the lightbox opens
  $effect(() => {
    if (lightbox.current && proxyEl) {
      proxyEl.focus()
    }
  })

  function navigateAndLoad(dir: -1 | 1): void {
    navigateLightbox(dir)
    if (!lightbox.current?.galleryPath) return
    const path = lightbox.current.galleryPath
    const items = lightbox.current.galleryItems
    const index = lightbox.current.galleryIndex

    // Cancel all in-flight downloads except the current image
    cancelOtherDownloads(path)

    if (lightbox.current.type === 'video' && !lightbox.current.src) {
      // Video: download then show
      void requestFullFile(path).then((url) => {
        if (lightbox.current?.galleryPath === path && items && index !== undefined) {
          openGalleryLightbox('video', url, path, items, index)
        }
      })
    } else if (lightbox.current.type === 'image') {
      // Image: showing thumbnail, upgrade to full-res in background
      void requestFullFile(path).then((fullUrl) => {
        updateLightboxSrc(path, fullUrl)
      }).catch(() => {})
    }
  }

  // --- Zoom/pan (Signal-style) ---
  const ZOOM_SCALE = 3
  let isZoomed = $state(false)
  let zoomX = $state(0)
  let zoomY = $state(0)
  // Cached image dimensions at zoom time
  let zoomMaxX = 0
  let zoomMaxY = 0
  let zoomScreenW = 0
  let zoomScreenH = 0

  function handleImageClick(e: MouseEvent): void {
    const img = e.currentTarget as HTMLImageElement
    if (!img) return

    if (isZoomed) {
      // Unzoom
      isZoomed = false
      zoomX = 0
      zoomY = 0
      return
    }

    // Zoom in, centered on click point
    const rect = img.getBoundingClientRect()
    zoomMaxX = rect.width
    zoomMaxY = rect.height
    zoomScreenW = window.innerWidth
    zoomScreenH = window.innerHeight

    const offsetX = e.clientX - rect.left - rect.width / 2
    const offsetY = e.clientY - rect.top - rect.height / 2

    let posX = -offsetX * ZOOM_SCALE
    let posY = -offsetY * ZOOM_SCALE

    posX = clampPan(posX, zoomMaxX, zoomScreenW)
    posY = clampPan(posY, zoomMaxY, zoomScreenH)

    zoomX = posX
    zoomY = posY
    isZoomed = true
  }

  function handleMouseMove(e: MouseEvent): void {
    if (!isZoomed) return

    // Mouse position relative to screen center drives pan
    const offsetX = zoomScreenW / 2 - e.clientX
    const offsetY = zoomScreenH / 2 - e.clientY

    let posX = offsetX * ZOOM_SCALE
    let posY = offsetY * ZOOM_SCALE

    posX = clampPan(posX, zoomMaxX, zoomScreenW)
    posY = clampPan(posY, zoomMaxY, zoomScreenH)

    zoomX = posX
    zoomY = posY
  }

  function clampPan(value: number, imageSize: number, screenSize: number): number {
    const zoomedSize = imageSize * ZOOM_SCALE
    if (zoomedSize <= screenSize) return 0
    const max = (zoomedSize - screenSize) / 2
    return Math.max(-max, Math.min(max, value))
  }

  // Reset zoom when navigating or closing
  function resetZoom(): void {
    isZoomed = false
    zoomX = 0
    zoomY = 0
  }

  // Reset zoom when lightbox item changes
  $effect(() => {
    void lightbox.current?.galleryIndex
    void lightbox.current?.src
    resetZoom()
  })

  const isThumbnail = $derived(
    lightbox.current?.type === 'image' && lightbox.current.src.includes('gallery-thumb')
  )

  function handleContextMenu(e: MouseEvent): void {
    if (!lightbox.current) return
    e.preventDefault()
    if (lightbox.current.galleryPath) {
      window.api.showGalleryContextMenu(lightbox.current.galleryPath)
    } else {
      window.api.showAttachmentContextMenu(lightbox.current.partId, lightbox.current.messageId)
    }
  }

  function handleSave(): void {
    if (!lightbox.current) return
    if (lightbox.current.galleryPath) {
      window.api.saveGalleryFile(lightbox.current.galleryPath)
    } else {
      void window.api.saveAttachment(lightbox.current.partId, lightbox.current.messageId)
    }
  }
</script>

{#if lightbox.current}
  <!-- Hidden keyboard proxy — receives focus so space/escape/arrows work even after scrubbing -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="lightbox__key-proxy"
    bind:this={proxyEl}
    tabindex="0"
    onkeydown={handleProxyKeydown}
  ></div>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="lightbox" class:lightbox--zoomed={isZoomed} onclick={handleBackdropClick} onmousemove={handleMouseMove}>
    <div class="lightbox__toolbar" class:lightbox__toolbar--hidden={isZoomed}>
      <button class="lightbox__btn" onclick={handleSave} title="Save">
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>
      </button>
      <button class="lightbox__btn" onclick={closeLightbox} title="Close">
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>

    {#if lightbox.isGallery && lightbox.canPrev && !isZoomed}
      <button class="lightbox__nav lightbox__nav--prev" onclick={() => navigateAndLoad(-1)} title="Previous">
        <svg viewBox="0 0 24 24" width="36" height="36">
          <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
      </button>
    {/if}

    {#if lightbox.isGallery && lightbox.canNext && !isZoomed}
      <button class="lightbox__nav lightbox__nav--next" onclick={() => navigateAndLoad(1)} title="Next">
        <svg viewBox="0 0 24 24" width="36" height="36">
          <path fill="currentColor" d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
        </svg>
      </button>
    {/if}

    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="lightbox__content" onclick={(e) => e.stopPropagation()}>
      {#if lightbox.current.type === 'image'}
        <div class="lightbox__image-wrapper">
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
          <img
            class="lightbox__media"
            class:lightbox__media--zoomed={isZoomed}
            class:lightbox__media--loading={isThumbnail}
            src={lightbox.current.src}
            alt="Full size"
            onclick={handleImageClick}
            oncontextmenu={handleContextMenu}
            style:transform="translate({zoomX}px, {zoomY}px) scale({isZoomed ? ZOOM_SCALE : 1})"
          />
          {#if isThumbnail}
            <div class="lightbox__image-loading">
              <div class="lightbox__loading-spinner"></div>
            </div>
          {/if}
        </div>
      {:else if lightbox.current.src}
        <!-- svelte-ignore a11y_media_has_caption -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <video class="lightbox__media" src={lightbox.current.src} controls autoplay oncontextmenu={handleContextMenu} onmouseup={handleVideoMouseUp} onfocusin={handleVideoFocusIn}></video>
      {:else}
        <!-- Video loading -->
        <div class="lightbox__loading">
          <div class="lightbox__loading-spinner"></div>
          <p>Loading video...</p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .lightbox__key-proxy {
    position: fixed;
    width: 0;
    height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    z-index: 1002;
  }

  .lightbox {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lightbox__toolbar {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 1001;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .lightbox__btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s, background-color 0.15s;
  }

  .lightbox__btn:hover {
    color: white;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .lightbox__nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1001;
    background: rgba(0, 0, 0, 0.4);
    border: none;
    color: rgba(255, 255, 255, 0.7);
    cursor: pointer;
    padding: 12px 4px;
    border-radius: 4px;
    transition: color 0.15s, background-color 0.15s;
  }

  .lightbox__nav:hover {
    color: white;
    background-color: rgba(0, 0, 0, 0.6);
  }

  .lightbox__nav--prev {
    left: 16px;
  }

  .lightbox__nav--next {
    right: 16px;
  }

  .lightbox__content {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lightbox__image-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lightbox__media--loading {
    filter: brightness(0.5);
  }

  .lightbox__image-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .lightbox__media {
    /* Small media (e.g. 150x200 MMS): scale up to at least 2/3 of the
       smaller viewport dimension so it's not a postage stamp */
    min-width: min(66.67vw, 66.67vh);
    min-height: min(66.67vw, 66.67vh);
    /* Large media: cap at 90% viewport */
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 4px;
    cursor: zoom-in;
    transition: transform 0.15s ease-out;
  }

  .lightbox__media--zoomed {
    cursor: zoom-out;
    transition: none;
  }

  .lightbox--zoomed {
    cursor: zoom-out;
  }

  .lightbox__toolbar--hidden {
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
  }

  .lightbox__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: rgba(255, 255, 255, 0.7);
  }

  .lightbox__loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
