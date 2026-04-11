/**
 * Sync Debug Console
 *
 * In-memory ring buffer for sync debug logs + command registry.
 * Singleton — shared across all sync components. Accessible from
 * the GUI via IPC for the interactive debug terminal.
 *
 * Log levels (each includes all levels above it):
 *   narrative  — orchestrator state changes (gold, always visible)
 *   query      — query sent/completed with counts and timing
 *   transport  — individual pages, ACKs, flow control
 *   trace      — raw packet JSON (truncated)
 */

export type LogLevel = 'narrative' | 'query' | 'transport' | 'trace';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
}

type CommandHandler = (args: string[]) => string | void;
type LogListener = (entry: LogEntry) => void;

const MAX_ENTRIES = 5000;

/** Numeric weight for filtering — higher = more verbose */
const LEVEL_WEIGHT: Record<LogLevel, number> = {
  narrative: 0,
  query: 1,
  transport: 2,
  trace: 3,
};

class DebugConsole {
  private entries: LogEntry[] = [];
  private commands = new Map<string, { handler: CommandHandler; description: string }>();
  private listeners: LogListener[] = [];

  constructor() {
    this.registerCommand('help', 'List all commands', () => {
      const lines: string[] = ['Available commands:'];
      for (const [name, cmd] of this.commands) {
        lines.push(`  ${name.padEnd(30)} ${cmd.description}`);
      }
      return lines.join('\n');
    });

    this.registerCommand('clear', 'Clear console output', () => {
      this.entries.length = 0;
      return 'Console cleared.';
    });

    this.registerCommand('status', 'Show current connection and sync state', () => {
      return 'Status: not yet wired (Phase 5)';
    });
  }

  /**
   * Write a log entry. Narrative-level entries are always visible
   * regardless of the viewer's selected log level.
   */
  log(level: LogLevel, category: string, message: string): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
    };

    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }

    for (const listener of this.listeners) {
      listener(entry);
    }
  }

  /** Convenience: log a gold narrative message (always visible). */
  narrative(message: string): void {
    this.log('narrative', 'sync', message);
  }

  /**
   * Register a command. Commands are callable from the debug terminal
   * and also programmatically from sync code.
   */
  registerCommand(name: string, description: string, handler: CommandHandler): void {
    this.commands.set(name, { handler, description });
  }

  /**
   * Execute a command string (as typed in the terminal).
   * Returns the output text, or empty string if no output.
   */
  execute(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';

    const parts = trimmed.split(/\s+/);
    const name = parts[0]!.toLowerCase();
    const args = parts.slice(1);

    const cmd = this.commands.get(name);
    if (!cmd) {
      return `Unknown command: ${name}. Type "help" for available commands.`;
    }

    try {
      return cmd.handler(args) ?? '';
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  /**
   * Get all entries filtered by the selected log level.
   * Narrative entries are always included.
   */
  getEntries(maxLevel: LogLevel): LogEntry[] {
    const maxWeight = LEVEL_WEIGHT[maxLevel];
    return this.entries.filter(
      (e) => e.level === 'narrative' || LEVEL_WEIGHT[e.level] <= maxWeight,
    );
  }

  /** Get all entries unfiltered. */
  getAllEntries(): LogEntry[] {
    return [...this.entries];
  }

  /** Subscribe to new log entries (for live streaming to the terminal). */
  onEntry(listener: LogListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  /** Check if a log level should be visible at the selected filter level. */
  isVisible(entryLevel: LogLevel, selectedLevel: LogLevel): boolean {
    return entryLevel === 'narrative' || LEVEL_WEIGHT[entryLevel] <= LEVEL_WEIGHT[selectedLevel];
  }
}

/** Singleton debug console instance. */
export const debugConsole = new DebugConsole();
