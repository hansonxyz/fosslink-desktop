<script lang="ts">
  import { onMount } from 'svelte'
  import { Terminal } from '@xterm/xterm'
  import { FitAddon } from '@xterm/addon-fit'
  import '@xterm/xterm/css/xterm.css'

  interface Props {
    onClose: () => void
  }

  const { onClose }: Props = $props()

  type LogLevel = 'narrative' | 'query' | 'transport' | 'trace'

  interface LogEntry {
    timestamp: number
    level: LogLevel
    category: string
    message: string
  }

  let terminalEl: HTMLDivElement | undefined = $state()
  let terminal: Terminal | undefined
  let fitAddon: FitAddon | undefined
  let selectedLevel: LogLevel = $state('query')
  let commandBuffer = ''
  let autoScroll = true
  let showCopyToast = $state(false)
  let copyToastTimer: ReturnType<typeof setTimeout> | undefined

  const LEVEL_WEIGHT: Record<LogLevel, number> = {
    narrative: 0,
    query: 1,
    transport: 2,
    trace: 3,
  }

  // ANSI color codes
  const GOLD = '\x1b[1;33m'      // bold yellow (gold narrative)
  const CYAN = '\x1b[36m'        // cyan (queries)
  const GRAY = '\x1b[90m'        // gray (transport)
  const DIM = '\x1b[2m'          // dim (trace)
  const GREEN = '\x1b[32m'       // green (events)
  const RED = '\x1b[31m'         // red (errors)
  const RESET = '\x1b[0m'
  const PROMPT = '\x1b[37m> \x1b[0m'

  function formatTime(ts: number): string {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  function colorForEntry(entry: LogEntry): string {
    if (entry.level === 'narrative') return GOLD
    if (entry.category === 'event') return GREEN
    if (entry.category === 'error') return RED
    if (entry.level === 'query') return CYAN
    if (entry.level === 'transport') return GRAY
    return DIM
  }

  function isVisible(entryLevel: LogLevel): boolean {
    return entryLevel === 'narrative' || LEVEL_WEIGHT[entryLevel] <= LEVEL_WEIGHT[selectedLevel]
  }

  function writeEntry(entry: LogEntry): void {
    if (!terminal || !isVisible(entry.level)) return
    const color = colorForEntry(entry)
    const time = formatTime(entry.timestamp)
    terminal.writeln(`${GRAY}${time}${RESET} ${color}${entry.message}${RESET}`)
  }

  function writeOutput(text: string): void {
    if (!terminal) return
    for (const line of text.split('\n')) {
      terminal.writeln(`  ${line}`)
    }
  }

  function redrawPrompt(): void {
    if (!terminal) return
    terminal.write(`\r${PROMPT}${commandBuffer}\x1b[K`)
  }

  async function executeCommand(input: string): Promise<void> {
    if (!terminal) return
    terminal.writeln('') // newline after the prompt

    if (input.trim()) {
      try {
        const result = await window.api.invoke('debug.console.execute', { input }) as { output: string }
        if (result.output) {
          writeOutput(result.output)
        }
      } catch (err) {
        terminal.writeln(`${RED}Error: ${err instanceof Error ? err.message : String(err)}${RESET}`)
      }
    }

    redrawPrompt()
  }

  async function loadExistingEntries(): Promise<void> {
    try {
      const result = await window.api.invoke('debug.console.entries', { level: selectedLevel }) as { entries: LogEntry[] }
      for (const entry of result.entries) {
        writeEntry(entry)
      }
    } catch {
      // Daemon may not be ready
    }
  }

  function handleLevelChange(): void {
    if (!terminal) return
    // Clear and reload with new filter
    terminal.clear()
    terminal.writeln(`${GRAY}Log level: ${selectedLevel}${RESET}`)
    terminal.writeln('')
    void loadExistingEntries().then(() => redrawPrompt())
  }

  onMount(() => {
    if (!terminalEl) return

    terminal = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        selectionBackground: '#3a3a5e',
      },
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      cursorBlink: true,
      cursorStyle: 'underline',
      scrollback: 5000,
      convertEol: true,
      disableStdin: false,
    })

    fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(terminalEl)
    fitAddon.fit()

    terminal.writeln(`${GOLD}FossLink Sync Debug Console${RESET}`)
    terminal.writeln(`${GRAY}Type "help" for available commands${RESET}`)
    terminal.writeln('')

    // Load existing entries
    void loadExistingEntries().then(() => redrawPrompt())

    // Handle keyboard input
    terminal.onData((data) => {
      if (data === '\r') {
        // Enter
        const cmd = commandBuffer
        commandBuffer = ''
        void executeCommand(cmd)
      } else if (data === '\x7f' || data === '\b') {
        // Backspace
        if (commandBuffer.length > 0) {
          commandBuffer = commandBuffer.slice(0, -1)
          redrawPrompt()
        }
      } else if (data === '\x03') {
        // Ctrl+C
        commandBuffer = ''
        terminal!.writeln('')
        redrawPrompt()
      } else if (data === '\x16') {
        // Ctrl+V — paste from clipboard
        void navigator.clipboard.readText().then((text) => {
          const clean = text.replace(/[\r\n]/g, '')
          commandBuffer += clean
          redrawPrompt()
        })
      } else if (data >= ' ' && data.length === 1) {
        // Printable character
        commandBuffer += data
        redrawPrompt()
      }
    })

    // Track scroll position for auto-scroll
    terminal.onScroll(() => {
      if (!terminal) return
      const buf = terminal.buffer.active
      autoScroll = buf.viewportY >= buf.baseY
    })

    // Right-click pastes from clipboard
    terminalEl.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      void navigator.clipboard.readText().then((text) => {
        const clean = text.replace(/[\r\n]/g, '')
        commandBuffer += clean
        redrawPrompt()
      })
    })

    // Copy selection to clipboard on mouse up, then clear selection
    terminalEl.addEventListener('mouseup', () => {
      if (!terminal) return
      const selection = terminal.getSelection()
      if (selection) {
        void navigator.clipboard.writeText(selection).then(() => {
          terminal!.clearSelection()
          if (copyToastTimer) clearTimeout(copyToastTimer)
          showCopyToast = true
          copyToastTimer = setTimeout(() => { showCopyToast = false }, 1500)
        })
      }
    })

    // Listen for real-time log entries from daemon
    const handleNotification = (method: string, params: unknown): void => {
      if (method === 'debug.console.entry') {
        const entry = params as LogEntry
        if (isVisible(entry.level)) {
          // Save cursor, write entry above prompt, restore prompt
          const savedCmd = commandBuffer
          terminal!.write('\r\x1b[K') // clear current line
          writeEntry(entry)
          commandBuffer = savedCmd
          redrawPrompt()

          // Auto-scroll to bottom if user hasn't scrolled up
          if (autoScroll) {
            terminal!.scrollToBottom()
          }
        }
      }
    }

    window.api.onNotification(handleNotification)

    // Resize observer
    const ro = new ResizeObserver(() => {
      fitAddon?.fit()
    })
    ro.observe(terminalEl)

    return () => {
      window.api.offNotification(handleNotification)
      ro.disconnect()
      terminal?.dispose()
    }
  })
