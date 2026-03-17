<script lang="ts">
  interface Props {
    onClose: () => void
  }

  import { t } from '../stores/i18n.svelte'

  let { onClose }: Props = $props()

  function handleBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="about-overlay" onclick={handleBackdropClick}>
  <div class="about-dialog">
    <button class="about-dialog__close" onclick={onClose} title={t('about.close')}>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>

    <div class="about-dialog__content">
      <h2 class="about-dialog__name">{t('about.name')}</h2>
      <p class="about-dialog__version">{t('about.version')}</p>

      <div class="about-dialog__divider"></div>

      <p class="about-dialog__credit">
        {t('about.credit')}<br>
        <a href="https://github.com/hansonxyz/" target="_blank" rel="noopener noreferrer">github.com/hansonxyz</a>
      </p>

      <p class="about-dialog__license">
        {t('about.releasedUnder')}
        <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noopener noreferrer"><strong>{t('about.mitLicense')}</strong></a>
      </p>

      <div class="about-dialog__divider"></div>

      <div class="about-dialog__acknowledgments">
        <p class="about-dialog__ack-title">{t('about.acknowledgments')}</p>
        <ul class="about-dialog__ack-list">
          <li><a href="https://ffmpeg.org/" target="_blank" rel="noopener noreferrer">FFmpeg</a> &mdash; {t('about.ffmpegDesc')}</li>
          <li><a href="https://www.electronjs.org/" target="_blank" rel="noopener noreferrer">Electron</a> &mdash; {t('about.electronDesc')}</li>
          <li><a href="https://svelte.dev/" target="_blank" rel="noopener noreferrer">Svelte</a> &mdash; {t('about.svelteDesc')}</li>
        </ul>
      </div>

      <div class="about-dialog__divider"></div>

      <p class="about-dialog__source">
        {t('about.sourceAvailable')}<br>
        <a href="https://github.com/hansonxyz/fosslink" target="_blank" rel="noopener noreferrer">github.com/hansonxyz/fosslink</a>
      </p>

      <p class="about-dialog__tagline">
        {t('about.tagline')}
      </p>
    </div>
  </div>
</div>

<style>
  .about-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .about-dialog {
    position: relative;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-8) var(--space-8) var(--space-6);
    max-width: 506px;
    width: 90vw;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  }

  .about-dialog__close {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
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

  .about-dialog__close:hover {
    color: var(--text-secondary);
    background-color: var(--bg-hover);
  }

  .about-dialog__content {
    text-align: center;
  }

  .about-dialog__name {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin: 0;
    letter-spacing: 0.02em;
  }

  .about-dialog__version {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin: var(--space-1) 0 0;
  }

  .about-dialog__divider {
    height: 1px;
    background-color: var(--border);
    margin: var(--space-4) auto;
    width: 60%;
  }

  .about-dialog__credit {
    font-size: var(--font-size-base);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.6;
  }

  .about-dialog__credit a {
    color: var(--accent-primary);
    text-decoration: none;
  }

  .about-dialog__credit a:hover {
    text-decoration: underline;
  }

  .about-dialog__license {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin: var(--space-2) 0 0;
  }

  .about-dialog__license a {
    color: var(--accent-primary);
    text-decoration: none;
  }

  .about-dialog__license a:hover {
    text-decoration: underline;
  }

  .about-dialog__license strong {
    color: var(--text-primary);
    font-weight: var(--font-weight-medium);
  }

  .about-dialog__acknowledgments {
    text-align: center;
  }

  .about-dialog__ack-title {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 var(--space-2);
    text-align: center;
  }

  .about-dialog__ack-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .about-dialog__ack-list li {
    padding: var(--space-1) 0;
  }

  .about-dialog__ack-list a {
    color: var(--accent-primary);
    text-decoration: none;
    font-weight: var(--font-weight-medium);
  }

  .about-dialog__ack-list a:hover {
    text-decoration: underline;
  }

  .about-dialog__source {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin: 0;
    line-height: 1.6;
  }

  .about-dialog__source a {
    color: var(--accent-primary);
    text-decoration: none;
  }

  .about-dialog__source a:hover {
    text-decoration: underline;
  }

  .about-dialog__tagline {
    font-size: var(--font-size-sm);
    color: var(--text-muted);
    margin: var(--space-4) 0 0;
    font-style: italic;
    line-height: 1.6;
  }
</style>
