/**
 * Verification Code Detection & Extraction
 *
 * Detects messages that contain authentication/verification codes
 * and extracts the code for clipboard copy. Used by both the spam
 * filter (conversation list) and the copy-code button (message bubbles).
 */

/**
 * Keywords that indicate a message contains a verification code.
 * Kept as a single regex for efficiency. Covers:
 * - verification, verify
 * - code (generic but combined with a number pattern, low false-positive)
 * - otp (one-time password)
 * - passcode
 * - log in / login / sign in / signin
 * - authentication / authenticate
 * - 2fa / two-factor
 */
const KEYWORD_RE =
  /(?:verif(?:y|ication)|code|otp|passcode|log\s?in|sign\s?in|authenticat|2fa|two.?factor)/i

/**
 * Code patterns, ordered by specificity:
 * 1. Letter-prefix + dash + digits: G-123456, GA-12345
 * 2. Pure numeric: 4-8 digit standalone numbers
 *
 * Capped at 8 digits to avoid matching phone numbers or account IDs.
 */
const PREFIXED_CODE_RE = /\b([A-Za-z]{1,3}-\d{4,8})\b/g
const NUMERIC_CODE_RE = /\b(\d{4,8})\b/g

/**
 * Extract the verification code from a message, if present.
 * Returns the code string (e.g. "123456" or "G-123456") or null.
 * When multiple candidates exist, returns the one with the most digits.
 */
export function extractVerificationCode(text: string): string | null {
  if (!KEYWORD_RE.test(text)) return null

  const candidates: { code: string; digitCount: number }[] = []

  // Prefixed codes: G-123456, GA-12345
  for (const m of text.matchAll(PREFIXED_CODE_RE)) {
    const code = m[1]!.toUpperCase()
    candidates.push({ code, digitCount: code.replace(/\D/g, '').length })
  }

  // Pure numeric codes: 123456
  for (const m of text.matchAll(NUMERIC_CODE_RE)) {
    candidates.push({ code: m[1]!, digitCount: m[1]!.length })
  }

  if (candidates.length === 0) return null

  // Pick the code with the most digits
  candidates.sort((a, b) => b.digitCount - a.digitCount)
  return candidates[0]!.code
}

/**
 * Check whether text looks like a verification code message.
 * Convenience wrapper for the spam filter.
 */
export function isVerificationMessage(text: string): boolean {
  return extractVerificationCode(text) !== null
}
