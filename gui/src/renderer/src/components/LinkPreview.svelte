<script lang="ts">
  import { fetchPreview, getPreview, isPreviewLoading } from '../stores/link-previews.svelte'

  interface Props {
    url: string
  }

  const { url }: Props = $props()

  $effect(() => {
    fetchPreview(url)
  })

  const preview = $derived(getPreview(url))
  const loading = $derived(isPreviewLoading(url))

  function handleClick(): void {
    window.api.openExternal(url)
  }

  function getDomain(urlStr: string): string {
    try {
      return new URL(urlStr).hostname.replace(/^www\./, '')
    } catch {
      return urlStr
    }
  }

  function getImageSrc(p: LinkPreviewResult): string | null {
    if (!p.imageLocalPath) return null
    // Serve from the link-preview protocol host
    const fileName = p.imageLocalPath.split(/[/\\]/).pop()
    if (!fileName) return null
    return `xyzattachment://link-preview/${encodeURIComponent(fileName)}`
  }
</script>

{#if loading}
  <div class="link-preview link-preview--loading">
    <div class="link-preview__shimmer"></div>
  </div>
{:else if preview && preview.status === 'ok' && (preview.title || preview.description)}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="link-preview" onclick={handleClick}>
    {#if getImageSrc(preview)}
      <div class="link-preview__image-container">
        <img
          class="link-preview__image"
          src={getImageSrc(preview)}
          alt=""
          loading="lazy"
        />
      </div>
    {/if}
    <div class="link-preview__text">
      {#if preview.title}
        <div class="link-preview__title">{preview.title}</div>
      {/if}
      {#if preview.description}
        <div class="link-preview__description">{preview.description}</div>
      {/if}
      <div class="link-preview__domain">{preview.siteName ?? getDomain(url)}</div>
    </div>
  </div>
{/if}

<style>
  .link-preview {
    margin-top: var(--space-2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    overflow: hidden;
    cursor: pointer;
    background-color: rgba(0, 0, 0, 0.15);
    transition: background-color 0.15s;
    max-width: 320px;
  }

  .link-preview:hover {
    background-color: rgba(0, 0, 0, 0.25);
  }

  .link-preview--loading {
    height: 60px;
    cursor: default;
  }

  .link-preview__shimmer {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.03) 0%,
      rgba(255, 255, 255, 0.06) 50%,
      rgba(255, 255, 255, 0.03) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .link-preview__image-container {
    width: 100%;
    max-height: 160px;
    overflow: hidden;
  }

  .link-preview__image {
    width: 100%;
    height: auto;
    max-height: 160px;
    object-fit: cover;
    display: block;
  }

  .link-preview__text {
    padding: var(--space-2) var(--space-3);
  }

  .link-preview__title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }

  .link-preview__description {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    margin-top: 2px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    line-height: 1.3;
  }

  .link-preview__domain {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
