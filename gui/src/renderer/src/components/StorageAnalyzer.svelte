<script lang="ts">
  import { onMount } from 'svelte'
  import { t } from '../stores/i18n.svelte'
  import { layoutTreemap, type TreemapItem, type TreemapRect } from '../lib/treemap'

  interface Props {
    onClose: () => void
  }

  const { onClose }: Props = $props()

  interface StorageResult {
    totalBytes: number
    freeBytes: number
    rootMode: boolean
    items: TreemapItem[]
    error?: string
  }

  let loading = $state(true)
  let error = $state('')
  let result = $state<StorageResult | null>(null)
  let rects = $state<TreemapRect[]>([])

  // Tooltip state
  let tooltipVisible = $state(false)
  let tooltipX = $state(0)
  let tooltipY = $state(0)
  let tooltipItem = $state<TreemapItem | null>(null)

  // SVG container dimensions (measured from DOM)
  let svgContainer: HTMLDivElement | undefined = $state()
  let svgWidth = $state(800)
  let svgHeight = $state(500)

  const CATEGORY_COLORS: Record<string, string> = {
    system: '#64748b',
    app: '#3b82f6',
    photos: '#22c55e',
    videos: '#f97316',
    audio: '#ec4899',
    downloads: '#eab308',
    other: '#6b7280',
  }

  /** Get base color for a category */
  function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category] ?? '#9ca3af'
  }

  /** Vary brightness slightly per item for visual distinction */
  function getItemColor(item: TreemapItem, index: number): string {
    const base = getCategoryColor(item.category)
    // Parse hex
    const r = parseInt(base.slice(1, 3), 16)
    const g = parseInt(base.slice(3, 5), 16)
    const b = parseInt(base.slice(5, 7), 16)
    // Alternate brightness by +-10%
    const factor = 1.0 + ((index % 3) - 1) * 0.08
    const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v * factor)))
    return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`
  }

  function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
    }
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  function toGB(bytes: number): string {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1)
  }

  onMount(() => {
    void analyze()
    measureContainer()
    const observer = new ResizeObserver(() => measureContainer())
    if (svgContainer) observer.observe(svgContainer)
    return () => observer.disconnect()
  })

  function measureContainer(): void {
    if (!svgContainer) return
    const rect = svgContainer.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      svgWidth = rect.width
      svgHeight = rect.height
    }
  }

  // Recompute treemap layout when dimensions or data change
  $effect(() => {
    if (result && result.items.length > 0 && svgWidth > 0 && svgHeight > 0) {
      rects = layoutTreemap(result.items, svgWidth, svgHeight)
    }
  })

  async function analyze(): Promise<void> {
    loading = true
    error = ''
    try {
      const raw = (await window.api.invoke('storage.analyze')) as StorageResult
      if (raw.error) {
        error = raw.error
      } else {
        result = {
          ...raw,
          items: (raw.items ?? []).sort((a, b) => b.bytes - a.bytes),
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : t('storage.error')
    } finally {
      loading = false
    }
  }

  function handleRectMouseEnter(rect: TreemapRect, e: MouseEvent): void {
    tooltipItem = rect.item
    tooltipVisible = true
    updateTooltipPos(e)
  }

  function handleRectMouseMove(e: MouseEvent): void {
    updateTooltipPos(e)
  }

  function handleRectMouseLeave(): void {
    tooltipVisible = false
    tooltipItem = null
  }

  function updateTooltipPos(e: MouseEvent): void {
    tooltipX = e.clientX + 12
    tooltipY = e.clientY + 12
  }

  /** Should we show a text label inside this rectangle? */
  function shouldShowLabel(rect: TreemapRect): boolean {
    return rect.w > 60 && rect.h > 28
  }

  /** Truncate label to fit width */
  function truncateLabel(text: string, width: number): string {
    const charWidth = 7 // approximate monospace char width
    const maxChars = Math.floor((width - 8) / charWidth)
    if (maxChars < 3) return ''
    if (text.length <= maxChars) return text
    return text.slice(0, maxChars - 1) + '\u2026'
  }

  /** Category display names for legend */
  const CATEGORY_LABELS: Record<string, string> = {
    system: 'System',
    app: 'Apps',
    photos: 'Photos',
    videos: 'Videos',
    audio: 'Audio',
    downloads: 'Downloads',
    other: 'Other',
  }
</script>

<div class="storage-analyzer">
  <div class="storage-analyzer__header">
    <button class="storage-analyzer__back" onclick={onClose} title={t('storage.close')}>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path
          fill="currentColor"
          d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
        />
      </svg>
    </button>
    <h2 class="storage-analyzer__title">{t('storage.title')}</h2>
    {#if result}
      <span class="storage-analyzer__summary">
        {formatBytes(result.totalBytes - result.freeBytes)} used of {toGB(result.totalBytes)} GB
        &middot; {toGB(result.freeBytes)} GB free
      </span>
    {/if}
  </div>

  {#if result && !loading}
    <!-- Legend -->
    <div class="storage-analyzer__legend">
      {#each Object.entries(CATEGORY_COLORS) as [cat, color]}
        <span class="storage-analyzer__legend-item">
          <span class="storage-analyzer__legend-dot" style="background-color: {color}"></span>
          {CATEGORY_LABELS[cat] ?? cat}
        </span>
      {/each}
    </div>

    <!-- Summary bar -->
    <div class="storage-analyzer__bar">
      {#each Object.entries(CATEGORY_COLORS) as [cat, color]}
        {@const catBytes = result.items
          .filter((it) => it.category === cat)
          .reduce((s, it) => s + it.bytes, 0)}
        {@const pct = (catBytes / result.totalBytes) * 100}
        {#if pct > 0.3}
          <div
            class="storage-analyzer__bar-seg"
            style="width: {pct}%; background-color: {color}"
            title="{CATEGORY_LABELS[cat] ?? cat}: {formatBytes(catBytes)}"
          ></div>
        {/if}
      {/each}
      <div
        class="storage-analyzer__bar-seg storage-analyzer__bar-seg--free"
        style="width: {(result.freeBytes / result.totalBytes) * 100}%"
        title="Free: {formatBytes(result.freeBytes)}"
      ></div>
    </div>
  {/if}

  {#if loading}
    <div class="storage-analyzer__loading">
      <div class="storage-analyzer__spinner"></div>
      <p class="storage-analyzer__loading-text">{t('storage.analyzing')}</p>
    </div>
  {:else if error}
    <div class="storage-analyzer__error">
      <p>{error}</p>
      <button class="storage-analyzer__retry" onclick={() => void analyze()}>Retry</button>
    </div>
  {:else if result}
    <!-- Treemap -->
    <div class="storage-analyzer__treemap" bind:this={svgContainer}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox="0 0 {svgWidth} {svgHeight}"
        xmlns="http://www.w3.org/2000/svg"
      >
        {#each rects as rect, i}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <g
            onmouseenter={(e) => handleRectMouseEnter(rect, e)}
            onmousemove={handleRectMouseMove}
            onmouseleave={handleRectMouseLeave}
          >
            <rect
              x={rect.x + 0.5}
              y={rect.y + 0.5}
              width={Math.max(0, rect.w - 1)}
              height={Math.max(0, rect.h - 1)}
              fill={getItemColor(rect.item, i)}
              stroke="rgba(0,0,0,0.3)"
              stroke-width="1"
            />
            {#if shouldShowLabel(rect)}
              <text
                x={rect.x + 4}
                y={rect.y + 15}
                class="storage-analyzer__label"
                clip-path="url(#clip-{i})"
              >
                {truncateLabel(rect.item.name, rect.w)}
              </text>
              {#if rect.h > 42}
                <text
                  x={rect.x + 4}
                  y={rect.y + 28}
                  class="storage-analyzer__label-size"
                  clip-path="url(#clip-{i})"
                >
                  {formatBytes(rect.item.bytes)}
                </text>
              {/if}
              <clipPath id="clip-{i}">
                <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} />
              </clipPath>
            {/if}
          </g>
        {/each}
      </svg>
    </div>

    {#if !result.rootMode}
      <p class="storage-analyzer__hint">{t('storage.noRoot')}</p>
    {/if}
  {/if}

  <!-- Tooltip -->
  {#if tooltipVisible && tooltipItem}
    <div
      class="storage-analyzer__tooltip"
      style="left: {tooltipX}px; top: {tooltipY}px"
    >
      <div class="storage-analyzer__tooltip-name">{tooltipItem.name}</div>
      <div class="storage-analyzer__tooltip-size">{formatBytes(tooltipItem.bytes)}</div>
      {#if result}
        <div class="storage-analyzer__tooltip-pct">
          {((tooltipItem.bytes / (result.totalBytes - result.freeBytes)) * 100).toFixed(1)}% of used
        </div>
      {/if}
      {#if tooltipItem.detail}
        <div class="storage-analyzer__tooltip-detail">{tooltipItem.detail}</div>
      {/if}
      <div class="storage-analyzer__tooltip-cat">
        <span
          class="storage-analyzer__legend-dot"
          style="background-color: {getCategoryColor(tooltipItem.category)}"
        ></span>
        {CATEGORY_LABELS[tooltipItem.category] ?? tooltipItem.category}
      </div>
    </div>
  {/if}
</div>

<style>
  .storage-analyzer {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .storage-analyzer__header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .storage-analyzer__back {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
  }

  .storage-analyzer__back:hover {
    color: var(--text-secondary);
    background-color: var(--bg-hover);
  }

  .storage-analyzer__title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin: 0;
  }

  .storage-analyzer__summary {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-left: auto;
  }

  .storage-analyzer__legend {
    display: flex;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .storage-analyzer__legend-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
  }

  .storage-analyzer__legend-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .storage-analyzer__bar {
    display: flex;
    height: 12px;
    margin: 0 var(--space-4) var(--space-2);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background-color: var(--bg-surface);
    flex-shrink: 0;
  }

  .storage-analyzer__bar-seg {
    min-width: 1px;
  }

  .storage-analyzer__bar-seg--free {
    background-color: var(--bg-surface);
  }

  .storage-analyzer__treemap {
    flex: 1;
    min-height: 0;
    margin: 0 var(--space-4) var(--space-4);
    border-radius: var(--radius-md);
    overflow: hidden;
    background-color: var(--bg-surface);
  }

  .storage-analyzer__treemap svg {
    display: block;
  }

  .storage-analyzer__label {
    font-size: 11px;
    fill: rgba(255, 255, 255, 0.9);
    font-weight: 600;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .storage-analyzer__label-size {
    font-size: 10px;
    fill: rgba(255, 255, 255, 0.7);
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .storage-analyzer__loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
  }

  .storage-analyzer__spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: sa-spin 0.8s linear infinite;
  }

  @keyframes sa-spin {
    to {
      transform: rotate(360deg);
    }
  }

  .storage-analyzer__loading-text {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
  }

  .storage-analyzer__error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    color: var(--danger);
    font-size: var(--font-size-sm);
  }

  .storage-analyzer__retry {
    background: var(--bg-hover);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    padding: var(--space-2) var(--space-4);
    cursor: pointer;
    font-size: var(--font-size-sm);
  }

  .storage-analyzer__retry:hover {
    background: var(--bg-surface);
  }

  .storage-analyzer__hint {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    padding: var(--space-2) var(--space-4);
    flex-shrink: 0;
  }

  .storage-analyzer__tooltip {
    position: fixed;
    z-index: 2000;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-3);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    pointer-events: none;
    max-width: 280px;
  }

  .storage-analyzer__tooltip-name {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .storage-analyzer__tooltip-size {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-family: monospace;
  }

  .storage-analyzer__tooltip-pct {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .storage-analyzer__tooltip-detail {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    font-family: monospace;
    word-break: break-all;
    margin-top: var(--space-1);
  }

  .storage-analyzer__tooltip-cat {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-top: var(--space-1);
  }
</style>
