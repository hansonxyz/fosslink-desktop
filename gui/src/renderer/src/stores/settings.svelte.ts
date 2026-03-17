/**
 * Settings Store
 *
 * Persists user preferences to localStorage. Loads on init,
 * saves automatically when values change via $effect.
 */

const STORAGE_KEY = 'fosslink-settings'

interface PersistedSettings {
  notificationsEnabled: boolean
  flashTaskbar: boolean
  sidebarWidth: number
  showSpam: boolean
  autoCheckUpdates: boolean
  locale: string
  linkPreviewsEnabled: boolean
}

const DEFAULTS: PersistedSettings = {
  notificationsEnabled: false,
  flashTaskbar: true,
  sidebarWidth: 280,
  showSpam: false,
  autoCheckUpdates: true,
  locale: 'auto',
  linkPreviewsEnabled: true,
}

function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>
      return { ...DEFAULTS, ...parsed }
    }
  } catch {
    // Corrupted data — use defaults
  }
  return { ...DEFAULTS }
}

function saveSettings(s: PersistedSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // Storage full or unavailable — ignore
  }
}

const initial = loadSettings()

export const settings = $state({
  notificationsEnabled: initial.notificationsEnabled,
  flashTaskbar: initial.flashTaskbar,
  sidebarWidth: initial.sidebarWidth,
  showSpam: initial.showSpam,
  autoCheckUpdates: initial.autoCheckUpdates,
  locale: initial.locale,
  linkPreviewsEnabled: initial.linkPreviewsEnabled,
})

/**
 * Initialize settings persistence. Call from App.svelte onMount.
 * Sets up an effect to save settings whenever they change.
 */
export function initSettingsStore(): void {
  $effect(() => {
    saveSettings({
      notificationsEnabled: settings.notificationsEnabled,
      flashTaskbar: settings.flashTaskbar,
      sidebarWidth: settings.sidebarWidth,
      showSpam: settings.showSpam,
      autoCheckUpdates: settings.autoCheckUpdates,
      locale: settings.locale,
      linkPreviewsEnabled: settings.linkPreviewsEnabled,
    })
  })
}
