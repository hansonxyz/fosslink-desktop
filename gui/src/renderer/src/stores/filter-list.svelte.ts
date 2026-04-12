/**
 * Filter List Store
 *
 * Manages the set of phone numbers whose threads are hidden from
 * the conversation list. Synced from the phone on connect.
 * Changes are sent to the phone and propagated to other desktops.
 */

import { normalizePhone } from '../lib/phone'

const filteredNumbers = $state(new Set<string>())

export const filterList = {
  /** Check if a phone number (or any of a thread's addresses) is filtered. */
  isFiltered(addresses: string | string[]): boolean {
    const addrs = Array.isArray(addresses) ? addresses : [addresses]
    for (const addr of addrs) {
      if (filteredNumbers.has(addr) || filteredNumbers.has(normalizePhone(addr))) {
        return true
      }
    }
    return false
  },

  /** Get all filtered numbers. */
  getAll(): string[] {
    return [...filteredNumbers]
  },

  get count(): number {
    return filteredNumbers.size
  },
}

/** Replace the entire filter list (called on sync from phone). */
export function setFilterList(numbers: string[]): void {
  filteredNumbers.clear()
  for (const num of numbers) {
    filteredNumbers.add(num)
    filteredNumbers.add(normalizePhone(num))
  }
}

/** Add a number to the filter list and notify the phone. */
export async function addToFilterList(number: string): Promise<void> {
  filteredNumbers.add(number)
  filteredNumbers.add(normalizePhone(number))
  await window.api.invoke('filter.set', { number, filtered: true })
}

/** Remove a number from the filter list and notify the phone. */
export async function removeFromFilterList(number: string): Promise<void> {
  filteredNumbers.delete(number)
  filteredNumbers.delete(normalizePhone(number))
  await window.api.invoke('filter.set', { number, filtered: false })
}

/** Initialize filter list store — listen for sync notifications. */
export function initFilterListStore(): () => void {
  const handleNotification = (method: string, params: unknown): void => {
    if (method === 'filter.list_synced') {
      const data = params as { numbers: string[] }
      setFilterList(data.numbers)
    } else if (method === 'filter.changed') {
      const data = params as { number: string; filtered: boolean }
      if (data.filtered) {
        filteredNumbers.add(data.number)
        filteredNumbers.add(normalizePhone(data.number))
      } else {
        filteredNumbers.delete(data.number)
        filteredNumbers.delete(normalizePhone(data.number))
      }
    }
  }

  window.api.onNotification(handleNotification)
  return () => window.api.offNotification(handleNotification)
}

/** Reset filter list (on unpair). */
export function resetFilterList(): void {
  filteredNumbers.clear()
}
