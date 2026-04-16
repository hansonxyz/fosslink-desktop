#!/usr/bin/env bash
#
# create-version.sh — Bump version numbers and build release binaries.
#
# This ONLY bumps versions and builds. It does NOT sync, commit, or push.
#
# Usage:
#   ./create-version.sh              # Auto-bump patch (1.0.0 → 1.0.1)
#   ./create-version.sh 1.0.0        # Set specific version

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_FILE="$SCRIPT_DIR/VERSION"
PACKAGE_JSON="$SCRIPT_DIR/gui/package.json"
ROOT_PACKAGE_JSON="$SCRIPT_DIR/package.json"

# --- Determine new version ---

OLD_VERSION=$(cat "$VERSION_FILE" | tr -d '[:space:]')

if [[ -n "${1:-}" ]]; then
    NEW_VERSION="$1"
else
    IFS='.' read -r MAJOR MINOR PATCH <<< "$OLD_VERSION"
    PATCH=$((PATCH + 1))
    NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
fi

echo "=== Create Version ==="
echo "Old version: ${OLD_VERSION}"
echo "New version: ${NEW_VERSION}"
echo ""

# --- Update version files ---

echo "--- Updating version to ${NEW_VERSION} ---"
echo "$NEW_VERSION" > "$VERSION_FILE"
sed -i "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"${NEW_VERSION}\"/" "$PACKAGE_JSON"
sed -i "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"${NEW_VERSION}\"/" "$ROOT_PACKAGE_JSON"

ANDROID_GRADLE="$SCRIPT_DIR/reference/xyzconnect-android-2/app/build.gradle.kts"
if [[ -f "$ANDROID_GRADLE" ]]; then
    sed -i "s/versionName = \"[0-9]*\.[0-9]*\.[0-9]*\"/versionName = \"${NEW_VERSION}\"/" "$ANDROID_GRADLE"
    echo "Updated VERSION, gui/package.json, package.json, and Android versionName"
else
    echo "Updated VERSION, gui/package.json, and package.json"
fi

# --- Build dev build ---

echo ""
echo "--- Building Windows dev build ---"
cd "$SCRIPT_DIR/gui"
npm run build:win 2>&1

# --- Run publish.sh (builds all platform release artifacts) ---

echo ""
echo "--- Running publish.sh ---"
"$SCRIPT_DIR/publish.sh" 2>&1

# --- Summary ---

echo ""
echo "=========================================="
echo "  v${NEW_VERSION} BUILT"
echo "=========================================="
echo ""
echo "Release artifacts:"
ls -lh "$SCRIPT_DIR/release/windows/"*.exe 2>/dev/null || echo "  (no Windows installer)"
ls -lh "$SCRIPT_DIR/release/linux/"*.AppImage 2>/dev/null || echo "  (no Linux AppImage)"
ls -lh "$SCRIPT_DIR/release/linux/"*.deb 2>/dev/null || echo "  (no Linux .deb)"
ls -lh "$SCRIPT_DIR/release/mac/"*.dmg 2>/dev/null || echo "  (no macOS DMG)"
ls -lh "$SCRIPT_DIR/release/android/"*.apk 2>/dev/null || echo "  (no Android APK)"
echo ""
echo "Next steps:"
echo "  1. ./sync-github.sh          # Sync source to staging repos"
echo "  2. Review release/github-*   # Check what changed"
echo "  3. Commit and push manually  # From the release repos"
echo "  4. ./publish-desktop.sh      # Create GitHub release with binaries"
