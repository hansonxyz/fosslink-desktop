<script lang="ts">
  import { onMount } from 'svelte'
  import { t } from '../stores/i18n.svelte'
  import { backupState } from '../stores/backup-state.svelte'

  interface Props {
    onClose: () => void
  }

  const { onClose }: Props = $props()

  type ExportKind = 'threads' | 'gallery' | 'screenshots' | 'images' | 'folders'
  type ThreadsFormat = 'txt' | 'xml' | 'html'
  type Phase = 'configure' | 'confirm-overwrite' | 'running' | 'complete' | 'error'

  let kind = $state<ExportKind>('threads')
  let threadsFormat = $state<ThreadsFormat>('txt')
  // The user's preferred setting. HTML overrides to true while selected.
  let includeMedia = $state(true)
  // HTML requires attachments — thumbnails are clickable into local files.
  const effectiveIncludeMedia = $derived(threadsFormat === 'html' ? true : includeMedia)
  const mediaCheckboxDisabled = $derived(threadsFormat === 'html')
  let phase = $state<Phase>('configure')

  // Runtime state for the running/complete/error phases
  let activeBackupId = $state<string | null>(null)
  let activeTargetDir = $state<string | null>(null)
  let percent = $state(0)
  let statusLine = $state('')
  let logLines = $state<string[]>([])
  let consoleEl: HTMLDivElement | undefined = $state()
  type ThreadSummary = {
    kind: 'threads'
    threadsWritten: number
    messagesWritten: number
    attachmentsWritten: number
    elapsedMs: number
    errors: number
  }
  type MediaSummary = {
    kind: 'media'
    filesWritten: number
    filesSkipped: number
    bytesWritten: number
    elapsedMs: number
    errors: number
  }
  type CompleteSummary = ThreadSummary | MediaSummary
  let completeSummary = $state<CompleteSummary | null>(null)
  let errorMessage = $state('')

  const MAX_LOG_LINES = 200

  function appendLog(line: string): void {
    logLines.push(line)
    while (logLines.length > MAX_LOG_LINES) logLines.shift()
    queueMicrotask(() => {
      if (consoleEl) consoleEl.scrollTop = consoleEl.scrollHeight
    })
  }

  onMount(() => {
    const handleNotification = (method: string, params: unknown): void => {
      const data = params as { backupId?: string } & Record<string, unknown>
      if (!data || data.backupId !== activeBackupId) return

      if (method === 'backup.progress') {
        const p = data as { percent: number; line: string; status?: string }
        percent = p.percent
        if (typeof p.status === 'string') statusLine = p.status
        appendLog(p.line)
      } else if (method === 'backup.complete') {
        completeSummary = data as unknown as CompleteSummary
        percent = 100
        phase = 'complete'
      } else if (method === 'backup.cancelled') {
        appendLog('Cancelled.')
        statusLine = ''
        phase = 'complete'
        completeSummary = null
      } else if (method === 'backup.error') {
        errorMessage = (data as { message: string }).message
        phase = 'error'
      }
    }

    window.api.onNotification(handleNotification)
    return () => {
      window.api.offNotification(handleNotification)
      backupState.running = false
    }
  })

  // Keep the global flag in sync with the running phase so the sidebar
  // overlay appears exactly while the export is in flight.
  $effect(() => {
    backupState.running = phase === 'running'
  })

  async function clickExport(): Promise<void> {
    const targetDir = await window.api.showDirectoryDialog(t('backup.title'))
    if (!targetDir) return

    const folderInfo = (await window.api.invoke('backup.check_folder', { targetDir })) as {
      exists: boolean
      empty: boolean
      writable: boolean
    }
    if (!folderInfo.writable) {
      errorMessage = 'Target folder is not writable.'
      phase = 'error'
      return
    }
    activeTargetDir = targetDir

    if (!folderInfo.empty) {
      phase = 'confirm-overwrite'
    } else {
      await startExport()
    }
  }

  async function startExport(): Promise<void> {
    if (!activeTargetDir) return
    logLines = []
    percent = 0
    statusLine = ''
    phase = 'running'
    try {
      let result: { backupId: string }
      if (kind === 'threads') {
        result = (await window.api.invoke('backup.threads_start', {
          targetDir: activeTargetDir,
          format: threadsFormat,
          includeMedia: effectiveIncludeMedia,
        })) as { backupId: string }
      } else {
        // Gallery / Screenshots / All Images / Folders all go through
        // media_start — kind name matches the daemon's scope name 1:1.
        result = (await window.api.invoke('backup.media_start', {
          targetDir: activeTargetDir,
          scope: kind,
        })) as { backupId: string }
      }
      activeBackupId = result.backupId
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err)
      phase = 'error'
    }
  }

  async function confirmOverwriteYes(): Promise<void> {
    await startExport()
  }

  function confirmOverwriteNo(): void {
    activeTargetDir = null
    phase = 'configure'
  }

  async function clickCancel(): Promise<void> {
    if (!activeBackupId) return
    await window.api.invoke('backup.cancel', { backupId: activeBackupId })
    // Wait for backup.cancelled notification to drive the next phase.
  }

  function clickDone(): void {
    onClose()
  }

  function formatBytesLabel(n: number): string {
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
  }
