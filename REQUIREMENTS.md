# System Requirements

## Runtime Requirements

- **Node.js**: 20.x or later (tested on 23.11.1)
- **npm**: 10.x or later
- **Operating System**: Linux, macOS, or Windows 10+

## Build Dependencies (installed via npm)

### Production
- `better-sqlite3` - SQLite database driver (has native addon, prebuilds available)
- `commander` - CLI argument parsing
- `js-yaml` - YAML configuration parsing
- `pino` - Structured JSON logging
- `pino-pretty` - Human-readable log formatting (development)
- `selfsigned` - TLS certificate generation

### Development
- `typescript` - Type checking and compilation
- `tsx` - Fast TypeScript execution (esbuild-based)
- `vitest` - Test framework
- `@types/node` - Node.js type definitions
- `@types/better-sqlite3` - SQLite type definitions
- `@types/js-yaml` - YAML type definitions

## Network Requirements

- **UDP port 1716**: KDE Connect discovery (broadcast)
- **TCP ports 1716-1764**: KDE Connect connections
- Android device running KDE Connect on the same LAN

## Ubuntu Server Setup

```bash
# Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs

# Build tools for native modules (better-sqlite3)
sudo apt-get install -y build-essential python3

# Git (if not already installed)
sudo apt-get install -y git
```

## Firewall

If a firewall is active, allow KDE Connect traffic:

```bash
sudo ufw allow 1714:1764/tcp
sudo ufw allow 1714:1764/udp
```
