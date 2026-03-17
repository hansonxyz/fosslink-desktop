/**
 * Scroll State Store
 *
 * Tracks whether the message thread is scrolled to the bottom.
 * Used to gate auto-read-marking: threads are only marked read
 * when the newest message is visible in the viewport.
 */

export const scrollState = $state({
  /** True when the last message is at least partially visible */
  isAtBottom: true,
})
