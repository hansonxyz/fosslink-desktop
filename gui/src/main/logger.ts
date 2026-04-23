import * as fs from 'node:fs'
import { dateStampedPath, cleanupOldLogs, scheduleLogRotation } from '@daemon/utils/log-rotation'

let logBasePath: string | null = null
let currentLogPath: string | null = null
let rotationDispose: (() => void) | null = null

function writeHeader(path: string): void {
  try {
    // Append if file already exists today; otherwise create with header
    if (!fs.existsSync(path)) {
      fs.writeFileSync(path, `--- FossLink GUI started ${new Date().toISOString()} ---\n`)
    } else {
      fs.appendFileSync(path, `--- FossLink GUI started ${new Date().toISOString()} ---\n`)
    }
  } catch { /* ignore */ }
}

export function initLogger(basePath: string): void {
  logBasePath = basePath
  cleanupOldLogs(basePath)
  currentLogPath = dateStampedPath(basePath)
  writeHeader(currentLogPath)

  // Midnight rollover + hourly retention cleanup
  rotationDispose = scheduleLogRotation(
    () => {
      if (!logBasePath) return
      const next = dateStampedPath(logBasePath)
      currentLogPath = next
      writeHeader(next)
      cleanupOldLogs(logBasePath)
    },
    () => {
      if (logBasePath) cleanupOldLogs(logBasePath)
    },
  )
}

export function log(category: string, message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString()
  const line = data
    ? `${timestamp} [${category}] ${message} ${JSON.stringify(data)}`
    : `${timestamp} [${category}] ${message}`

  if (currentLogPath) {
    try {
      fs.appendFileSync(currentLogPath, line + '\n')
    } catch { /* ignore write errors */ }
  }
  if (__DEV_BUILD__) {
    console.log(line)
  }
}

export function closeLogger(): void {
  if (rotationDispose) {
    rotationDispose()
    rotationDispose = null
  }
  if (currentLogPath) {
    try {
      fs.appendFileSync(currentLogPath, `--- FossLink GUI stopped ${new Date().toISOString()} ---\n`)
    } catch { /* ignore */ }
    currentLogPath = null
    logBasePath = null
  }
}
