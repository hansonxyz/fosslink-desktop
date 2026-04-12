<script lang="ts">
  import { conversations } from '../stores/conversations.svelte'
  import { displayConversations } from '../stores/conversations.svelte'
  import { messages, displayMessages, loadThread, addPendingReaction } from '../stores/messages.svelte'
  import { pendingSyncThreads } from '../stores/connection.svelte'
  import { loadThreadMedia } from '../stores/gallery.svelte'
  import { clearAttachmentStates, requestDownload } from '../stores/attachments.svelte'
  import {
    sendMessage as queueSendMessage,
    getPendingMessages,
    cancelSend,
    retrySend,
  } from '../stores/send-queue.svelte'
  import type { PendingMessage } from '../stores/send-queue.svelte'
  import { TAPBACK_REACTIONS, parseTapback } from '../lib/tapback'
  import MessageBubble from './MessageBubble.svelte'
  import Avatar from './Avatar.svelte'
  import ContactDetail from './ContactDetail.svelte'
  import { findContactByPhone } from '../stores/contacts.svelte'
  import { getInitials, getAvatarColor } from '../lib/avatar'
  import { formatPhone } from '../lib/phone'
  import DialConfirmDialog from './DialConfirmDialog.svelte'
  import LinkPreview from './LinkPreview.svelte'
  import { t } from '../stores/i18n.svelte'
  import { scrollState } from '../stores/scroll.svelte'
  import { settings } from '../stores/settings.svelte'
  import { tick } from 'svelte'
  import 'emoji-picker-element'

  // Contact detail popup
  let showContactPopup = $state(false)

  // Dial confirmation
  let dialNumber = $state<string | null>(null)

  function promptDial(phoneNumber: string): void {
    dialNumber = phoneNumber
  }

  async function confirmDial(): Promise<void> {
    if (!dialNumber) return
    try {
      await window.api.invoke('phone.dial', { phoneNumber: dialNumber })
    } catch {
      // silently ignore — phone may not be connected
    }
    dialNumber = null
  }

  // Export thread as TXT or CSV
  let showExportMenu = $state(false)

  async function exportThread(format: 'txt' | 'csv'): Promise<void> {
    showExportMenu = false
    if (!selectedConversation || messages.rows.length === 0) return

    const safeName = selectedConversation.displayName.replace(/[<>:"/\\|?*]/g, '_')
    const ext = format
    const filters = format === 'csv'
      ? [{ name: 'CSV Files', extensions: ['csv'] }]
      : [{ name: 'Text Files', extensions: ['txt'] }]

    const filePath = await window.api.showSaveDialog(`${safeName}.${ext}`, filters)
    if (!filePath) return

    let content: string
    if (format === 'csv') {
      const header = t('export.csvHeader')
      const rows = messages.rows.map((row) => {
        const date = new Date(row.date).toISOString()
        const from = row.type === 2 ? t('export.me') : row.address
        const body = '"' + (row.body ?? '').replace(/"/g, '""') + '"'
        return `${date},${from},${body}`
      })
      content = header + '\n' + rows.join('\n')
    } else {
      const lines = messages.rows.map((row) => {
        const date = new Date(row.date).toLocaleString()
        const from = row.type === 2 ? t('export.me') : row.address
        return `[${date}] ${from}: ${row.body ?? ''}`
      })
      content = lines.join('\n')
    }

    await window.api.writeFile(filePath, content)
  }

  // Send message state
  let messageText = $state('')
  let textareaEl: HTMLTextAreaElement | undefined = $state()
  let showEmojiPicker = $state(false)
  let emojiPickerEl: HTMLDivElement | undefined = $state()

  // MMS attachments
  let draftAttachments: DraftAttachment[] = $state([])
  let sizeWarning = $state('')
  const MAX_TOTAL_SIZE = 1 * 1024 * 1024 // 1MB (conservative MMS limit)
  const MAX_ATTACHMENT_COUNT = 10

  const selectedConversation = $derived(
    displayConversations.current.find((c) => c.threadId === conversations.selectedThreadId) ?? null,
  )

  const headerContact = $derived(
    selectedConversation ? findContactByPhone(selectedConversation.addresses[0] ?? '') : undefined,
  )

  const isSyncPending = $derived(
    selectedConversation !== null && pendingSyncThreads.ids.has(selectedConversation.threadId),
  )

  const canSend = $derived(messageText.trim().length > 0 || draftAttachments.length > 0)

  // Compose link preview
  let composePreviewUrl = $state<string | null>(null)
  let dismissedPreviewUrl = $state<string | null>(null)
  let composeUrlDebounceTimer: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    const text = messageText
    if (composeUrlDebounceTimer) clearTimeout(composeUrlDebounceTimer)
    composeUrlDebounceTimer = setTimeout(() => {
      if (!settings.linkPreviewsEnabled) {
        composePreviewUrl = null
        return
      }
      const match = text.match(/https?:\/\/[^\s<>"']+/)
      if (match) {
        let url = match[0]
        const trailing = url.match(/[.,;:!?)]+$/)
        if (trailing) url = url.slice(0, -trailing[0].length)
        if (url !== dismissedPreviewUrl) {
          composePreviewUrl = url
        } else {
          composePreviewUrl = null
        }
      } else {
        composePreviewUrl = null
        dismissedPreviewUrl = null
      }
    }, 400)
  })

  // Pending messages for the current thread (hide tapback reactions — shown as emoji badges instead)
  const pendingMsgs = $derived(
    conversations.selectedThreadId !== null
      ? getPendingMessages(conversations.selectedThreadId).filter((m) => !parseTapback(m.body))
      : [],
  )

  async function handleSend(): Promise<void> {
    if (!canSend || !selectedConversation) {
      textareaEl?.focus()
      return
    }
    const address = selectedConversation.addresses[0]
    if (!address) {
      textareaEl?.focus()
      return
    }

    const body = messageText.trim()
    const threadId = selectedConversation.threadId
    const attachments = [...draftAttachments]

    // Clear compose state
    messageText = ''
    draftAttachments = []
    sizeWarning = ''
    composePreviewUrl = null
    dismissedPreviewUrl = null
    resetTextareaHeight()

    // Fire and forget — the send queue handles status tracking
    void queueSendMessage(threadId, address, body, attachments)

    await tick()
    textareaEl?.focus()
  }

  function handleReact(messageId: number, messageBody: string, verb: string): void {
    if (!selectedConversation) return
    const address = selectedConversation.addresses[0]
    if (!address) return

    // Truncate to ~50 chars like iPhone does for long messages
    let quoted = messageBody
    if (quoted.length > 50) {
      quoted = quoted.slice(0, 50) + '\u2026'
    }

    const tapbackBody = `${verb} \u201C${quoted}\u201D`
    const threadId = selectedConversation.threadId

    // Show reaction immediately (optimistic)
    const emoji = TAPBACK_REACTIONS.find((r) => r.verb === verb)?.emoji ?? '\u{1F44D}'
    addPendingReaction(messageId, emoji)

    void queueSendMessage(threadId, address, tapbackBody, [])
  }

  function classifyMime(mimeType: string): 'image' | 'video' | 'audio' | 'other' {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    return 'other'
  }

  async function handleAttach(): Promise<void> {
    try {
      window.api.log('renderer', 'handleAttach called')
      const picked = await window.api.showOpenDialog()
      window.api.log('renderer', 'showOpenDialog returned', { count: String(picked.length) })
      if (picked.length === 0) return

      const newDrafts: DraftAttachment[] = picked.map((p) => ({
        ...p,
        kind: classifyMime(p.mimeType),
      }))
      addDrafts(newDrafts)
    } catch (err) {
      window.api.log('renderer', 'handleAttach error', {
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
      // Electron File objects have a .path property
      const paths: string[] = []
      for (const file of e.dataTransfer.files) {
        const filePath = (file as File & { path?: string }).path
        if (filePath) paths.push(filePath)
      }
      if (paths.length === 0) return

      window.api.log('renderer', 'Drop: registering files', { count: String(paths.length) })
      const picked = await window.api.registerDraftFiles(paths)
      if (picked.length === 0) return

      const newDrafts: DraftAttachment[] = picked.map((p) => ({
        ...p,
        kind: classifyMime(p.mimeType),
      }))
      addDrafts(newDrafts)
    } catch (err) {
      window.api.log('renderer', 'handleDrop error', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  async function handlePaste(e: ClipboardEvent): Promise<void> {
    const files = e.clipboardData?.files
    if (!files || files.length === 0) return

    // Check if any pasted files are images
    const imageFiles: File[] = []
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        imageFiles.push(file)
      }
    }
    if (imageFiles.length === 0) return

    // Prevent default text paste for image content
    e.preventDefault()

    try {
      for (const file of imageFiles) {
        const buffer = await file.arrayBuffer()
        const fileName = file.name || `pasted_image_${Date.now()}.png`
        window.api.log('renderer', 'Paste: registering clipboard image', { fileName, mimeType: file.type })
        const result = await window.api.registerClipboardImage(buffer, fileName, file.type)
        addDrafts([{ ...result, kind: classifyMime(result.mimeType) }])
      }
    } catch (err) {
      window.api.log('renderer', 'handlePaste error', {
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

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  function handleInput(): void {
    if (!textareaEl) return
    // Auto-resize: reset to 1 row, then expand to content (max 4 rows via CSS)
    textareaEl.style.height = 'auto'
    textareaEl.style.height = textareaEl.scrollHeight + 'px'
  }

  function resetTextareaHeight(): void {
    if (!textareaEl) return
    textareaEl.style.height = 'auto'
  }

  function toggleEmojiPicker(): void {
    showEmojiPicker = !showEmojiPicker
  }

  function handleEmojiClick(e: Event): void {
    const detail = (e as CustomEvent).detail
    if (detail?.unicode) {
      // Insert emoji at cursor position
      if (textareaEl) {
        const start = textareaEl.selectionStart
        const end = textareaEl.selectionEnd
        const before = messageText.slice(0, start)
        const after = messageText.slice(end)
        messageText = before + detail.unicode + after
        // Move cursor after the inserted emoji
        requestAnimationFrame(() => {
          if (textareaEl) {
            const newPos = start + detail.unicode.length
            textareaEl.selectionStart = newPos
            textareaEl.selectionEnd = newPos
            textareaEl.focus()
            handleInput()
          }
        })
      } else {
        messageText += detail.unicode
      }
    }
  }

  // Close emoji picker and export menu when clicking outside
  function handleDocumentClick(e: MouseEvent): void {
    const target = e.target as HTMLElement
    if (showEmojiPicker) {
      if (emojiPickerEl && !emojiPickerEl.contains(target) && !target.closest('.compose__emoji-btn')) {
        showEmojiPicker = false
      }
    }
    if (showExportMenu) {
      if (!target.closest('.message-thread__export-wrapper')) {
        showExportMenu = false
      }
    }
  }

  // Wire up emoji-click event on the web component and close-on-outside-click
  $effect(() => {
    if (showEmojiPicker || showExportMenu) {
      document.addEventListener('click', handleDocumentClick)

      // Attach emoji-click listener to the web component (custom element event)
      const picker = showEmojiPicker ? emojiPickerEl?.querySelector('emoji-picker') : null
      if (picker) {
        picker.addEventListener('emoji-click', handleEmojiClick)
      }

      return () => {
        document.removeEventListener('click', handleDocumentClick)
        if (picker) {
          picker.removeEventListener('emoji-click', handleEmojiClick)
        }
      }
    }
  })

  // Close emoji picker, export menu, contact popup, and clear drafts on thread switch.
  // IMPORTANT: Guard with prevSelectedThread so that the effect doesn't clear
  // draftAttachments when it re-fires due to draftAttachments itself changing
  // (Svelte 5 $effect tracks all reactive reads as dependencies).
  let prevSelectedThread: number | null = null
  $effect(() => {
    const threadId = conversations.selectedThreadId
    if (threadId === prevSelectedThread) return
    prevSelectedThread = threadId
    showEmojiPicker = false
    showExportMenu = false
    showContactPopup = false
    if (draftAttachments.length > 0) {
      window.api.cleanupDrafts(draftAttachments.map((a) => a.draftId))
      draftAttachments = []
      sizeWarning = ''
    }
  })

  // Virtual scroll constants
  const EST_MSG_HEIGHT = 56
  const EST_SEPARATOR_HEIGHT = 40
  const EST_IMAGE_ATTACHMENT_HEIGHT = 208   // 200px placeholder + 8px gap
  const EST_AUDIO_ATTACHMENT_HEIGHT = 56    // 48px placeholder + 8px gap
  const BUFFER_ITEMS = 15

  let scrollContainer: HTMLDivElement | undefined = $state()
  let prevThreadId: number | null = null
  let prevMessageCount = 0
  let scrollTop = $state(0)
  let containerHeight = $state(600)
  let shouldAutoScroll = $state(true)

  // Scroll position preservation: track the first visible message and its
  // pixel offset from the viewport top. When older messages are prepended,
  // we use this anchor to restore the scroll position so the user's view
  // doesn't jump.
  let anchorMessageId: number | null = null
  let anchorViewportOffset = 0

  function updateScrollAnchor(): void {
    if (!scrollContainer) return
    const msgs = displayMessages.current
    const { offsets, heights, count } = layout
    if (count === 0) return

    const viewTop = scrollContainer.scrollTop

    // Binary search: first message whose bottom edge >= viewTop
    let lo = 0
    let hi = count - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (offsets[mid]! + heights[mid]! < viewTop) lo = mid + 1
      else hi = mid
    }

    if (lo < count) {
      anchorMessageId = msgs[lo]!.id
      anchorViewportOffset = offsets[lo]! - viewTop
    }
  }

  // Load thread when selection changes
  $effect(() => {
    const threadId = conversations.selectedThreadId
    if (threadId !== prevThreadId) {
      prevThreadId = threadId
      prevMessageCount = 0
      shouldAutoScroll = true
      scrollState.isAtBottom = true
      scrollTop = 0
      clearAttachmentStates()
      loadThread(threadId)
    }
  })

  // Compute cumulative Y offsets and per-item heights (cheap — just arithmetic)
  const layout = $derived.by(() => {
    const msgs = displayMessages.current
    const len = msgs.length
    const offsets: number[] = new Array(len)
    const heights: number[] = new Array(len)
    let y = 0
    for (let i = 0; i < len; i++) {
      offsets[i] = y
      let h = msgs[i]!.showTimestamp ? EST_MSG_HEIGHT + EST_SEPARATOR_HEIGHT : EST_MSG_HEIGHT
      // Add height for each attachment
      for (const att of msgs[i]!.attachments) {
        h += att.kind === 'audio' ? EST_AUDIO_ATTACHMENT_HEIGHT : EST_IMAGE_ATTACHMENT_HEIGHT
      }
      heights[i] = h
      y += h
    }
    return { offsets, heights, totalHeight: y, count: len }
  })

  // Determine visible range via binary search (only depends on layout + scroll position)
  const visible = $derived.by(() => {
    const { offsets, heights, totalHeight, count } = layout
    if (count === 0) return { start: 0, end: 0, topPad: 0, bottomPad: 0, totalHeight: 0 }

    const viewTop = scrollTop
    const viewBottom = scrollTop + containerHeight

    // Binary search: first item whose bottom edge >= viewTop
    let lo = 0
    let hi = count - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (offsets[mid]! + heights[mid]! < viewTop) lo = mid + 1
      else hi = mid
    }
    const start = Math.max(0, lo - BUFFER_ITEMS)

    // Binary search: last item whose top edge <= viewBottom
    lo = start
    hi = count - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (offsets[mid]! > viewBottom) hi = mid - 1
      else lo = mid
    }
    const end = Math.min(count, lo + 1 + BUFFER_ITEMS)

    const topPad = start > 0 ? offsets[start]! : 0
    const lastRendered = end - 1
    const bottomPad = end < count ? totalHeight - (offsets[lastRendered]! + heights[lastRendered]!) : 0

    return { start, end, topPad, bottomPad, totalHeight }
  })

  const visibleMessages = $derived(
    displayMessages.current.slice(visible.start, visible.end),
  )

  // Trigger attachment downloads for visible messages.
  // More reliable than per-component IntersectionObserver since the virtual
  // scroll already knows exactly which items are on screen.
  // Throttled: only runs at most once per 500ms to reduce overhead during
  // rapid scrolling and notification storms.
  let attCheckTimer: ReturnType<typeof setTimeout> | undefined
  let lastAttCheckRange = ''
  $effect(() => {
    const msgs = visibleMessages
    const rangeKey = `${visible.start}:${visible.end}`
    // Skip if the visible range hasn't changed
    if (rangeKey === lastAttCheckRange) return
    // Immediately process attachment downloads (cheap — mostly no-ops)
    for (const msg of msgs) {
      if (msg.attachments.length > 0) {
        requestDownload(msg.attachments)
      }
    }
    lastAttCheckRange = rangeKey
    // Throttle logging
    if (attCheckTimer === undefined) {
      attCheckTimer = setTimeout(() => {
        attCheckTimer = undefined
      }, 500)
      let withAtts = 0
      for (const msg of msgs) {
        if (msg.attachments.length > 0) withAtts++
      }
      if (msgs.length > 0) {
        window.api.log('renderer', 'Visible range attachment check', {
          visibleCount: String(msgs.length),
          withAttachments: String(withAtts),
          start: String(visible.start),
          end: String(visible.end),
        })
      }
    }
  })

  // Auto-scroll to bottom on load, or preserve scroll position during pagination
  $effect(() => {
    const count = displayMessages.current.length
    if (count > 0 && count !== prevMessageCount) {
      const hadMessages = prevMessageCount > 0
      prevMessageCount = count
      if (shouldAutoScroll) {
        scrollToBottom()
      } else if (hadMessages && anchorMessageId !== null) {
        // Older messages were prepended — restore scroll so the same
        // content stays in view
        const msgs = displayMessages.current
        const anchorIdx = msgs.findIndex((m) => m.id === anchorMessageId)
        if (anchorIdx >= 0) {
          const newOffset = layout.offsets[anchorIdx]!
          const targetScroll = newOffset - anchorViewportOffset
          requestAnimationFrame(() => {
            if (scrollContainer) {
              scrollContainer.scrollTop = targetScroll
              scrollTop = targetScroll
            }
          })
        }
      }
    }
  })

  // Auto-scroll when pending messages are added
  $effect(() => {
    if (pendingMsgs.length > 0 && shouldAutoScroll) {
      scrollToBottom()
    }
  })

  function scrollToBottom(): void {
    requestAnimationFrame(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    })
  }

  function animateScrollToBottom(): void {
    if (!scrollContainer) return
    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: 'smooth',
    })
    shouldAutoScroll = true
    scrollState.isAtBottom = true
  }

  function handleScroll(): void {
    if (!scrollContainer) return
    scrollTop = scrollContainer.scrollTop
    containerHeight = scrollContainer.clientHeight

    // If user scrolled near bottom, keep auto-scrolling for new messages
    const distanceFromBottom =
      scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight
    const wasAtBottom = shouldAutoScroll
    shouldAutoScroll = distanceFromBottom < 100
    scrollState.isAtBottom = shouldAutoScroll
    if (wasAtBottom !== shouldAutoScroll) {
      window.api.log('scroll', shouldAutoScroll ? 'At bottom (button hidden)' : 'Scrolled up (button visible)', {
        distanceFromBottom: String(Math.round(distanceFromBottom)),
        scrollHeight: String(scrollContainer.scrollHeight),
        scrollTop: String(Math.round(scrollContainer.scrollTop)),
        clientHeight: String(scrollContainer.clientHeight),
      })
    }

    // Track anchor for scroll position preservation during pagination
    updateScrollAnchor()
  }

  // Measure container height on mount
  $effect(() => {
    if (scrollContainer) {
      containerHeight = scrollContainer.clientHeight
    }
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="message-thread" onphonedial={(e: CustomEvent<string>) => promptDial(e.detail)}>
  {#if selectedConversation}
    <div class="message-thread__header">
      {#if headerContact}
        <button class="message-thread__header-info message-thread__header-info--clickable" onclick={() => { showContactPopup = true }}>
          <Avatar
            initials={selectedConversation.avatarInitials}
            color={selectedConversation.avatarColor}
            size={36}
            photo={selectedConversation.avatarPhoto}
          />
          <div class="message-thread__header-text">
            <h2 class="message-thread__name">{selectedConversation.displayName}{#if isSyncPending}<span class="message-thread__sync-pending"> - Sync Pending</span>{/if}</h2>
            {#if selectedConversation.addresses.length === 1}
              <span class="message-thread__address">{selectedConversation.addresses[0]}</span>
            {/if}
          </div>
        </button>
      {:else}
        <button class="message-thread__header-info message-thread__header-info--clickable" onclick={() => { showContactPopup = true }}>
          <Avatar
            initials={selectedConversation.avatarInitials}
            color={selectedConversation.avatarColor}
            size={36}
            photo={selectedConversation.avatarPhoto}
          />
          <div class="message-thread__header-text">
            <h2 class="message-thread__name">{selectedConversation.displayName}{#if isSyncPending}<span class="message-thread__sync-pending"> - Sync Pending</span>{/if}</h2>
          </div>
        </button>
      {/if}
      <div class="message-thread__header-actions">
        <button
          class="message-thread__icon-btn"
          onclick={() => {
            if (selectedConversation) {
              void loadThreadMedia(selectedConversation.threadId, selectedConversation.displayName)
              window.dispatchEvent(new Event('fosslink:open-gallery'))
            }
          }}
          title="View Media"
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
          </svg>
        </button>
        <button
          class="message-thread__icon-btn"
          onclick={() => promptDial(selectedConversation!.addresses[0]!)}
          title={t('dial.callBtn')}
        >
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
          </svg>
        </button>
        <div class="message-thread__export-wrapper">
          <button
            class="message-thread__icon-btn"
            onclick={() => { showExportMenu = !showExportMenu }}
            title={t('export.tooltip')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
          </button>
          {#if showExportMenu}
            <div class="message-thread__export-menu">
              <button class="message-thread__export-option" onclick={() => void exportThread('txt')}>
                {t('export.txt')}
              </button>
              <button class="message-thread__export-option" onclick={() => void exportThread('csv')}>
                {t('export.csv')}
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if messages.loading && messages.rows.length === 0}
    <div class="message-thread__status">
      <div class="message-thread__spinner"></div>
      <span>{t('messages.loading')}</span>
    </div>
  {:else if displayMessages.current.length === 0 && pendingMsgs.length === 0}
    <div class="message-thread__status">
      <span>{t('messages.empty')}</span>
    </div>
  {:else}
    <div
      class="message-thread__messages"
      bind:this={scrollContainer}
      onscroll={handleScroll}
    >
      <div style:height="{visible.topPad}px"></div>
      {#each visibleMessages as msg (msg.id)}
        {#if msg.showTimestamp}
          <div class="message-thread__timestamp">
            <span class="message-thread__timestamp-label">{msg.timestampLabel}</span>
          </div>
        {/if}
        <MessageBubble message={msg} onReact={handleReact} />
      {/each}
      <div style:height="{visible.bottomPad}px"></div>
      {#each pendingMsgs as pmsg (pmsg.queueId)}
        <div class="message-bubble message-bubble--sent">
          <div class="message-bubble__content message-bubble__content--pending">
            {#if pmsg.attachments.length > 0}
              <div class="message-bubble__pending-attachments">
                {#each pmsg.attachments as att}
                  {#if att.kind === 'image'}
                    <img
                      src="xyzattachment://draft/{att.draftId}"
                      alt={att.fileName}
                      class="message-bubble__pending-thumb"
                    />
                  {:else}
                    <div class="message-bubble__pending-file">{att.fileName}</div>
                  {/if}
                {/each}
              </div>
            {/if}
            {#if pmsg.body}
              <p class="message-bubble__body">{pmsg.body}</p>
            {/if}
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
              {:else if pmsg.status === 'timeout' || pmsg.status === 'failed'}
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
    </div>
    {#if !shouldAutoScroll}
      <button
        class="message-thread__scroll-bottom"
        onclick={animateScrollToBottom}
        title="Scroll to bottom"
      >
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path fill="currentColor" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/>
        </svg>
      </button>
    {/if}
  {/if}

  {#if showContactPopup && selectedConversation}
    {@const contactForPopup = headerContact ?? {
      uid: '',
      name: selectedConversation.displayName,
      phone_numbers: JSON.stringify(selectedConversation.addresses),
      photo_path: null,
      photo_mime: null,
      emails: null,
      addresses: null,
      organization: null,
      notes: null,
      birthday: null,
      nickname: null,
      account_type: null,
      account_name: null,
      timestamp: 0,
    } satisfies ContactRow}
    <ContactDetail
      contact={contactForPopup}
      avatarPhoto={selectedConversation.avatarPhoto ?? null}
      threadAddresses={selectedConversation.addresses}
      threadId={selectedConversation.threadId}
      onClose={() => { showContactPopup = false }}
      onDial={(num) => { showContactPopup = false; promptDial(num) }}
      onViewMedia={() => {
        showContactPopup = false
        if (selectedConversation) {
          void loadThreadMedia(selectedConversation.threadId, selectedConversation.displayName)
          // Dispatch event to open gallery in App.svelte
          window.dispatchEvent(new Event('fosslink:open-gallery'))
        }
      }}
    />
  {/if}

  {#if dialNumber}
    <DialConfirmDialog
      phoneNumber={dialNumber}
      onConfirm={() => void confirmDial()}
      onCancel={() => { dialNumber = null }}
    />
  {/if}

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
    {#if composePreviewUrl}
      <div class="compose__link-preview">
        <LinkPreview url={composePreviewUrl} />
        <button
          class="compose__link-preview-dismiss"
          onclick={() => { dismissedPreviewUrl = composePreviewUrl; composePreviewUrl = null }}
          type="button"
          title="Dismiss preview"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    {/if}
    <div class="compose__row">
      <div class="compose__emoji-wrapper">
        <button
          class="compose__emoji-btn"
          class:compose__emoji-btn--active={showEmojiPicker}
          onclick={toggleEmojiPicker}
          title={t('messages.emoji')}
          type="button"
        >
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
          </svg>
        </button>
        {#if showEmojiPicker}
          <div class="compose__emoji-popover" bind:this={emojiPickerEl}>
            <!-- svelte-ignore element_invalid_self_closing_tag -->
            <emoji-picker class="emoji-picker-dark" data-source="./emoji-data.json"></emoji-picker>
          </div>
        {/if}
      </div>
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
        onpaste={(e) => void handlePaste(e)}
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
</div>

<style>
  .message-thread {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
  }

  .message-thread__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
    background-color: var(--bg-secondary);
  }

  .message-thread__header-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    color: inherit;
    font: inherit;
  }

  .message-thread__header-info--clickable {
    cursor: pointer;
    border-radius: var(--radius-md);
    padding: var(--space-1);
    margin: calc(-1 * var(--space-1));
    transition: background-color 0.15s;
  }

  .message-thread__header-info--clickable:hover {
    background-color: var(--bg-hover);
  }

  .message-thread__header-text {
    min-width: 0;
  }

  .message-thread__name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .message-thread__sync-pending {
    font-weight: var(--font-weight-bold);
    color: var(--warning);
    font-size: var(--font-size-sm);
  }

  .message-thread__address {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
  }

  .message-thread__header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
  }

  .message-thread__icon-btn {
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

  .message-thread__icon-btn:hover {
    color: var(--text-secondary);
    background-color: var(--bg-hover);
  }

  .message-thread__export-wrapper {
    position: relative;
  }

  .message-thread__export-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: var(--space-1);
    background-color: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    z-index: 50;
    overflow: hidden;
  }

  .message-thread__export-option {
    display: block;
    width: 100%;
    padding: var(--space-2) var(--space-4);
    background: none;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-family);
    font-size: var(--font-size-sm);
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
  }

  .message-thread__export-option:hover {
    background-color: var(--bg-hover);
  }

  .message-thread__messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-4) 0;
  }

  .message-thread__scroll-bottom {
    position: absolute;
    bottom: 80px;
    right: 24px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: color 0.15s, background-color 0.15s;
    z-index: 10;
  }

  .message-thread__scroll-bottom:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }

  .message-thread__status {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    color: var(--text-muted);
    font-size: var(--font-size-sm);
  }

  .message-thread__spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--accent-primary);
    border-radius: var(--radius-full);
    animation: spin 0.8s linear infinite;
  }

  .message-thread__timestamp {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-3) var(--space-4);
  }

  .message-thread__timestamp-label {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    background-color: var(--bg-surface);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
  }

  /* --- Pending message bubbles --- */

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

  /* --- Compose area --- */

  .compose {
    padding: var(--space-2) var(--space-4);
    border-top: 1px solid var(--border);
    background-color: var(--bg-secondary);
  }

  .compose__link-preview {
    display: flex;
    align-items: flex-start;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-2) 0;
  }

  .compose__link-preview-dismiss {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 2px;
    border-radius: var(--radius-sm);
    margin-top: var(--space-2);
  }

  .compose__link-preview-dismiss:hover {
    color: var(--text-secondary);
    background-color: rgba(255, 255, 255, 0.08);
  }

  .compose__row {
    display: flex;
    align-items: flex-end;
    gap: var(--space-2);
  }

  .compose__emoji-wrapper {
    position: relative;
    flex-shrink: 0;
  }

  .compose__emoji-btn {
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
    transition: color 0.15s;
  }

  .compose__emoji-btn:hover {
    color: var(--text-secondary);
  }

  .compose__emoji-btn--active {
    color: var(--accent-primary);
  }

  .compose__emoji-popover {
    position: absolute;
    bottom: 44px;
    left: 0;
    z-index: 100;
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  }

  /* Style the emoji picker to match our dark theme */
  :global(emoji-picker.emoji-picker-dark) {
    --background: var(--bg-secondary);
    --border-color: var(--border);
    --input-border-color: var(--border);
    --input-font-color: var(--text-primary);
    --input-placeholder-color: var(--text-muted);
    --category-font-color: var(--text-muted);
    --indicator-color: var(--accent-primary);
    --button-active-background: var(--bg-hover);
    --button-hover-background: var(--bg-hover);
    --outline-color: var(--accent-primary);
    --text-color: var(--text-primary);
    --emoji-size: 1.4rem;
    --num-columns: 8;
    width: 320px;
    height: 360px;
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

  .compose__input:disabled {
    opacity: 0.5;
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
    opacity: 0.85;
  }

  .compose__send:disabled {
    background-color: var(--bg-surface);
    color: var(--text-muted);
    cursor: default;
  }

  /* --- Attachment compose --- */

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
    color: var(--accent-secondary);
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

  /* --- Pending message attachment thumbnails --- */

  .message-bubble__pending-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin-bottom: var(--space-1);
  }

  .message-bubble__pending-thumb {
    width: 120px;
    max-height: 120px;
    object-fit: cover;
    border-radius: var(--radius-md);
  }

  .message-bubble__pending-file {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    padding: var(--space-1) var(--space-2);
    background-color: rgba(0, 0, 0, 0.15);
    border-radius: var(--radius-sm);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
