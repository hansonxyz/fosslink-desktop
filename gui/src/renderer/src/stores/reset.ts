/**
 * Central app data reset.
 *
 * Called on unpair to wipe ALL renderer state that is tied to a device
 * or session. Settings/preferences are NOT reset — only data that came
 * from the phone or was derived from it.
 */

import { conversations } from './conversations.svelte'
import { messages } from './messages.svelte'
import { contacts } from './contacts.svelte'
import { devices } from './devices.svelte'
import { battery } from './battery.svelte'
import { syncProgress } from './connection.svelte'
import { scrollState } from './scroll.svelte'
import { resetFilterList } from './filter-list.svelte'
import { closeLightbox } from './lightbox.svelte'
import { resetGallery } from './gallery.svelte'
import { clearAttachmentStates } from './attachments.svelte'
import { resetLinkPreviews } from './link-previews.svelte'
import { resetSendQueue } from './send-queue.svelte'
import { resetMessages } from './messages.svelte'

export function resetAppData(): void {
  // Conversations
  conversations.raw.length = 0
  conversations.loading = false
  conversations.selectedThreadId = null
  conversations.searchQuery = ''
  conversations.showUnreadOnly = false
  conversations.composingNew = false
  conversations.composeAddress = null

  // Messages
  resetMessages()

  // Contacts
  contacts.list.length = 0
  contacts.byPhone.clear()
  contacts.loading = false
  contacts.version++

  // Devices (clear pairing state, keep discovered for re-pairing)
  devices.pairedIds.length = 0
  devices.outgoingPairingKey = null
  devices.pairingDeviceId = null
  devices.pairingError = null
  devices.incomingPairing = null

  // Battery
  battery.charge = -1
  battery.charging = false

  // Sync progress
  syncProgress.percent = null

  // Scroll
  scrollState.isAtBottom = true

  // Lightbox
  closeLightbox()

  // Gallery (items, thumbnails, downloads, watchers)
  resetGallery()

  // Attachment download states
  clearAttachmentStates()

  // Link preview cache
  resetLinkPreviews()

  // Send queue
  resetSendQueue()

  // Filter list
  resetFilterList()
}
