/**
 * Locale Registry
 *
 * Maps locale codes to their display names and message catalogs.
 * Import order determines dropdown order in the Settings panel.
 */

import { en } from './en'
import { es } from './es'
import { fr } from './fr'
import { de } from './de'
import { pt } from './pt'
import { it } from './it'
import { nl } from './nl'
import { ru } from './ru'
import { zh } from './zh'
import { ja } from './ja'
import { ko } from './ko'
import { ar } from './ar'
import { hi } from './hi'
import { tr } from './tr'
import { pl } from './pl'

export interface LocaleEntry {
  name: string
  messages: Record<string, string>
}

export const locales: Record<string, LocaleEntry> = {
  en: { name: 'English', messages: en },
  es: { name: 'Español', messages: es },
  fr: { name: 'Français', messages: fr },
  de: { name: 'Deutsch', messages: de },
  pt: { name: 'Português', messages: pt },
  it: { name: 'Italiano', messages: it },
  nl: { name: 'Nederlands', messages: nl },
  ru: { name: 'Русский', messages: ru },
  zh: { name: '中文', messages: zh },
  ja: { name: '日本語', messages: ja },
  ko: { name: '한국어', messages: ko },
  ar: { name: 'العربية', messages: ar },
  hi: { name: 'हिन्दी', messages: hi },
  tr: { name: 'Türkçe', messages: tr },
  pl: { name: 'Polski', messages: pl },
}

/** Ordered list of locale codes for the language picker. */
export const localeOrder: string[] = Object.keys(locales)
