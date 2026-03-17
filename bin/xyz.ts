#!/usr/bin/env node
/**
 * FossLink CLI Client
 *
 * Connects to the running daemon via IPC and executes commands.
 * All commands use JSON-RPC 2.0 over Unix socket / named pipe.
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import { IpcClient } from '../src/ipc/client.js';
import { getLogPath } from '../src/utils/paths.js';

const program = new Command();

program
  .name('xyz')
  .description('FossLink CLI - Control the FossLink daemon')
  .version('2.0.0');

async function withClient<T>(fn: (client: IpcClient) => Promise<T>): Promise<T> {
  const client = new IpcClient();
  try {
    await client.connect();
  } catch {
    console.error('Daemon not running. Start with: npm run daemon');
    process.exit(1);
  }
  try {
    return await fn(client);
  } finally {
    client.disconnect();
  }
}

// --- status ---
program
  .command('status')
  .description('Show daemon state, uptime, and connected device')
  .action(async () => {
    await withClient(async (client) => {
      const status = await client.call('daemon.status') as {
        state: string;
        pid: number;
        uptime: number;
        config: { daemon: { logLevel: string }; kdeConnect: { deviceName: string } };
      };

      console.log('FossLink Daemon Status');
      console.log('========================');
      console.log(`  State:       ${status.state}`);
      console.log(`  PID:         ${status.pid}`);
      console.log(`  Uptime:      ${formatUptime(status.uptime)}`);
      console.log(`  Device Name: ${status.config.kdeConnect.deviceName}`);
      console.log(`  Log Level:   ${status.config.daemon.logLevel}`);
    });
  });

// --- devices ---
program
  .command('devices')
  .description('List discovered and paired devices')
  .action(async () => {
    await withClient(async (client) => {
      const [discovered, paired, connected] = await Promise.all([
        client.call('devices.discovered') as Promise<Array<{
          deviceId: string; deviceName: string; deviceType: string;
          address: string; tcpPort: number;
        }>>,
        client.call('devices.paired') as Promise<string[]>,
        client.call('devices.connected') as Promise<Array<{ deviceId: string; deviceName: string }>>,
      ]);

      const pairedSet = new Set(paired);
      const connectedMap = new Map(connected.map((c) => [c.deviceId, c.deviceName]));

      if (discovered.length === 0 && paired.length === 0 && connected.length === 0) {
        console.log('No devices found.');
        return;
      }

      // Merge discovered + connected-but-not-discovered into one list
      const discoveredIds = new Set(discovered.map((d) => d.deviceId));
      const allDevices = [...discovered];

      // Add connected devices not in discovered list
      for (const c of connected) {
        if (!discoveredIds.has(c.deviceId)) {
          allDevices.push({
            deviceId: c.deviceId,
            deviceName: c.deviceName,
            deviceType: '',
            address: '',
            tcpPort: 0,
          });
        }
      }

      if (allDevices.length > 0) {
        console.log('Devices');
        console.log('=======');
        for (const d of allDevices) {
          const tags: string[] = [];
          if (pairedSet.has(d.deviceId)) tags.push('paired');
          if (connectedMap.has(d.deviceId)) tags.push('connected');
          if (!connectedMap.has(d.deviceId)) tags.push('offline');
          const status = `[${tags.join(', ')}]`;
          console.log(`  ${d.deviceName} ${status}`);
          console.log(`    ID:      ${d.deviceId}`);
          if (d.address) {
            console.log(`    Type:    ${d.deviceType}`);
            console.log(`    Address: ${d.address}:${d.tcpPort}`);
          }
        }
      }

      // Show paired devices not connected and not discovered
      const offlinePaired = paired.filter((id) => !discoveredIds.has(id) && !connectedMap.has(id));
      if (offlinePaired.length > 0) {
        console.log('\nPaired Devices (offline)');
        console.log('========================');
        for (const id of offlinePaired) {
          console.log(`  ${id}`);
        }
      }
    });
  });

// --- pair ---
program
  .command('pair <device-id>')
  .description('Initiate pairing with a device')
  .action(async (deviceId: string) => {
    const client = new IpcClient();
    try {
      await client.connect();
    } catch {
      console.error('Daemon not running. Start with: npm run daemon');
      process.exit(1);
    }

    try {
      console.log(`Pairing with device ${deviceId}...`);

      // Listen for pairing result
      const resultPromise = new Promise<{ success: boolean; verificationKey?: string }>((resolve) => {
        client.onNotification((method, params) => {
          if (method === 'pairing.result') {
            const p = params as { deviceId: string; success: boolean; verificationKey?: string };
            if (p.deviceId === deviceId) {
              resolve(p);
            }
          }
        });
      });

      const result = await client.call('pair.request', { deviceId }) as { verificationKey: string };
      console.log(`\nVerification Key: ${result.verificationKey}`);
      console.log('Confirm this key matches on your phone and accept the pairing request.');
      console.log('Waiting for phone response...');

      // Wait for result with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Pairing timeout (30s)')), 30000);
      });

      const pairingResult = await Promise.race([resultPromise, timeoutPromise]);

      if (pairingResult.success) {
        console.log('Pairing successful!');
        client.disconnect();
        process.exit(0);
      } else {
        console.log('Pairing rejected by phone.');
        process.exit(1);
      }
    } catch (err) {
      console.error(`Pairing failed: ${(err as Error).message}`);
      process.exit(1);
    } finally {
      client.disconnect();
    }
  });

// --- pending ---
program
  .command('pending')
  .description('Show pending incoming pairing requests')
  .action(async () => {
    await withClient(async (client) => {
      const pending = await client.call('pair.pending') as Array<{
        deviceId: string; deviceName: string; timestamp: number;
      }>;

      if (pending.length === 0) {
        console.log('No pending pairing requests.');
        return;
      }

      console.log('Pending Pairing Requests');
      console.log('========================');
      for (const req of pending) {
        const age = Math.floor((Date.now() - req.timestamp) / 1000);
        console.log(`  ${req.deviceName}`);
        console.log(`    ID:  ${req.deviceId}`);
        console.log(`    Age: ${age}s ago`);
      }
      console.log(`\nAccept with: xyz accept <device-id>`);
      console.log(`Reject with: xyz reject <device-id>`);
    });
  });

// --- accept ---
program
  .command('accept <device-id>')
  .description('Accept a pending incoming pairing request')
  .action(async (deviceId: string) => {
    await withClient(async (client) => {
      await client.call('pair.accept', { deviceId });
      console.log(`Pairing accepted for device ${deviceId}`);
    });
  });

// --- reject ---
program
  .command('reject <device-id>')
  .description('Reject a pending incoming pairing request')
  .action(async (deviceId: string) => {
    await withClient(async (client) => {
      await client.call('pair.reject', { deviceId });
      console.log(`Pairing rejected for device ${deviceId}`);
    });
  });

// --- connect ---
program
  .command('connect <address>')
  .description('Connect to a device by IP address')
  .option('-p, --port <port>', 'TCP port', '1716')
  .option('--tcp', 'Use direct TCP connect instead of UDP trigger')
  .action(async (address: string, opts: { port: string; tcp?: boolean }) => {
    await withClient(async (client) => {
      const port = parseInt(opts.port, 10);
      const mode = opts.tcp ? 'tcp' : 'udp';
      console.log(`Connecting to ${address}:${port} (${mode})...`);
      try {
        const result = await client.call('devices.connect', { address, port, mode }) as {
          deviceId: string; deviceName: string;
        };
        console.log(`Connected to ${result.deviceName}`);
        console.log(`  Device ID: ${result.deviceId}`);
        console.log(`  Saved to known devices for auto-reconnect.`);
      } catch (err) {
        console.error(`Connection failed: ${(err as Error).message}`);
        process.exit(1);
      }
    });
  });

// --- known ---
program
  .command('known')
  .description('List known devices (saved for auto-reconnect)')
  .action(async () => {
    await withClient(async (client) => {
      const [known, paired, connected] = await Promise.all([
        client.call('devices.known') as Promise<Array<{
          deviceId: string; deviceName: string; address: string; port: number;
        }>>,
        client.call('devices.paired') as Promise<string[]>,
        client.call('devices.connected') as Promise<Array<{ deviceId: string; deviceName: string }>>,
      ]);

      if (known.length === 0) {
        console.log('No known devices.');
        return;
      }

      const pairedSet = new Set(paired);
      const connectedSet = new Set(connected.map((c) => c.deviceId));

      console.log('Known Devices');
      console.log('==============');
      for (const d of known) {
        const tags: string[] = [];
        if (pairedSet.has(d.deviceId)) tags.push('paired');
        if (connectedSet.has(d.deviceId)) tags.push('connected');
        if (!connectedSet.has(d.deviceId)) tags.push('offline');
        const status = `[${tags.join(', ')}]`;
        console.log(`  ${d.deviceName} ${status}`);
        console.log(`    ID:      ${d.deviceId}`);
        console.log(`    Address: ${d.address}:${d.port}`);
      }
    });
  });

// --- forget ---
program
  .command('forget <device-id>')
  .description('Remove a known device (stop auto-reconnect)')
  .action(async (deviceId: string) => {
    await withClient(async (client) => {
      await client.call('devices.forget', { deviceId });
      console.log(`Removed known device ${deviceId}`);
    });
  });

// --- unpair ---
program
  .command('unpair <device-id>')
  .description('Remove pairing with a device')
  .action(async (deviceId: string) => {
    await withClient(async (client) => {
      await client.call('pair.unpair', { deviceId });
      console.log(`Unpaired device ${deviceId}`);
    });
  });

// --- stop ---
program
  .command('stop')
  .description('Stop the daemon')
  .action(async () => {
    await withClient(async (client) => {
      await client.call('daemon.stop');
      console.log('Daemon stopping...');
    });
  });

// --- logs ---
program
  .command('logs')
  .description('Show daemon log')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <count>', 'Number of lines to show', '50')
  .action(async (opts: { follow?: boolean; lines: string }) => {
    const logPath = getLogPath();

    if (!fs.existsSync(logPath)) {
      console.error(`Log file not found: ${logPath}`);
      process.exit(1);
    }

    if (opts.follow) {
      // Tail -f using fs.watch
      const { spawn } = await import('node:child_process');
      const tail = spawn('tail', ['-f', '-n', opts.lines, logPath], {
        stdio: 'inherit',
      });
      tail.on('exit', (code) => process.exit(code ?? 0));

      process.on('SIGINT', () => {
        tail.kill();
        process.exit(0);
      });
    } else {
      // Read last N lines
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n');
      const n = parseInt(opts.lines, 10);
      const tail = lines.slice(-n);
      console.log(tail.join('\n'));
    }
  });

// --- watch ---
program
  .command('watch')
  .description('Stream daemon events in real-time')
  .action(async () => {
    const client = new IpcClient();
    try {
      await client.connect();
    } catch {
      console.error('Daemon not running. Start with: npm run daemon');
      process.exit(1);
    }

    console.log('Watching daemon events (Ctrl+C to stop)...\n');

    client.onNotification((method, params) => {
      const timestamp = new Date().toISOString().substring(11, 23);
      console.log(`[${timestamp}] ${method}`);
      if (params && typeof params === 'object') {
        for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
          console.log(`  ${key}: ${JSON.stringify(value)}`);
        }
      }
      console.log();
    });

    process.on('SIGINT', () => {
      client.disconnect();
      process.exit(0);
    });

    // Keep alive
    await new Promise(() => {});
  });

// --- conversations ---
program
  .command('conversations')
  .alias('convos')
  .description('List SMS conversations')
  .action(async () => {
    await withClient(async (client) => {
      const conversations = await client.call('sms.conversations') as Array<{
        thread_id: number; addresses: string; snippet: string | null;
        date: number; read: number; unread_count: number;
      }>;

      if (conversations.length === 0) {
        console.log('No conversations. Try: xyz sync');
        return;
      }

      console.log('Conversations');
      console.log('==============');
      for (const conv of conversations) {
        let addresses: string;
        try {
          const parsed = JSON.parse(conv.addresses) as string[];
          addresses = parsed.join(', ');
        } catch {
          addresses = conv.addresses;
        }

        const date = new Date(conv.date).toLocaleString();
        const unread = conv.unread_count > 0 ? ` [${conv.unread_count} unread]` : '';
        const snippet = conv.snippet ? conv.snippet.substring(0, 60) : '(no text)';

        console.log(`  #${conv.thread_id} ${addresses}${unread}`);
        console.log(`    ${date} — ${snippet}`);
      }
      console.log(`\n${conversations.length} conversations total`);
    });
  });

// --- messages ---
program
  .command('messages <thread-id>')
  .alias('msgs')
  .description('Show messages in a conversation thread')
  .option('-n, --limit <count>', 'Show last N messages', '50')
  .action(async (threadIdStr: string, opts: { limit: string }) => {
    await withClient(async (client) => {
      const threadId = parseInt(threadIdStr, 10);
      if (isNaN(threadId)) {
        console.error('Invalid thread ID');
        process.exit(1);
      }

      const messages = await client.call('sms.messages', { threadId }) as Array<{
        _id: number; thread_id: number; address: string; body: string | null;
        date: number; type: number; read: number;
      }>;

      if (messages.length === 0) {
        console.log('No messages in this thread.');
        return;
      }

      const limit = parseInt(opts.limit, 10);
      const display = messages.slice(-limit);

      console.log(`Thread #${threadId} (${messages.length} messages, showing last ${display.length})`);
      console.log('='.repeat(60));

      for (const msg of display) {
        const date = new Date(msg.date).toLocaleString();
        const direction = msg.type === 2 ? 'YOU' : msg.address;
        const body = msg.body ?? '(attachment)';
        console.log(`[${date}] ${direction}: ${body}`);
      }
    });
  });

// --- send ---
program
  .command('send <address> <message>')
  .description('Send an SMS message')
  .action(async (address: string, message: string) => {
    await withClient(async (client) => {
      await client.call('sms.send', { address, body: message });
      console.log(`Message sent to ${address}`);
    });
  });

// --- contacts ---
program
  .command('contacts')
  .description('List synced contacts')
  .option('-s, --search <query>', 'Search contacts by name')
  .action(async (opts: { search?: string }) => {
    await withClient(async (client) => {
      let contacts: Array<{
        uid: string; name: string; phone_numbers: string; timestamp: number;
      }>;

      if (opts.search) {
        contacts = await client.call('contacts.search', { query: opts.search }) as typeof contacts;
      } else {
        contacts = await client.call('contacts.list') as typeof contacts;
      }

      if (contacts.length === 0) {
        console.log(opts.search ? 'No contacts match your search.' : 'No contacts. Try: xyz sync');
        return;
      }

      console.log('Contacts');
      console.log('========');
      for (const c of contacts) {
        let numbers: string[];
        try {
          numbers = JSON.parse(c.phone_numbers) as string[];
        } catch {
          numbers = [c.phone_numbers];
        }
        console.log(`  ${c.name}`);
        for (const num of numbers) {
          console.log(`    ${num}`);
        }
      }
      console.log(`\n${contacts.length} contacts`);
    });
  });

// --- notifications ---
program
  .command('notifications')
  .alias('notifs')
  .description('Show recent phone notifications')
  .option('-n, --limit <count>', 'Number of notifications', '20')
  .action(async (opts: { limit: string }) => {
    await withClient(async (client) => {
      const limit = parseInt(opts.limit, 10);
      const notifications = await client.call('notifications.list', { limit }) as Array<{
        id: string; app_name: string; title: string; text: string;
        time: number; dismissable: number; silent: number;
      }>;

      if (notifications.length === 0) {
        console.log('No notifications.');
        return;
      }

      console.log('Recent Notifications');
      console.log('=====================');
      for (const n of notifications) {
        const time = new Date(n.time).toLocaleString();
        console.log(`  [${n.app_name}] ${n.title}`);
        if (n.text) {
          console.log(`    ${n.text.substring(0, 80)}`);
        }
        console.log(`    ${time}`);
      }
      console.log(`\n${notifications.length} notifications`);
    });
  });

// --- sync ---
program
  .command('sync')
  .description('Trigger a manual data sync with the phone')
  .action(async () => {
    await withClient(async (client) => {
      await client.call('sms.request_sync');
      console.log('Sync started. Use "xyz watch" to monitor progress.');
    });
  });

// --- attachment ---
program
  .command('attachment <message-id>')
  .description('Download attachment(s) for a message')
  .option('-o, --output <dir>', 'Copy downloaded file to this directory')
  .action(async (messageIdStr: string, opts: { output?: string }) => {
    await withClient(async (client) => {
      const messageId = parseInt(messageIdStr, 10);
      if (isNaN(messageId)) {
        console.error('Invalid message ID');
        process.exit(1);
      }

      const result = await client.call('sms.get_attachment', { messageId }) as {
        attachments: Array<{ partId: number; localPath: string; mimeType: string; fileSize: number | null }>;
      };

      for (const att of result.attachments) {
        console.log(`Downloaded: ${att.localPath}`);
        console.log(`  Part ID:   ${att.partId}`);
        console.log(`  MIME type: ${att.mimeType}`);
        if (att.fileSize !== null) {
          console.log(`  Size: ${att.fileSize} bytes`);
        }

        if (opts.output) {
          const { copyFileSync, mkdirSync } = await import('node:fs');
          const { basename, join } = await import('node:path');
          mkdirSync(opts.output, { recursive: true });
          const dest = join(opts.output, basename(att.localPath));
          copyFileSync(att.localPath, dest);
          console.log(`  Copied to: ${dest}`);
        }
      }
    });
  });

// --- delete-message ---
program
  .command('delete-message <message-id>')
  .description('Delete a message and its attachment files')
  .action(async (messageIdStr: string) => {
    await withClient(async (client) => {
      const messageId = parseInt(messageIdStr, 10);
      if (isNaN(messageId)) {
        console.error('Invalid message ID');
        process.exit(1);
      }
      await client.call('sms.delete_message', { messageId });
      console.log(`Message ${messageId} deleted.`);
    });
  });

// --- delete-conversation ---
program
  .command('delete-conversation <thread-id>')
  .description('Delete an entire conversation and all its attachment files')
  .action(async (threadIdStr: string) => {
    await withClient(async (client) => {
      const threadId = parseInt(threadIdStr, 10);
      if (isNaN(threadId)) {
        console.error('Invalid thread ID');
        process.exit(1);
      }
      await client.call('sms.delete_conversation', { threadId });
      console.log(`Conversation #${threadId} deleted.`);
    });
  });

// --- storage ---
program
  .command('storage')
  .description('Analyze phone storage usage (treemap-style breakdown)')
  .action(async () => {
    await withClient(async (client) => {
      console.log('Analyzing phone storage (this may take 15-30 seconds)...\n');
      const result = await client.call('storage.analyze', {}, 65000) as {
        totalBytes: number;
        freeBytes: number;
        rootMode: boolean;
        items?: Array<{ name: string; bytes: number; category: string; detail?: string }>;
        categories?: Array<{ name: string; bytes: number }>;
        error?: string;
      };

      if (result.error) {
        console.error(`Error: ${result.error}`);
        process.exit(1);
      }

      const total = result.totalBytes;
      const free = result.freeBytes;
      const used = total - free;

      console.log('Phone Storage Analysis');
      console.log('======================');
      console.log(`  Total:  ${formatStorageSize(total)}`);
      console.log(`  Used:   ${formatStorageSize(used)} (${((used / total) * 100).toFixed(1)}%)`);
      console.log(`  Free:   ${formatStorageSize(free)} (${((free / total) * 100).toFixed(1)}%)`);
      console.log(`  Mode:   ${result.rootMode ? 'Root (accurate)' : 'Non-root (limited)'}`);
      console.log();

      const items: Array<{ name: string; bytes: number; category: string; detail?: string }> =
        result.items ?? result.categories?.map((c) => ({
          name: c.name, bytes: c.bytes, category: 'other', detail: undefined,
        })) ?? [];

      if (items.length === 0) {
        console.log('No breakdown available.');
        return;
      }

      // Group by category
      const categoryOrder = ['system', 'app', 'photos', 'videos', 'audio', 'downloads', 'other'];
      const categoryLabels: Record<string, string> = {
        system: 'SYSTEM', app: 'APPS', photos: 'PHOTOS',
        videos: 'VIDEOS', audio: 'AUDIO', downloads: 'DOWNLOADS', other: 'OTHER',
      };

      const grouped = new Map<string, typeof items>();
      for (const item of items) {
        const cat = item.category ?? 'other';
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat)!.push(item);
      }

      // Sort items within each category by size descending
      for (const [, catItems] of grouped) {
        catItems.sort((a, b) => b.bytes - a.bytes);
      }

      // Print each category
      for (const cat of categoryOrder) {
        const catItems = grouped.get(cat);
        if (!catItems || catItems.length === 0) continue;

        const catTotal = catItems.reduce((s, i) => s + i.bytes, 0);
        const catPct = ((catTotal / used) * 100).toFixed(1);
        const label = categoryLabels[cat] ?? cat.toUpperCase();

        console.log(`${label} — ${formatStorageSize(catTotal)} (${catPct}% of used)`);
        console.log('─'.repeat(60));

        for (const item of catItems) {
          const pct = ((item.bytes / used) * 100).toFixed(1);
          const size = formatStorageSize(item.bytes).padStart(10);
          const detail = item.detail ? `  [${item.detail}]` : '';
          console.log(`  ${size}  ${pct.padStart(5)}%  ${item.name}${detail}`);
        }
        console.log();
      }

      // Summary bar (text-based)
      const barWidth = 60;
      console.log('Usage Bar');
      console.log('─'.repeat(barWidth));
      let bar = '';
      for (const cat of categoryOrder) {
        const catItems = grouped.get(cat);
        if (!catItems) continue;
        const catTotal = catItems.reduce((s, i) => s + i.bytes, 0);
        const chars = Math.max(0, Math.round((catTotal / total) * barWidth));
        const charMap: Record<string, string> = {
          system: '█', app: '▓', photos: '▒', videos: '░',
          audio: '▒', downloads: '░', other: '·',
        };
        bar += (charMap[cat] ?? '·').repeat(chars);
      }
      const freeChars = Math.max(0, barWidth - bar.length);
      bar += ' '.repeat(freeChars);
      console.log(`[${bar}]`);
      console.log(`  █=System ▓=Apps ▒=Photos/Audio ░=Videos/Downloads ·=Other  =Free`);
    });
  });

// --- ring ---
program
  .command('ring')
  .description('Ring the connected phone (find my phone)')
  .action(async () => {
    await withClient(async (client) => {
      await client.call('phone.ring', {});
      console.log('Ring sent.');
    });
  });

function formatStorageSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

program.parse();
