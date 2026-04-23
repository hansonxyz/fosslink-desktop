/**
 * Phone number utilities (daemon-side).
 *
 * Mirrors the renderer's gui/src/renderer/src/lib/phone.ts so contact matching
 * in daemon-side code (backup/export, migration helpers) keys the same way.
 */

/** Strip all non-digit characters. */
export function stripNonDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/**
 * Normalize a phone number for contact matching.
 * Returns the last 10 digits (handles +1, 1- prefix for US/CA).
 * For shorter numbers, returns all digits.
 */
export function normalizePhone(phone: string): string {
  const digits = stripNonDigits(phone);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

/**
 * Format a phone number for display.
 * Attempts US format: (555) 123-4567.
 */
export function formatPhone(phone: string): string {
  const digits = stripNonDigits(phone);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}