</script>

<div class="sync-console">
  <div class="sync-console__header">
    <h2 class="sync-console__title">Sync Console</h2>
    <div class="sync-console__controls">
      <label class="sync-console__level-label">
        Log level:
        <select
          class="sync-console__level-select"
          bind:value={selectedLevel}
          onchange={handleLevelChange}
        >
          <option value="narrative">Operations</option>
          <option value="query">Queries</option>
          <option value="transport">Transport</option>
          <option value="trace">Trace</option>
        </select>
      </label>
    </div>
    <button class="sync-console__close" onclick={onClose} title="Close">
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path
          fill="currentColor"
          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
        />
      </svg>
    </button>
  </div>
  <div class="sync-console__terminal" bind:this={terminalEl}></div>
  {#if showCopyToast}
    <div class="sync-console__toast">Text Copied</div>
  {/if}
</div>

<style>
  .sync-console {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
  }

  .sync-console__header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
    background-color: var(--bg-secondary);
  }

  .sync-console__title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin-right: auto;
  }

  .sync-console__controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sync-console__level-label {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .sync-console__level-select {
    background-color: var(--bg-surface);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 2px var(--space-2);
    font-size: var(--font-size-xs);
    font-family: var(--font-family);
    outline: none;
  }

  .sync-console__close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: var(--space-1);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
  }

  .sync-console__close:hover {
    color: var(--text-secondary);
    background-color: var(--bg-hover);
  }

  .sync-console__terminal {
    flex: 1;
    overflow: hidden;
    padding: var(--space-2);
    padding-bottom: 0;
    background-color: #1a1a2e;
    /* Prevent xterm from overflowing the panel */
    min-height: 0;
    margin-bottom: 30px;
  }

  .sync-console__terminal :global(.xterm) {
    height: 100%;
  }

  .sync-console__terminal :global(.xterm-viewport) {
    overflow-y: auto !important;
  }

  .sync-console__toast {
    position: absolute;
    bottom: 16px;
    right: 16px;
    padding: 6px 14px;
    background-color: rgba(255, 255, 255, 0.12);
    color: var(--text-primary);
    font-size: var(--font-size-xs);
    border-radius: var(--radius-md);
    pointer-events: none;
    animation: toast-fade 1.5s ease-out forwards;
  }

  @keyframes toast-fade {
    0%, 70% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
