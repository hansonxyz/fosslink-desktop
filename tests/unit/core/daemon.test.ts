import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Daemon } from '../../../src/core/daemon.js';
import { AppState } from '../../../src/core/state-machine.js';
import { resetLogger } from '../../../src/utils/logger.js';

describe('Daemon', () => {
  let daemon: Daemon;
  let tmpDir: string;

  beforeEach(() => {
    resetLogger();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xyzd-test-'));
  });

  afterEach(async () => {
    if (daemon) {
      try {
        await daemon.stop();
      } catch {
        // ignore - may not have been started
      }
    }
    resetLogger();
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('init creates data directory', async () => {
    const dataDir = path.join(tmpDir, 'fosslink-data');
    daemon = new Daemon();
    await daemon.init({ dataDir });
    expect(fs.existsSync(dataDir)).toBe(true);
  });

  it('init loads config and creates state machine', async () => {
    daemon = new Daemon();
    // Use configPath within tmpDir to avoid reading user's real config
    const configPath = path.join(tmpDir, 'config.yaml');
    await daemon.init({ dataDir: tmpDir, configPath });

    expect(daemon.getConfig()).toBeDefined();
    expect(daemon.getConfig().daemon.logLevel).toBe('info');
    expect(daemon.getStateMachine()).toBeDefined();
    expect(daemon.getStateMachine().getState()).toBe(AppState.INIT);
  });

  it('start transitions state machine to DISCOVERING', async () => {
    daemon = new Daemon();
    await daemon.init({ dataDir: tmpDir });
    await daemon.start();

    expect(daemon.getStateMachine().getState()).toBe(AppState.DISCOVERING);
  });

  it('start writes PID file', async () => {
    daemon = new Daemon();
    await daemon.init({ dataDir: tmpDir });
    await daemon.start();

    const pidPath = path.join(tmpDir, 'daemon.pid');
    expect(fs.existsSync(pidPath)).toBe(true);
    const pidContent = fs.readFileSync(pidPath, 'utf-8').trim();
    expect(parseInt(pidContent, 10)).toBe(process.pid);
  });

  it('stop removes PID file', async () => {
    daemon = new Daemon();
    await daemon.init({ dataDir: tmpDir });
    await daemon.start();

    const pidPath = path.join(tmpDir, 'daemon.pid');
    expect(fs.existsSync(pidPath)).toBe(true);

    await daemon.stop();
    expect(fs.existsSync(pidPath)).toBe(false);
  });

  it('stop destroys state machine', async () => {
    daemon = new Daemon();
    await daemon.init({ dataDir: tmpDir });
    await daemon.start();

    let notified = false;
    daemon.getStateMachine().onTransition(() => { notified = true; });

    await daemon.stop();

    // After destroy, transitions still work but listeners are cleared
    // We can verify by checking the state machine was destroyed
    // (listeners no longer fire)
    try {
      daemon.getStateMachine().transition(AppState.DISCOVERING);
    } catch {
      // State may not allow this transition from current state - that's ok
    }
    expect(notified).toBe(false);
  });

  it('getStatus returns correct state and pid', async () => {
    daemon = new Daemon();
    await daemon.init({ dataDir: tmpDir });
    await daemon.start();

    const status = daemon.getStatus();
    expect(status.state).toBe(AppState.DISCOVERING);
    expect(status.pid).toBe(process.pid);
    expect(status.uptime).toBeGreaterThanOrEqual(0);
    expect(status.config).toBeDefined();
  });

  it('stop is idempotent (double-stop does not throw)', async () => {
    daemon = new Daemon();
    await daemon.init({ dataDir: tmpDir });
    await daemon.start();

    await daemon.stop();
    await expect(daemon.stop()).resolves.toBeUndefined();
  });

  it('init with custom config path', async () => {
    // Write a config file
    const configPath = path.join(tmpDir, 'config.yaml');
    fs.writeFileSync(configPath, 'daemon:\n  log_level: debug\n', 'utf-8');

    daemon = new Daemon();
    await daemon.init({ dataDir: tmpDir, configPath });

    expect(daemon.getConfig().daemon.logLevel).toBe('debug');
  });
});
