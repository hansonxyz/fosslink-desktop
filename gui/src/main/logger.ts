import * as fs from 'node:fs'

let logPath: string | null = null

export function initLogger(path: string): void {
  // Rotate old logs (keep 3 generations)
  if (fs.existsSync(path)) {
    for (let i = 2; i >= 1; i--) {
      const src = i === 1 ? path : `${path}.${i}`
      const dst = `${path}.${i + 1}`
      if (fs.existsSync(src)) {
        try { fs.renameSync(src, dst) } catch { /* ignore */ }
      }
    }
  }

  logPath = path
  // Truncate and write header
  try {
    fs.writeFileSync(logPath, `--- FossLink GUI started ${new Date().toISOString()} ---\n`)
  } catch { /* ignore */ }
}

export function log(category: string, message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString()
  const line = data
    ? `${timestamp} [${category}] ${message} ${JSON.stringify(data)}`
    : `${timestamp} [${category}] ${message}`

  if (logPath) {
    try {
      fs.appendFileSync(logPath, line + '\n')
    } catch { /* ignore write errors */ }
  }
  if (__DEV_BUILD__) {
    console.log(line)
  }
}

export function closeLogger(): void {
  if (logPath) {
    try {
      fs.appendFileSync(logPath, `--- FossLink GUI stopped ${new Date().toISOString()} ---\n`)
    } catch { /* ignore */ }
    logPath = null
  }
}