</script>

<div class="backup">
  <div class="backup__header">
    <button class="backup__back" onclick={onClose} title="Back" disabled={phase === 'running'}>
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
    </button>
    <h2 class="backup__title">{t('backup.title')}</h2>
  </div>

  <div class="backup__content">
    {#if phase === 'configure'}
      <p class="backup__intro">{t('backup.intro')}</p>

      <p class="backup__subheading">{t('backup.chooseOne')}</p>

      <div class="backup__options">
        <h3 class="backup__group-heading">{t('backup.groupThreads')}</h3>

        <label class="backup__option" class:backup__option--active={kind === 'threads'}>
          <input type="radio" name="backup-kind" value="threads" bind:group={kind} />
          <div class="backup__option-body">
            <span class="backup__option-title">{t('backup.threadsLabel')}</span>
            {#if kind === 'threads'}
              <div class="backup__suboptions">
                <label class="backup__field">
                  <span class="backup__field-label">Format:</span>
                  <select class="backup__select" bind:value={threadsFormat}>
                    <option value="txt">{t('backup.threadsFormatTxt')}</option>
                    <option value="xml">{t('backup.threadsFormatXml')}</option>
                    <option value="html">{t('backup.threadsFormatHtml')}</option>
                  </select>
                </label>
                <label class="backup__checkbox" class:backup__checkbox--disabled={mediaCheckboxDisabled}>
                  <input
                    type="checkbox"
                    checked={effectiveIncludeMedia}
                    disabled={mediaCheckboxDisabled}
                    onchange={(e) => { includeMedia = (e.currentTarget as HTMLInputElement).checked }}
                  />
                  <span>{t('backup.threadsIncludeMedia')}</span>
                </label>
              </div>
            {/if}
          </div>
        </label>

        <h3 class="backup__group-heading">{t('backup.groupMedia')}</h3>

        <label class="backup__option" class:backup__option--active={kind === 'gallery'}>
          <input type="radio" name="backup-kind" value="gallery" bind:group={kind} />
          <div class="backup__option-body">
            <span class="backup__option-title">{t('backup.galleryLabel')}</span>
            <span class="backup__option-desc">{t('backup.galleryDesc')}</span>
          </div>
        </label>

        <label class="backup__option" class:backup__option--active={kind === 'screenshots'}>
          <input type="radio" name="backup-kind" value="screenshots" bind:group={kind} />
          <div class="backup__option-body">
            <span class="backup__option-title">{t('backup.screenshotsLabel')}</span>
            <span class="backup__option-desc">{t('backup.screenshotsDesc')}</span>
          </div>
        </label>

        <label class="backup__option" class:backup__option--active={kind === 'images'}>
          <input type="radio" name="backup-kind" value="images" bind:group={kind} />
          <div class="backup__option-body">
            <span class="backup__option-title">{t('backup.imagesLabel')}</span>
            <span class="backup__option-desc">{t('backup.imagesDesc')}</span>
          </div>
        </label>

        <label class="backup__option" class:backup__option--active={kind === 'folders'}>
          <input type="radio" name="backup-kind" value="folders" bind:group={kind} />
          <div class="backup__option-body">
            <span class="backup__option-title">{t('backup.foldersLabel')}</span>
            <span class="backup__option-desc">{t('backup.foldersDesc')}</span>
          </div>
        </label>
      </div>

      <div class="backup__actions">
        <button class="backup__btn backup__btn--primary" onclick={() => void clickExport()}>
          {t('backup.exportAsBtn')}
        </button>
      </div>

    {:else if phase === 'confirm-overwrite'}
      <div class="backup__dialog">
        <h3 class="backup__dialog-title">{t('backup.overwriteTitle')}</h3>
        <p class="backup__dialog-body">{t('backup.overwriteBody', { path: activeTargetDir ?? '' })}</p>
        <div class="backup__dialog-actions">
          <button class="backup__btn backup__btn--outline" onclick={confirmOverwriteNo}>
            {t('backup.cancelBtn')}
          </button>
          <button class="backup__btn backup__btn--primary" onclick={() => void confirmOverwriteYes()}>
            {t('backup.continueBtn')}
          </button>
        </div>
      </div>

    {:else if phase === 'running'}
      <div class="backup__progress-pane">
        <div class="backup__status">{statusLine || t('backup.preparing')}</div>
        <div class="backup__progress-bar-wrap">
          <div class="backup__progress-bar" style:width="{percent}%"></div>
        </div>
        <div class="backup__progress-label">{percent}%</div>

        <div class="backup__console" bind:this={consoleEl}>
          {#each logLines as line}
            <div class="backup__console-line">{line}</div>
          {/each}
        </div>

        <div class="backup__actions">
          <button class="backup__btn backup__btn--danger" onclick={() => void clickCancel()}>
            {t('backup.cancelExportBtn')}
          </button>
        </div>
      </div>

    {:else if phase === 'complete'}
      <div class="backup__dialog">
        <h3 class="backup__dialog-title">{t('backup.doneTitle')}</h3>
        {#if completeSummary?.kind === 'threads' && completeSummary.threadsWritten > 0}
          <p class="backup__dialog-body">
            {t('backup.doneSummary', {
              threads: String(completeSummary.threadsWritten),
              messages: String(completeSummary.messagesWritten),
              attachments: String(completeSummary.attachmentsWritten),
              seconds: String(Math.round(completeSummary.elapsedMs / 1000)),
            })}
          </p>
          {#if completeSummary.errors > 0}
            <p class="backup__dialog-warning">{t('backup.doneWithErrors', { count: String(completeSummary.errors) })}</p>
          {/if}
        {:else if completeSummary?.kind === 'media' && (completeSummary.filesWritten > 0 || completeSummary.filesSkipped > 0)}
          <p class="backup__dialog-body">
            {t('backup.doneMediaSummary', {
              written: String(completeSummary.filesWritten),
              skipped: String(completeSummary.filesSkipped),
              size: formatBytesLabel(completeSummary.bytesWritten),
              seconds: String(Math.round(completeSummary.elapsedMs / 1000)),
            })}
          </p>
          {#if completeSummary.errors > 0}
            <p class="backup__dialog-warning">{t('backup.doneWithErrors', { count: String(completeSummary.errors) })}</p>
          {/if}
        {:else}
          <p class="backup__dialog-body">{t('backup.doneEmpty')}</p>
        {/if}

        <div class="backup__console" bind:this={consoleEl}>
          {#each logLines as line}
            <div class="backup__console-line">{line}</div>
          {/each}
        </div>

        <div class="backup__dialog-actions">
          <button class="backup__btn backup__btn--primary" onclick={clickDone}>
            {t('backup.closeBtn')}
          </button>
        </div>
      </div>

    {:else if phase === 'error'}
      <div class="backup__dialog">
        <h3 class="backup__dialog-title">{t('backup.errorTitle')}</h3>
        <p class="backup__dialog-body">{errorMessage}</p>
        <div class="backup__dialog-actions">
          <button class="backup__btn backup__btn--primary" onclick={clickDone}>
            {t('backup.closeBtn')}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .backup {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: var(--bg-primary);
  }

  .backup__header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
    background-color: var(--bg-secondary);
  }

  .backup__back {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
  }

  .backup__back:hover:not(:disabled) {
    color: var(--text-primary);
    background-color: var(--bg-hover);
  }

  .backup__back:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .backup__title {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }

  .backup__content {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-5) var(--space-6);
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
  }

  .backup__intro {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
    margin-bottom: var(--space-4);
  }

  .backup__subheading {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    margin-bottom: var(--space-2);
  }

  .backup__options {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .backup__group-heading {
    color: var(--text-primary);
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .backup__group-heading:first-child {
    margin-top: 0;
  }

  .backup__option {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    cursor: pointer;
    background-color: var(--bg-secondary);
    transition: border-color 0.15s, background-color 0.15s;
  }

  .backup__option:hover {
    border-color: var(--text-muted);
  }

  .backup__option--active {
    border-color: var(--accent-primary);
    background-color: var(--bg-surface);
  }

  .backup__option input[type="radio"] {
    margin-top: 2px;
    flex-shrink: 0;
  }

  .backup__option-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 1;
    min-width: 0;
  }

  .backup__option-title {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }

  .backup__option-desc {
    color: var(--text-muted);
    font-size: var(--font-size-xs);
  }

  .backup__suboptions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
  }

  .backup__field {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .backup__field-label {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
  }

  .backup__select {
    background-color: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-sm);
    font-family: var(--font-family);
  }

  .backup__checkbox {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    cursor: pointer;
  }

  .backup__checkbox--disabled {
    color: var(--text-muted);
    cursor: not-allowed;
  }

  .backup__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border);
  }

  .backup__btn {
    background-color: var(--accent-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    font-family: var(--font-family);
    transition: opacity 0.15s;
  }

  .backup__btn:hover {
    opacity: 0.85;
  }

  .backup__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .backup__btn--outline {
    background: none;
    color: var(--text-secondary);
    border: 1px solid var(--border);
  }

  .backup__btn--outline:hover {
    color: var(--text-primary);
    background-color: var(--bg-hover);
    opacity: 1;
  }

  .backup__btn--danger {
    background-color: var(--danger);
  }

  /* Progress view */

  .backup__progress-pane {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .backup__status {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    min-height: 1.4em;
  }

  .backup__progress-bar-wrap {
    width: 100%;
    height: 10px;
    background-color: var(--bg-surface);
    border-radius: var(--radius-full);
    overflow: hidden;
    border: 1px solid var(--border);
  }

  .backup__progress-bar {
    height: 100%;
    background-color: var(--accent-primary);
    transition: width 0.2s ease-out;
  }

  .backup__progress-label {
    color: var(--text-secondary);
    font-size: var(--font-size-xs);
    text-align: right;
  }

  .backup__console {
    background-color: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-2);
    height: 280px;
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    pointer-events: none;
    user-select: none;
  }

  .backup__console-line {
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.4;
  }

  /* Dialog views (overwrite confirm, cancel confirm, complete, error) */

  .backup__dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .backup__dialog-title {
    color: var(--text-primary);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
  }

  .backup__dialog-body {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
  }

  .backup__dialog-warning {
    color: var(--warning);
    font-size: var(--font-size-sm);
  }

  .backup__dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
</style>
