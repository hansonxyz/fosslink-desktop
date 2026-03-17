/**
 * Device Store
 *
 * Tracks discovered devices, paired device IDs, and pairing state.
 * Provides action functions for pairing workflows.
 */

// Reactive state object — mutate properties, never reassign the export
export const devices = $state({
  discovered: [] as DiscoveredDevice[],
  pairedIds: [] as string[],
  incomingPairing: null as IncomingPairingRequest | null,
  outgoingPairingKey: null as string | null,
  pairingDeviceId: null as string | null,
  pairingError: null as string | null
})

/**
 * Initialize the device store. Call from App.svelte onMount.
 * Returns a cleanup function to unregister listeners.
 */
export function initDeviceStore(): () => void {
  const handleNotification = (method: string, params: unknown): void => {
    switch (method) {
      case 'device.found': {
        const device = params as DiscoveredDevice
        const idx = devices.discovered.findIndex((d) => d.deviceId === device.deviceId)
        if (idx >= 0) {
          devices.discovered[idx] = device
        } else {
          devices.discovered.push(device)
        }
        break
      }
      case 'device.lost': {
        const { deviceId } = params as { deviceId: string }
        const idx = devices.discovered.findIndex((d) => d.deviceId === deviceId)
        if (idx >= 0) {
          devices.discovered.splice(idx, 1)
        }
        break
      }
      case 'pairing.incoming': {
        devices.incomingPairing = params as IncomingPairingRequest
        break
      }
      case 'pairing.code': {
        const { deviceId, code } = params as { deviceId: string; deviceName: string; code: string }
        devices.pairingDeviceId = deviceId
        devices.outgoingPairingKey = code
        break
      }
      case 'pairing.result': {
        const result = params as PairingResult
        if (result.success) {
          if (!devices.pairedIds.includes(result.deviceId)) {
            devices.pairedIds.push(result.deviceId)
          }
        } else {
          devices.pairingError = 'Pairing failed or was rejected'
        }
        devices.outgoingPairingKey = null
        devices.pairingDeviceId = null
        devices.incomingPairing = null
        break
      }
    }
  }

  window.api.onNotification(handleNotification)

  return () => {
    window.api.offNotification(handleNotification)
  }
}

/**
 * Fetch current device lists from daemon.
 * Call when socket connects or enters discovering state.
 */
export async function refreshDevices(): Promise<void> {
  try {
    const discovered = (await window.api.invoke('devices.discovered')) as DiscoveredDevice[]
    devices.discovered.length = 0
    devices.discovered.push(...discovered)

    const paired = (await window.api.invoke('devices.paired')) as string[]
    devices.pairedIds.length = 0
    devices.pairedIds.push(...paired)
  } catch {
    // Not connected, leave current state
  }
}

export async function requestPairing(deviceId: string): Promise<void> {
  devices.pairingError = null
  devices.pairingDeviceId = deviceId
  try {
    const result = (await window.api.invoke('pair.request', { deviceId })) as {
      verificationKey: string
    }
    devices.outgoingPairingKey = result.verificationKey
  } catch (err) {
    devices.pairingDeviceId = null
    devices.pairingError = err instanceof Error ? err.message : 'Pairing request failed'
  }
}

export async function acceptIncomingPairing(deviceId: string): Promise<void> {
  try {
    await window.api.invoke('pair.accept', { deviceId })
  } catch (err) {
    devices.pairingError = err instanceof Error ? err.message : 'Failed to accept pairing'
  }
}

export async function rejectIncomingPairing(deviceId: string): Promise<void> {
  try {
    await window.api.invoke('pair.reject', { deviceId })
  } catch {
    // Ignore errors on reject
  }
  devices.incomingPairing = null
}

export async function unpairDevice(deviceId: string): Promise<void> {
  try {
    await window.api.invoke('pair.unpair', { deviceId })
    const idx = devices.pairedIds.indexOf(deviceId)
    if (idx >= 0) {
      devices.pairedIds.splice(idx, 1)
    }
  } catch (err) {
    devices.pairingError = err instanceof Error ? err.message : 'Unpair failed'
  }
}

export function clearPairingError(): void {
  devices.pairingError = null
}
