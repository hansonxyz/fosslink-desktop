/**
 * Link Preview Store
 *
 * Manages fetching and caching of URL link previews in the renderer.
 * Components call fetchPreview(url) and reactively read getPreview(url).
 */

const cache = new Map<string, LinkPreviewResult>()
const pending = new Set<string>()
let version = $state(0)

export function getPreview(url: string): LinkPreviewResult | null {
  // Read version to establish reactive dependency
  void version
  return cache.get(url) ?? null
}

export function isPreviewLoading(url: string): boolean {
  void version
  return pending.has(url)
}

export function fetchPreview(url: string): void {
  if (cache.has(url) || pending.has(url)) return

  pending.add(url)
  version++

  window.api.fetchLinkPreview(url).then((result) => {
    cache.set(url, result)
    pending.delete(url)
    version++
  }).catch(() => {
    pending.delete(url)
    version++
  })
}
