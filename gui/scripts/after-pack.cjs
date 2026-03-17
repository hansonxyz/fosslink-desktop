/**
 * electron-builder afterPack hook.
 *
 * When cross-compiling for Windows from Linux, @electron/rebuild builds
 * better-sqlite3 for the host platform (Linux). This hook replaces the
 * native module with the correct prebuild for the target platform.
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName // 'win32', 'linux', 'darwin'
  const arch = context.arch === 1 ? 'x64' : context.arch === 3 ? 'arm64' : 'x64'

  // Only fix when cross-compiling (host !== target)
  if (platform === process.platform) return

  const betterSqlitePath = path.join(
    context.appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'better-sqlite3'
  )

  if (!fs.existsSync(betterSqlitePath)) {
    console.log(`afterPack: better-sqlite3 not found at ${betterSqlitePath}, skipping`)
    return
  }

  console.log(`afterPack: Replacing better-sqlite3 native module for ${platform}/${arch}`)

  try {
    execSync(
      `npx prebuild-install --runtime electron --target ${context.packager.config.electronVersion || '34.5.8'} --platform ${platform} --arch ${arch}`,
      { cwd: betterSqlitePath, stdio: 'inherit' }
    )
    console.log(`afterPack: Successfully installed better-sqlite3 prebuild for ${platform}/${arch}`)
  } catch (err) {
    console.error(`afterPack: Failed to install prebuild for ${platform}/${arch}:`, err.message)
    throw err
  }
}
