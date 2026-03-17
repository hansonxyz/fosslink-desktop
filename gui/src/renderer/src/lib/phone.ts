/**
 * Phone Number Utilities
 *
 * Normalization and classification for contact matching
 * and spam detection.
 */

/** Strip all non-digit characters. */
export function stripNonDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

/**
 * Normalize a phone number for contact matching.
 * Returns the last 10 digits (handles +1, 1- prefix for US/CA).
 * For shorter numbers, returns all digits.
 */
export function normalizePhone(phone: string): string {
  const digits = stripNonDigits(phone)
  if (digits.length >= 10) {
    return digits.slice(-10)
  }
  return digits
}

/**
 * Determine if a phone number is a "short code" (non-personal number).
 * Short codes: fewer than 7 digits, or contain letters.
 */
export function isShortCode(phone: string): boolean {
  if (/[a-zA-Z]/.test(phone)) return true
  const digits = stripNonDigits(phone)
  return digits.length > 0 && digits.length < 7
}

/**
 * Format a phone number for display.
 * Attempts US format: (555) 123-4567
 */
export function formatPhone(phone: string): string {
  const digits = stripNonDigits(phone)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}
