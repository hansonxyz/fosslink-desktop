<script lang="ts">
  import { tick } from 'svelte'
  import {
    conversations,
    findThreadByAddress,
    selectConversation,
    setComposeAddress,
  } from '../stores/conversations.svelte'
  import { findContactByPhone } from '../stores/contacts.svelte'
  import { formatPhone } from '../lib/phone'
  import {
    sendMessage as queueSendMessage,
    getPendingMessages,
    clearPendingForThread,
    cancelSend,
    retrySend,
  } from '../stores/send-queue.svelte'
  import type { PendingMessage } from '../stores/send-queue.svelte'
  import ContactAutocomplete from './ContactAutocomplete.svelte'
  import { t } from '../stores/i18n.svelte'

  let resolvedAddress: string | null = $state(null)
  let hasSent = $state(false)
  let messageText = $state('')
  let textareaEl: HTMLTextAreaElement | undefined = $state()

  // MMS attachments
  let draftAttachments: DraftAttachment[] = $state([])
  let sizeWarning = $state('')
  const MAX_TOTAL_SIZE = 1 * 1024 * 1024
  const MAX_ATTACHMENT_COUNT = 10

  const resolvedDisplay = $derived.by(() => {
    if (!resolvedAddress) return null
    const contact = findContactByPhone(resolvedAddress)
    return contact ? contact.name : formatPhone(resolvedAddress)
  })

  const pendingMsgs = $derived(getPendingMessages(-1))
  const canSend = $derived((messageText.trim().length > 0 || draftAttachments.length > 0) && resolvedAddress !== null)

  function handleAddressSelect(address: string): void {
    // Check if there's an existing thread for this address
    const existingThread = findThreadByAddress(address)
    if (existingThread !== null) {
      selectConversation(existingThread)
      return
    }
    resolvedAddress = address
    setComposeAddress(address)
    // Focus the compose box after address is set
    tick().then(() => textareaEl?.focus())
  }

  function clearAddress(): void {
    resolvedAddress = null
    setComposeAddress('')
  }

  async function handleSend(): Promise<void> {
    if (!canSend || !resolvedAddress) return

    const body = messageText.trim()
    const attachments = [...draftAttachments]
    messageText = ''
    draftAttachments = []
    sizeWarning = ''
    resetTextareaHeight()
    hasSent = true

    void queueSendMessage(-1, resolvedAddress, body, attachments)

    await tick()
    textareaEl?.focus()
  }

  function classifyMime(mimeType: string): 'image' | 'video' | 'audio' | 'other' {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    return 'other'
  }

  function addDrafts(newDrafts: DraftAttachment[]): void {
    const totalCount = draftAttachments.length + newDrafts.length
    if (totalCount > MAX_ATTACHMENT_COUNT) {
      sizeWarning = t('messages.attachmentTooMany')
      const canAdd = MAX_ATTACHMENT_COUNT - draftAttachments.length
      if (canAdd > 0) {
        draftAttachments = [...draftAttachments, ...newDrafts.slice(0, canAdd)]
      }
      return
    }

    draftAttachments = [...draftAttachments, ...newDrafts]

    const totalSize = draftAttachments.reduce((sum, a) => sum + a.size, 0)
    if (totalSize > MAX_TOTAL_SIZE) {
      sizeWarning = t('messages.attachmentTooLarge')
    } else {
      sizeWarning = ''
    }
  }

  let dragOver = $state(false)

  function handleDragOver(e: DragEvent): void {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    dragOver = true
  }

  function handleDragLeave(): void {
    dragOver = false
  }

  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    e.stopPropagation()
    dragOver = false
    if (!e.dataTransfer?.files?.length) return

    try {
      const paths: string[] = []
      for (const file of e.dataTransfer.files) {
        const filePath = (file as File & { path?: string }).path
        if (filePath) paths.push(filePath)
      }
      if (paths.length === 0) return

      window.api.log('renderer', 'NewConversation drop: registering files', { count: String(paths.length) })
      const picked = await window.api.registerDraftFiles(paths)
      if (picked.length === 0) return

      const newDrafts: DraftAttachment[] = picked.map((p) => ({
        ...p,
        kind: classifyMime(p.mimeType),
      }))
      addDrafts(newDrafts)
    } catch (err) {
      window.api.log('renderer', 'NewConversation handleDrop error', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Listen for files dropped outside the compose area (handled by App.svelte)
  function handleExternalDrop(e: Event): void {
    const drafts = (e as CustomEvent<DraftAttachment[]>).detail
    if (drafts?.length) addDrafts(drafts)
  }

  $effect(() => {
    window.addEventListener('fosslink:external-drop', handleExternalDrop)
    return () => window.removeEventListener('fosslink:external-drop', handleExternalDrop)
  })

  async function handleAttach(): Promise<void> {
    try {
      window.api.log('renderer', 'NewConversation handleAttach called')
      const picked = await window.api.showOpenDialog()
      window.api.log('renderer', 'showOpenDialog returned', { count: String(picked.length) })
      if (picked.length === 0) return

      const newDrafts: DraftAttachment[] = picked.map((p) => ({
        ...p,
        kind: classifyMime(p.mimeType),
      }))
      addDrafts(newDrafts)
    } catch (err) {
      window.api.log('renderer', 'NewConversation handleAttach error', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  function removeDraft(draftId: string): void {
    draftAttachments = draftAttachments.filter((a) => a.draftId !== draftId)
    window.api.cleanupDrafts([draftId])

    const totalSize = draftAttachments.reduce((sum, a) => sum + a.size, 0)
    if (totalSize <= MAX_TOTAL_SIZE) {
      sizeWarning = ''
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  function handleInput(): void {
    if (!textareaEl) return
    textareaEl.style.height = 'auto'
    textareaEl.style.height = textareaEl.scrollHeight + 'px'
  }

  function resetTextareaHeight(): void {
    if (!textareaEl) return
    textareaEl.style.height = 'auto'
  }

  // Post-send transition: watch for real thread appearing
  $effect(() => {
    if (hasSent && conversations.composingNew && resolvedAddress) {
      const realThread = findThreadByAddress(resolvedAddress)
      if (realThread !== null) {
        clearPendingForThread(-1)
        selectConversation(realThread)
      }
    }
  })
</script>

<div class="new-conversation">
  <div class="new-conversation__header">
    <span class="new-conversation__label">{t('newMessage.to')}</span>
    {#if resolvedAddress}
      <div class="new-conversation__resolved">
        <span class="new-conversation__resolved-name">{resolvedDisplay}</span>
        <button
          class="new-conversation__resolved-clear"
          onclick={clearAddress}
          title={t('newMessage.changeRecipient')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    {:else}
      <ContactAutocomplete onSelect={handleAddressSelect} />
    {/if}
  </div>

  <div class="new-conversation__body">
    {#if pendingMsgs.length > 0}
      {#each pendingMsgs as pmsg (pmsg.queueId)}
        <div class="message-bubble message-bubble--sent">
          <div class="message-bubble__content message-bubble__content--pending">
            <p class="message-bubble__body">{pmsg.body}</p>
            <div class="message-bubble__status-row">
              {#if pmsg.status === 'sending'}
                <span class="message-bubble__status">{t('messages.sending')}</span>
                <button
                  class="message-bubble__cancel"
                  onclick={() => void cancelSend(pmsg.queueId)}
                  title={t('messages.cancel')}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              {:else if pmsg.status === 'sent'}
                <span class="message-bubble__status">{t('messages.sent')}</span>
              {:else if pmsg.status === 'timeout'}
                <span class="message-bubble__status message-bubble__status--error">{t('messages.failed')}</span>
                <button
                  class="message-bubble__action"
                  onclick={() => void retrySend(pmsg.queueId)}
                >{t('messages.retry')}</button>
                <button
                  class="message-bubble__cancel"
                  onclick={() => void cancelSend(pmsg.queueId)}
                  title={t('messages.cancel')}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                  </svg>
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {:else if resolvedAddress}
      <div class="new-conversation__empty">
        <p class="new-conversation__empty-text">{t('newMessage.startNew')}</p>
      </div>
    {:else}
      <div class="new-conversation__empty">
        <p class="new-conversation__empty-text">{t('newMessage.enterContact')}</p>
      </div>
    {/if}
  </div>

  {#if resolvedAddress}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="compose"
      class:compose--dragover={dragOver}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={(e) => void handleDrop(e)}
    >
      {#if dragOver}
        <div class="compose__drop-overlay">Drop files to attach</div>
      {/if}
      {#if draftAttachments.length > 0}
        <div class="compose__attachments">
          {#each draftAttachments as att (att.draftId)}
            <div class="compose__attachment-preview">
              {#if att.kind === 'image'}
                <img
                  src="xyzattachment://draft/{att.draftId}"
                  alt={att.fileName}
                  class="compose__attachment-thumb"
                />
              {:else if att.kind === 'video'}
                <div class="compose__attachment-icon compose__attachment-icon--video">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                </div>
              {:else if att.kind === 'audio'}
                <div class="compose__attachment-icon compose__attachment-icon--audio">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
              {:else}
                <div class="compose__attachment-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                  </svg>
                </div>
              {/if}
              <span class="compose__attachment-name" title={att.fileName}>
                {att.fileName}
              </span>
              <button
                class="compose__attachment-remove"
                onclick={() => removeDraft(att.draftId)}
                title={t('messages.removeAttachment')}
              >
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
          {/each}
        </div>
        {#if sizeWarning}
          <div class="compose__size-warning">{sizeWarning}</div>
        {/if}
      {/if}
      <div class="compose__row">
        <button
          class="compose__attach-btn"
          onclick={() => void handleAttach()}
          title={t('messages.attach')}
          type="button"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
          </svg>
        </button>
        <textarea
          class="compose__input"
          bind:this={textareaEl}
          bind:value={messageText}
          oninput={handleInput}
          onkeydown={handleKeydown}
          placeholder={t('messages.compose')}
          rows="1"
        ></textarea>
        <button
          class="compose__send"
          disabled={!canSend}
          onclick={() => void handleSend()}
          title={t('messages.send')}
          type="button"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .new-conversation {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .new-conversation__header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
    background-color: var(--bg-secondary);
  }

  .new-conversation__label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .new-conversation__resolved {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background-color: var(--bg-surface);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-md);
  }

  .new-conversation__resolved-name {
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: var(--font-weight-medium);
  }

  .new-conversation__resolved-clear {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
  }

  .new-conversation__resolved-clear:hover {
    color: var(--text-secondary);
  }

  .new-conversation__body {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4) 0;
  }

  .new-conversation__empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .new-conversation__empty-text {
    color: var(--text-muted);
    font-size: var(--font-size-base);
  }

  /* Pending message bubbles (same styles as MessageThread) */

  .message-bubble {
    display: flex;
    margin-bottom: var(--space-1);
    padding: 0 var(--space-4);
  }

  .message-bubble--sent {
    justify-content: flex-end;
  }

  .message-bubble__content {
    max-width: 65%;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-lg);
    word-wrap: break-word;
    overflow-wrap: break-word;
    background-color: var(--bubble-sent);
    border-bottom-right-radius: var(--radius-sm);
  }

  .message-bubble__content--pending {
    opacity: 0.7;
  }

  .message-bubble__body {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    line-height: 1.4;
    white-space: pre-wrap;
  }

  .message-bubble__status-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .message-bubble__status {
    font-size: var(--font-size-xs);
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
  }

  .message-bubble__status--error {
    color: var(--danger);
    font-style: normal;
  }

  .message-bubble__action {
    background: none;
    border: 1px solid var(--text-muted);
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .message-bubble__action:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }

  .message-bubble__cancel {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    margin-left: auto;
  }

  .message-bubble__cancel:hover {
    color: var(--danger);
  }

  /* Compose area (same styles as MessageThread) */

  .compose {
    padding: var(--space-2) var(--space-4);
    border-top: 1px solid var(--border);
    background-color: var(--bg-secondary);
  }

  .compose__row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }

  .compose__input {
    flex: 1;
    background-color: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--space-2) var(--space-3);
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    line-height: 1.4;
    resize: none;
    overflow-y: auto;
    max-height: calc(var(--font-size-sm) * 1.4 * 4 + var(--space-2) * 2 + 2px);
    outline: none;
    transition: border-color 0.15s;
  }

  .compose__input::placeholder {
    color: var(--text-muted);
  }

  .compose__input:focus {
    border-color: var(--accent-primary);
  }

  .compose__send {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--radius-full);
    background-color: var(--accent-primary);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s, opacity 0.15s;
  }

  .compose__send:hover:not(:disabled) {
    background-color: #4a7de0;
  }

  .compose__send:disabled {
    background-color: var(--bg-surface);
    color: var(--text-muted);
    cursor: default;
  }

  .compose__attach-btn {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--radius-full);
    background: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: color 0.15s;
  }

  .compose__attach-btn:hover {
    color: var(--text-secondary);
  }

  .compose__attachments {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-2) 0;
    overflow-x: auto;
    flex-wrap: nowrap;
  }

  .compose__attachment-preview {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 80px;
    flex-shrink: 0;
  }

  .compose__attachment-thumb {
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .compose__attachment-icon {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    background-color: var(--bg-surface);
    border: 1px solid var(--border);
    color: var(--text-muted);
  }

  .compose__attachment-icon--video {
    color: var(--accent-primary);
  }

  .compose__attachment-icon--audio {
    color: #9b59b6;
  }

  .compose__attachment-name {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    margin-top: 2px;
  }

  .compose__attachment-remove {
    position: absolute;
    top: -4px;
    right: 0;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-full);
    background-color: var(--danger);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .compose__attachment-preview:hover .compose__attachment-remove {
    opacity: 1;
  }

  .compose--dragover {
    outline: 2px dashed var(--accent-primary);
    outline-offset: -2px;
    background-color: rgba(75, 120, 220, 0.08);
  }

  .compose__drop-overlay {
    padding: var(--space-2) var(--space-3);
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--accent-primary);
    font-weight: var(--font-weight-medium);
  }

  .compose__size-warning {
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--danger);
  }
</style>
