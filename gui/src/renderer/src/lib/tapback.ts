/**
 * iPhone Tapback Parser
 *
 * Detects iPhone "tapback" reactions sent as plain SMS text.
 * Format: `Liked "message text"` or `Removed a like from "message text"`
 * Supports both straight quotes and smart (curly) quotes.
 *
 * Note: Only handles English tapbacks. iPhones with other system languages
 * send localized strings (e.g. Spanish "Le gustó", French "A aimé").
 */

export interface ParsedTapback {
  type: 'add' | 'remove'
  emoji: string
  quotedText: string
  /** Whether the quoted text was truncated (ends with … or ...) */
  isTruncated: boolean
}

// Match: Liked "text", Loved "text", Laughed at "text", etc.
// Supports straight " and smart \u201C \u201D quotes
const TAPBACK_ADD = /^(Liked|Loved|Laughed at|Emphasized|Questioned|Disliked) ["\u201C](.+)["\u201D]\s*$/s

// Match: Removed a like from "text", Removed a heart from "text", etc.
const TAPBACK_REMOVE = /^Removed an? (like|heart|laugh|emphasis|question mark|dislike) from ["\u201C](.+)["\u201D]\s*$/s

const ADD_EMOJI: Record<string, string> = {
  'Liked': '\u{1F44D}',
  'Loved': '\u2764\uFE0F',
  'Laughed at': '\u{1F602}',
  'Emphasized': '\u203C\uFE0F',
  'Questioned': '\u2753',
  'Disliked': '\u{1F44E}',
}

const REMOVE_EMOJI: Record<string, string> = {
  'like': '\u{1F44D}',
  'heart': '\u2764\uFE0F',
  'laugh': '\u{1F602}',
  'emphasis': '\u203C\uFE0F',
  'question mark': '\u2753',
  'dislike': '\u{1F44E}',
}

export function parseTapback(body: string): ParsedTapback | null {
  let match = TAPBACK_ADD.exec(body)
  if (match) {
    let quotedText = match[2]!
    const isTruncated = quotedText.endsWith('\u2026') || quotedText.endsWith('...')
    if (isTruncated) {
      quotedText = quotedText.replace(/[\u2026.]+$/, '')
    }
    return {
      type: 'add',
      emoji: ADD_EMOJI[match[1]!] ?? '\u{1F44D}',
      quotedText,
      isTruncated,
    }
  }

  match = TAPBACK_REMOVE.exec(body)
  if (match) {
    let quotedText = match[2]!
    const isTruncated = quotedText.endsWith('\u2026') || quotedText.endsWith('...')
    if (isTruncated) {
      quotedText = quotedText.replace(/[\u2026.]+$/, '')
    }
    return {
      type: 'remove',
      emoji: REMOVE_EMOJI[match[1]!] ?? '\u{1F44D}',
      quotedText,
      isTruncated,
    }
  }

  return null
}
