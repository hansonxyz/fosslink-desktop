/**
 * Message Formatting
 *
 * Time and date formatting for the message thread view.
 * Timestamps are shown as periodic centered badges (Signal-style),
 * not on every message.
 */

import { t } from '../stores/i18n.svelte'
import { resolvedLocale } from '../stores/i18n.svelte'

/** Minimum gap (ms) between messages before showing a new timestamp badge. */
export const TIMESTAMP_GAP_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Format a time string. Always shows "3:42 PM" style.
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(resolvedLocale.current, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Format a timestamp badge label.
 * Combines date context + time into a single string:
 * - Same day, just a gap: "3:42 PM"
 * - Today, first or day change: "Today, 3:42 PM"
 * - Yesterday: "Yesterday, 3:42 PM"
 * - This year: "Wed, Jan 15, 3:42 PM"
 * - Older: "Wed, Jan 15, 2024, 3:42 PM"
 */
export function formatTimestampBadge(timestamp: number, isDayChange: boolean): string {
  const time = formatTime(timestamp)
  const locale = resolvedLocale.current

  if (!isDayChange) return time

  const date = new Date(timestamp)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const messageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.floor((today.getTime() - messageDay.getTime()) / 86400000)

  if (diffDays === 0) return `${t('time.today')}, ${time}`
  if (diffDays === 1) return `${t('time.yesterday')}, ${time}`

  if (date.getFullYear() === now.getFullYear()) {
    const datePart = date.toLocaleDateString(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    return `${datePart}, ${time}`
  }

  const datePart = date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${datePart}, ${time}`
}

/**
 * Check if two timestamps fall on different calendar days.
 */
export function isDifferentDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() !== db.getFullYear() ||
    da.getMonth() !== db.getMonth() ||
    da.getDate() !== db.getDate()
  )
}
