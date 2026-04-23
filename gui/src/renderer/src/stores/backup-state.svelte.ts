/**
 * Global flag for "a backup is running". When true the sidebar shows a
 * non-interactive overlay so the user can't switch threads mid-export.
 */
export const backupState = $state({
  running: false,
})
