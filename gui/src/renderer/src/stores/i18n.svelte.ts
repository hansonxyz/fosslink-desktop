/**
 * Internationalization Store
 *
 * Provides a reactive `t(key, params?)` function for translating UI strings.
 * Reads locale preference from the settings store. When locale changes,
 * all components using `t()` in their templates re-render automatically
 * because `t()` reads from a `$derived` messages map.
 */

import { settings } from './settings.svelte'
import { locales } from '../lib/locales'
import en from '../lib/locales/en'

/**
 * Resolve user preference to a supported locale code.
 * 'auto' detects from navigator.language, matching exact or base language.
 */
function resolveLocale(pref: string): string {
  if (pref !== 'auto') return locales[pref] ? pref : 'en'
  const nav = navigator.language // e.g. "pt-BR", "zh-CN", "en-US"
  if (locales[nav]) return nav
  const base = nav.split('-')[0]!
  if (locales[base]) return base
  return 'en'
}

const _messages: Record<string, string> = $derived(
  locales[resolveLocale(settings.locale)]?.messages ?? en,
)

/**
 * Translate a key, with optional parameter interpolation.
 * Falls back to English if the key is missing in the current locale,
 * and to the raw key if missing in English too.
 *
 * @example t('settings.title') // "Settings"
 * @example t('updates.available', { version: '0.1.2' }) // "Version 0.1.2 available"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  let msg = _messages[key] ?? en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      msg = msg.replaceAll(`{${k}}`, String(v))
    }
  }
  return msg
}

/** The currently resolved locale code (e.g. 'en', 'es', 'zh'). */
export const resolvedLocale = {
  get current(): string {
    return resolveLocale(settings.locale)
  },
}
