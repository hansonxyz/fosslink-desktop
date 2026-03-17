/**
 * Battery Store
 *
 * Tracks the phone's battery charge level and charging state.
 * Updated via daemon IPC notifications when the phone sends
 * battery packets.
 */

export const battery = $state({
  charge: -1, // -1 = unknown (don't show indicator)
  charging: false,
})

/**
 * Initialize the battery store. Call from App.svelte onMount.
 * Returns a cleanup function.
 */
export function initBatteryStore(): () => void {
  const handleNotification = (method: string, params: unknown): void => {
    if (method === 'device.battery') {
      const data = params as BatteryInfo | null
      if (data && typeof data.charge === 'number') {
        battery.charge = data.charge
        battery.charging = data.charging
      }
    } else if (method === 'state.changed') {
      const data = params as { to?: string } | null
      // Reset battery on disconnect
      if (data?.to === 'DISCONNECTED' || data?.to === 'DISCOVERING') {
        battery.charge = -1
        battery.charging = false
      }
    }
  }

  window.api.onNotification(handleNotification)

  // Fetch current battery state if already connected
  void window.api.invoke('device.battery').then((result) => {
    const data = result as BatteryInfo | null
    if (data && typeof data.charge === 'number' && data.charge >= 0) {
      battery.charge = data.charge
      battery.charging = data.charging
    }
  }).catch(() => {})

  return () => {
    window.api.offNotification(handleNotification)
  }
}
