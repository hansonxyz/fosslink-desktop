<script lang="ts">
  import {
    getAttachmentState,
    getAttachmentUrl,
    getThumbnailUrl,
  } from '../stores/attachments.svelte'
  import { openLightbox } from '../stores/lightbox.svelte'
  import { extractVerificationCode } from '../lib/verification'
  import { tryMarkCurrentThreadRead } from '../stores/messages.svelte'
  import { t } from '../stores/i18n.svelte'
  import { resolvedLocale } from '../stores/i18n.svelte'
  import { settings } from '../stores/settings.svelte'
  import LinkPreview from './LinkPreview.svelte'

  interface Props {
    message: DisplayMessage
  }

  const { message }: Props = $props()

  const hasAttachments = $derived(message.attachments.length > 0)
  const hasReactions = $derived(message.reactions.length > 0)

  // Find the first ready attachment for the save button
  const firstReadyAttachment = $derived(
    message.attachments.find(
      (att) => getAttachmentState(att.partId, att.messageId) === 'ready',
    ) ?? null,
  )

  const hasReadyAttachments = $derived(firstReadyAttachment !== null)

  function handleSave(): void {
    if (!firstReadyAttachment) return
    void window.api.saveAttachment(firstReadyAttachment.partId, firstReadyAttachment.messageId)
  }

  function handleAttachmentContextMenu(e: MouseEvent, partId: number, messageId: number): void {
    e.preventDefault()
    window.api.showAttachmentContextMenu(partId, messageId)
  }

  // Verification code copy button (received messages only)
  const verificationCode = $derived(
    !message.isSent && message.body ? extractVerificationCode(message.body) : null,
  )
  let codeCopied = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | undefined

  async function copyCode(): Promise<void> {
    if (!verificationCode) return
    await navigator.clipboard.writeText(verificationCode)
    codeCopied = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { codeCopied = false }, 2000)
    tryMarkCurrentThreadRead()
  }

  // --- URL linkification ---

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  // Phone number regex: matches common formats like +1 (555) 123-4567, 555-123-4567, (555) 123 4567, etc.
  const PHONE_REGEX = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g

  function isLikelyPhone(raw: string): boolean {
    const digits = raw.replace(/\D/g, '')
    return digits.length >= 7 && digits.length <= 15
  }

  function linkifyBody(text: string): string {
    // Combined regex: URLs first, then phone numbers
    const urlRegex = /https?:\/\/[^\s<>"']+/g
    const combined = new RegExp(`(${urlRegex.source})|(${PHONE_REGEX.source})`, 'g')

    let lastIndex = 0
    let result = ''
    let match: RegExpExecArray | null

    while ((match = combined.exec(text)) !== null) {
      result += escapeHtml(text.slice(lastIndex, match.index))

      if (match[1]) {
        // URL match
        let url = match[1]
        let trailing = ''
        const trailingMatch = url.match(/[.,;:!?)]+$/)
        if (trailingMatch) {
          trailing = trailingMatch[0]
          url = url.slice(0, -trailing.length)
        }
        result += `<a href="${escapeHtml(url)}" class="message-link">${escapeHtml(url)}</a>${escapeHtml(trailing)}`
      } else if (match[2] && isLikelyPhone(match[2])) {
        // Phone number match
        const phone = match[2]
        result += `<a href="#" data-phone="${escapeHtml(phone)}" class="message-phone-link">${escapeHtml(phone)}</a>`
      } else {
        result += escapeHtml(match[0])
      }

      lastIndex = match.index + match[0].length
    }

    result += escapeHtml(text.slice(lastIndex))
    return result
  }

  const linkedBody = $derived(message.body ? linkifyBody(message.body) : '')

  // Extract first URL for link preview
  const firstUrl = $derived(() => {
    if (!message.body) return null
    const match = message.body.match(/https?:\/\/[^\s<>"']+/)
    if (!match) return null
    // Strip trailing punctuation
    let url = match[0]
    const trailingMatch = url.match(/[.,;:!?)]+$/)
    if (trailingMatch) url = url.slice(0, -trailingMatch[0].length)
    return url
  })

  const hoverTimestamp = $derived(() => {
    const d = new Date(message.date)
    const locale = resolvedLocale.current
    return d.toLocaleString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  })

  function handleBodyClick(e: MouseEvent): void {
    const target = e.target as HTMLElement
    if (target.tagName === 'A' && target.classList.contains('message-link')) {
      e.preventDefault()
      const url = (target as HTMLAnchorElement).href
      window.api.openExternal(url)
    } else if (target.tagName === 'A' && target.classList.contains('message-phone-link')) {
      e.preventDefault()
      const phone = target.dataset.phone
      if (phone) {
        target.dispatchEvent(new CustomEvent('phonedial', { detail: phone, bubbles: true }))
      }
    }
  }
</script>

<div
  class="message-bubble"
  class:message-bubble--sent={message.isSent}
  class:message-bubble--received={!message.isSent}
>
  {#if message.isSent}
    <span class="message-bubble__hover-time">{hoverTimestamp()}</span>
  {/if}
  {#if message.isSent && hasReadyAttachments}
    <button class="message-bubble__save" onclick={handleSave} title={t('bubble.saveAttachment')}>
      <svg viewBox="0 0 24 24" width="38" height="38">
        <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
    </button>
  {/if}
  <div class="message-bubble__content" style="-webkit-user-select: text; user-select: text;">
    {#if hasAttachments}
      <div class="message-bubble__attachments">
        {#each message.attachments as att (att.partId)}
          {@const state = getAttachmentState(att.partId, att.messageId)}
          <div class="attachment-placeholder" class:attachment-placeholder--audio={att.kind === 'audio'}>
            {#if state === 'ready'}
              {#if att.kind === 'image'}
                <button
                  class="attachment-clickable"
                  onclick={() => openLightbox('image', getAttachmentUrl(att.partId, att.messageId), att.partId, att.messageId)}
                  oncontextmenu={(e) => handleAttachmentContextMenu(e, att.partId, att.messageId)}
                >
                  <img
                    class="attachment-media"
                    src={getAttachmentUrl(att.partId, att.messageId)}
                    alt={t('bubble.mmsAlt')}
                    loading="lazy"
                  />
                </button>
              {:else if att.kind === 'video'}
                <button
                  class="attachment-clickable"
                  onclick={() => openLightbox('video', getAttachmentUrl(att.partId, att.messageId), att.partId, att.messageId)}
                  oncontextmenu={(e) => handleAttachmentContextMenu(e, att.partId, att.messageId)}
                >
                  {#if att.hasThumbnail}
                    <img
                      class="attachment-media"
                      src={getThumbnailUrl(att.partId, att.messageId)}
                      alt={t('bubble.videoAlt')}
                      loading="lazy"
                    />
                  {:else}
                    <div class="attachment-video-placeholder">
                      <svg viewBox="0 0 24 24" width="40" height="40">
                        <path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                      </svg>
                    </div>
                  {/if}
                  <div class="attachment-play-overlay">
                    <svg viewBox="0 0 24 24" width="40" height="40">
                      <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.5)" stroke="white" stroke-width="1.5"/>
                      <path fill="white" d="M9.5 7.5v9l7-4.5z"/>
                    </svg>
                  </div>
                </button>
              {:else if att.kind === 'audio'}
                <div class="attachment-audio">
                  <svg viewBox="0 0 24 24" width="20" height="20" class="attachment-audio__icon">
                    <path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                  <!-- svelte-ignore a11y_media_has_caption -->
                  <audio
                    src={getAttachmentUrl(att.partId, att.messageId)}
                    controls
                    preload="metadata"
                    class="attachment-audio__player"
                  ></audio>
                </div>
              {:else}
                <a
                  class="attachment-download"
                  href={getAttachmentUrl(att.partId, att.messageId)}
                  download
                >
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                  </svg>
                  <span>{att.mimeType}</span>
                </a>
              {/if}
            {:else if state === 'downloading'}
              <div class="attachment-spinner"></div>
            {:else if state === 'error'}
              <div class="attachment-error">
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <span>{t('bubble.failedToLoad')}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
    {#if settings.linkPreviewsEnabled && firstUrl()}
      <LinkPreview url={firstUrl()} />
    {/if}
    {#if message.body}
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <p class="message-bubble__body" style="-webkit-user-select: text; user-select: text;" onclick={handleBodyClick}>{@html linkedBody}</p>
    {/if}
    {#if verificationCode}
      <button
        class="message-bubble__copy-code"
        onclick={() => void copyCode()}
      >
        {#if codeCopied}
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          {t('bubble.codeCopied', { code: verificationCode })}
        {:else}
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          {t('bubble.copyCode', { code: verificationCode })}
        {/if}
      </button>
    {/if}
    {#if hasReactions}
      <div class="message-bubble__reactions">
        {#each message.reactions as reaction}
          <span class="message-bubble__reaction" title={reaction.senderName ?? ''}>{reaction.emoji}</span>
        {/each}
      </div>
    {/if}
  </div>
  {#if !message.isSent && hasReadyAttachments}
    <button class="message-bubble__save" onclick={handleSave} title={t('bubble.saveAttachment')}>
      <svg viewBox="0 0 24 24" width="38" height="38">
        <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
      </svg>
    </button>
  {/if}
  {#if !message.isSent}
    <span class="message-bubble__hover-time">{hoverTimestamp()}</span>
  {/if}
</div>

<style>
  .message-bubble {
    display: flex;
    align-items: center;
    margin-bottom: var(--space-1);
    padding: 0 var(--space-4);
  }

  .message-bubble--sent {
    justify-content: flex-end;
  }

  .message-bubble--received {
    justify-content: flex-start;
  }

  .message-bubble__content {
    max-width: 65%;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-lg);
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .message-bubble--sent .message-bubble__content {
    background-color: var(--bubble-sent);
    border-bottom-right-radius: var(--radius-sm);
  }

  .message-bubble--received .message-bubble__content {
    background-color: var(--bubble-received);
    border-bottom-left-radius: var(--radius-sm);
  }

  .message-bubble__body {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    line-height: 1.4;
    white-space: pre-wrap;
    cursor: text;
  }

  .message-bubble__body :global(.message-link) {
    color: #6ea8fe;
    text-decoration: underline;
    cursor: pointer;
  }

  .message-bubble__body :global(.message-link:hover) {
    color: #9ec5fe;
  }

  .message-bubble__body :global(.message-phone-link) {
    color: #6ea8fe;
    text-decoration: underline;
    text-decoration-style: dotted;
    cursor: pointer;
  }

  .message-bubble__body :global(.message-phone-link:hover) {
    color: #9ec5fe;
    text-decoration-style: solid;
  }

  .message-bubble__save {
    align-self: center;
    opacity: 0;
    transition: opacity 0.15s;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.35);
    cursor: pointer;
    padding: 4px;
    margin: 0 2px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .message-bubble__save:hover {
    color: rgba(255, 255, 255, 0.6);
    background-color: rgba(255, 255, 255, 0.08);
  }

  .message-bubble:hover .message-bubble__save {
    opacity: 1;
  }

  .message-bubble__hover-time {
    align-self: center;
    opacity: 0;
    transition: opacity 0.15s;
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    white-space: nowrap;
    padding: 0 var(--space-2);
    pointer-events: none;
    flex-shrink: 0;
  }

  .message-bubble:hover .message-bubble__hover-time {
    opacity: 1;
  }

  .message-bubble__copy-code {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    margin-top: var(--space-2);
    padding: var(--space-1) var(--space-2);
    background-color: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    font-family: var(--font-family);
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .message-bubble__copy-code:hover {
    background-color: rgba(255, 255, 255, 0.14);
    color: var(--text-primary);
  }

  /* --- Reaction badges --- */

  .message-bubble__reactions {
    display: flex;
    gap: 2px;
    margin-top: var(--space-1);
  }

  .message-bubble--sent .message-bubble__reactions {
    justify-content: flex-end;
  }

  .message-bubble__reaction {
    font-size: 16px;
    line-height: 1;
    padding: 2px 4px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-full);
    cursor: default;
  }

  /* --- Attachment styles --- */

  .message-bubble__attachments {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-bottom: var(--space-1);
  }

  .attachment-placeholder {
    width: 240px;
    height: 200px;
    border-radius: var(--radius-md);
    background-color: rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .attachment-placeholder--audio {
    height: 48px;
    width: 240px;
  }

  .attachment-clickable {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .attachment-media {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: var(--radius-md);
  }

  .attachment-video-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--text-muted);
  }

  .attachment-play-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.85;
    transition: opacity 0.15s;
  }

  .attachment-clickable:hover .attachment-play-overlay {
    opacity: 1;
  }

  .attachment-spinner {
    width: 24px;
    height: 24px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.7);
    border-radius: var(--radius-full);
    animation: spin 0.8s linear infinite;
  }

  .attachment-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .attachment-audio {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: 0 var(--space-2);
  }

  .attachment-audio__icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .attachment-audio__player {
    flex: 1;
    height: 32px;
    min-width: 0;
  }

  .attachment-download {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    color: var(--text-muted);
    font-size: var(--font-size-xs);
    text-decoration: none;
    cursor: pointer;
  }

  .attachment-download:hover {
    color: var(--text-secondary);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
