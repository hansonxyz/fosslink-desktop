/**
 * Lightbox Store
 *
 * Manages the full-screen media viewer state.
 * Opening the lightbox shows an image or video in an overlay.
 * Supports gallery navigation (prev/next) when opened from the gallery.
 */

import type { GalleryItem } from './gallery.svelte'
import { getDownloadState, getGalleryFileUrl } from './gallery.svelte'

interface LightboxState {
  type: 'image' | 'video'
  src: string
  partId: number
  messageId: number
  /** Gallery context for prev/next navigation */
  galleryItems?: GalleryItem[]
  galleryIndex?: number
  /** Phone file path for gallery context menu */
  galleryPath?: string
}

let current: LightboxState | null = $state(null)

export function openLightbox(type: 'image' | 'video', src: string, partId: number, messageId: number): void {
  current = { type, src, partId, messageId }
}

/** Open lightbox from gallery with prev/next navigation context */
export function openGalleryLightbox(
  type: 'image' | 'video',
  src: string,
  filePath: string,
  galleryItems: GalleryItem[],
  galleryIndex: number,
): void {
  current = {
    type,
    src,
    partId: 0,
    messageId: 0,
    galleryItems,
    galleryIndex,
    galleryPath: filePath,
  }
}

export function closeLightbox(): void {
  current = null
}

/** Update the src of the current lightbox item (e.g. upgrade thumbnail to full-res) */
export function updateLightboxSrc(galleryPath: string, newSrc: string): void {
  if (current && current.galleryPath === galleryPath) {
    current = { ...current, src: newSrc }
  }
}

/** Navigate prev (-1) or next (+1) within gallery items */
export function navigateLightbox(direction: -1 | 1): void {
  if (!current?.galleryItems || current.galleryIndex === undefined) return
  const newIndex = current.galleryIndex + direction
  if (newIndex < 0 || newIndex >= current.galleryItems.length) return

  const item = current.galleryItems[newIndex]
  const isVideo = item.kind === 'video'

  // Use full-res URL if already downloaded, otherwise fall back to thumbnail
  let src = ''
  if (!isVideo) {
    const dl = getDownloadState(item.path)
    src = dl.state === 'ready'
      ? getGalleryFileUrl(item.path)
      : `xyzattachment://gallery-thumb/${encodeURIComponent(item.path)}`
  }

  current = {
    type: isVideo ? 'video' : 'image',
    src,
    partId: 0,
    messageId: 0,
    galleryItems: current.galleryItems,
    galleryIndex: newIndex,
    galleryPath: item.path,
  }
}

export const lightbox = {
  get current(): LightboxState | null {
    return current
  },
  get isGallery(): boolean {
    return current?.galleryItems !== undefined
  },
  get canPrev(): boolean {
    return (current?.galleryIndex ?? 0) > 0
  },
  get canNext(): boolean {
    if (!current?.galleryItems || current.galleryIndex === undefined) return false
    return current.galleryIndex < current.galleryItems.length - 1
  },
}
