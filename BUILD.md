# Building FossLink

## Prerequisites

### Node.js

Node.js 20+ is required. Install via [nodesource](https://github.com/nodesource/distributions) or your package manager.

### System Packages

Ubuntu/Debian:

```bash
sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install -y \
    build-essential \
    python3 \
    wine64 wine32:i386 \
    imagemagick \
    rsync
```

After installing Wine, initialize the prefix and install Mono (needed for MSI builds):

```bash
/usr/lib/wine/wine64 wineboot --init
# Download Wine Mono matching your Wine version (Wine 9.0 uses Mono 8.1.0):
curl -L -o /tmp/wine-mono.msi https://dl.winehq.org/wine/wine-mono/8.1.0/wine-mono-8.1.0-x86.msi
wine msiexec /i /tmp/wine-mono.msi
```

### FFmpeg Binaries

Platform-specific ffmpeg and ffprobe binaries must be placed in `gui/resources/ffmpeg/`:

```
gui/resources/ffmpeg/
  win32/ffmpeg.exe
  win32/ffprobe.exe
  linux/ffmpeg
  linux/ffprobe
  darwin/ffmpeg
  darwin/ffprobe
```

These are bundled as extra resources in the installer. Download static builds from https://ffmpeg.org/download.html or https://johnvansickle.com/ffmpeg/ (Linux).

### Application Icon

Place an icon file in `gui/resources/`:

- `icon.png` (256x256 or 512x512) — used by Linux builds and as source for conversion
- `icon.ico` — used by Windows builds. Generate from PNG with ImageMagick:
  ```bash
  convert gui/resources/icon.png -define icon:auto-resize=256,128,64,48,32,16 gui/resources/icon.ico
  ```
- `icon.icns` — used by macOS builds (generate on macOS with `iconutil`)

electron-builder auto-detects these from the `buildResources` directory (`gui/resources/`).

## Install Dependencies

```bash
# Daemon/CLI dependencies (from repo root)
npm install

# GUI dependencies
cd gui && npm install
```

## Development Builds

### Dev server (hot reload)

```bash
cd gui && npm run dev
```

### Windows dev build (unpacked, with menu bar)

```bash
cd gui && npm run build:win
```

Produces `gui/dist/win-unpacked/`. Copy to a Windows machine and run `FossLink.exe`, or use `run.bat` which robocopy's from the Samba share.

## Release Builds

### Individual platforms

```bash
cd gui
npm run release:win     # NSIS + MSI installers
npm run release:linux   # AppImage + .deb
npm run release:mac     # DMG (macOS host only)
```

### Full release (all platforms + source)

```bash
./publish.sh [target-directory]
```

Defaults to `./release/`. See `./publish.sh --help` for details.

Output:
- `windows/` — NSIS `.exe`, `latest.yml`
- `linux/` — AppImage, `.deb`, `latest-linux.yml`
- `mac/` — DMG, `latest-mac.yml`
- `android/` — Signed APK

## Cross-Compilation Notes

- **Windows from Linux**: Works via Wine. Requires `wine64`, `wine32:i386`, and Wine Mono.
- **Linux from Linux**: Works natively. The `.deb` build requires `fpm` which electron-builder downloads automatically.
- **macOS from Linux**: DMG does not cross-compile (`dmg-license` is macOS-only). Build on a Mac.
- **MSI builds**: Require Wine Mono for the WiX toolset. Also require an application icon (`gui/resources/icon.ico`).

## Tests

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:watch    # Watch mode
```

## Type Checking

```bash
# Daemon
npm run lint

# GUI
cd gui && npm run typecheck
```
