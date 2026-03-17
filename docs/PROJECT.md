# FossLink — Architecture Overview

## Overview

FossLink is a cross-platform desktop SMS/MMS client for Android. It connects to the FossLink Android companion app over your local network, enabling desktop SMS management through an Electron + Svelte GUI backed by an embedded daemon.

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│  Electron App (gui/)                                      │
│  ┌───────────────────────────────────────────────────────┐│
│  │ Renderer (Svelte 5)                                   ││
│  │ - Conversation list, message threads, settings        ││
│  │ - Reactive stores (messages, contacts, conversations) ││
│  │ - Custom xyzattachment:// protocol for media          ││
│  └────────────────────┬──────────────────────────────────┘│
│                       │ IPC (contextBridge)                │
│  ┌────────────────────▼──────────────────────────────────┐│
│  │ Main Process                                          ││
│  │ - Embedded Daemon (DaemonBridge)                      ││
│  │ - Window management, menus, notifications             ││
│  │ - Auto-updater, custom protocol handler               ││
│  └────────────────────┬──────────────────────────────────┘│
└───────────────────────┼───────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────┐
│                    Daemon (src/)                           │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              State Machine                           │ │
│  │  INIT → DISCOVERING → PAIRING → CONNECTED →         │ │
│  │  SYNCING → READY                                    │ │
│  │  Single source of truth, broadcasts state snapshots  │ │
│  └───┬──────────────────────────────────┬───────────────┘ │
│      │                                  │                 │
│  ┌───▼────────────────┐  ┌─────────────▼──────────────┐  │
│  │ Protocol Handlers  │  │  Database Service          │  │
│  │ - Pairing          │  │  - SQLite (better-sqlite3) │  │
│  │ - SMS              │  │  - Schema versioning       │  │
│  │ - Contacts         │  │  - Persistence only        │  │
│  │ - Attachments      │  │                            │  │
│  │ - Notifications    │  │                            │  │
│  └───┬────────────────┘  └────────────────────────────┘  │
│      │                                                    │
│  ┌───▼──────────────────────────────────────────────────┐ │
│  │              Network Layer                           │ │
│  │  - UDP Discovery (port 1716)                        │ │
│  │  - TCP Connection Manager (ports 1716-1764)         │ │
│  │  - TLS Upgrade (self-signed certs, protocol v7/v8)  │ │
│  │  - Packet Router                                    │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────────────────┬───────────────────────────────────┘
                        │
                ┌───────▼────────┐
                │  Android Phone │
                │  (FossLink)  │
                └────────────────┘
```

## Feature Scope

### Implemented
- Device discovery (UDP broadcast, port 1716)
- Device pairing with verification keys
- TLS encrypted connections (protocol v7 and v8)
- SMS conversations, message threads, send SMS
- MMS attachment receive, download, view, save (send not yet implemented)
- Video transcoding (HEVC → H.264) and thumbnail generation via bundled FFmpeg
- Contact sync from phone
- Phone notification capture
- Spam filter (hides unknown senders/short codes, surfaces verification messages)
- One-click verification code copy
- Unread conversation filter
- Desktop notifications and Windows taskbar flash
- Image lightbox with right-click save
- New message compose
- Conversation and contact search
- Auto-updater infrastructure
- Background sync and automatic reconnection
- Structured JSON logging with 3-generation log rotation
- Cross-platform: Windows (NSIS installer), Linux (AppImage + .deb), macOS (DMG)

### Out of Scope (for now)
- MMS send
- Battery status, find my phone (ring works), file transfer, clipboard sharing
- Group MMS sending
- i18n / localization

## Data Directory

| Platform | Path |
|----------|------|
| Linux | `~/.fosslink/` |
| macOS | `~/.fosslink/` |
| Windows | `%APPDATA%/fosslink/` |

Contents:
```
~/.fosslink/
├── config.yaml          # User configuration
├── fosslink.db        # SQLite database
├── daemon.sock          # Unix socket (runtime, Linux/macOS)
├── daemon.pid           # PID file (runtime)
├── daemon.log           # Log file (+ .1, .2, .3 rotations)
├── certificate.pem      # TLS certificate
├── privatekey.pem       # TLS private key
└── attachments/         # Downloaded MMS attachments
    └── <partId>_<messageId>.<ext>
```

## Technology Stack

| Component | Choice |
|-----------|--------|
| Language | TypeScript (strict mode) |
| Runtime | Node.js 20+ / Electron 34 |
| GUI | Svelte 5 (reactive stores, runes) |
| Build | electron-vite (Vite + esbuild) |
| Database | better-sqlite3 |
| IPC | Electron contextBridge (embedded daemon) |
| Testing | Vitest |
| Logging | pino |
| Config | js-yaml |
| Packaging | electron-builder |
| Video | FFmpeg (bundled) |

## Repository Structure

```
fosslink-desktop/
├── src/                   # Daemon: protocol, networking, database, IPC
│   ├── core/              # State machine, app lifecycle, daemon
│   ├── network/           # UDP discovery, TCP, TLS, packets
│   ├── protocol/          # Pairing, SMS, contacts, attachments, notifications
│   ├── database/          # SQLite service, schema, migrations
│   ├── ipc/               # JSON-RPC handler, method map, notifications
│   ├── config/            # Configuration loading, known devices
│   └── utils/             # Logger, paths, crypto helpers
├── gui/                   # Electron app
│   ├── src/main/          # Main process (window, IPC, protocol handler, updater)
│   ├── src/preload/       # Context bridge (renderer ↔ main)
│   ├── src/renderer/src/  # Svelte renderer
│   │   ├── components/    # UI components (MessageThread, SettingsPanel, etc.)
│   │   ├── stores/        # Reactive state (messages, conversations, contacts, etc.)
│   │   └── lib/           # Utilities (phone formatting, verification, timestamps)
│   ├── resources/         # App icon, FFmpeg binaries
│   └── scripts/           # Build hooks (after-pack for cross-compilation)
├── tests/                 # Unit and integration tests (Vitest)
├── docs/                  # Architecture docs, screenshot
├── BUILD.md               # Build prerequisites and instructions
├── CONTRIB.md             # Credits and third-party attribution
├── README.md              # Project overview for GitHub
├── LICENSE                # MIT License
├── publish.sh             # Release build script (all platforms)
├── package.json           # Daemon dependencies and scripts
└── gui/package.json       # GUI dependencies and electron-builder config
```
