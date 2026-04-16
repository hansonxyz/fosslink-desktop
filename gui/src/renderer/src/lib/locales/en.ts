/**
 * English translations (source of truth).
 * All other locale files must have the same keys.
 */
export const en: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'About FossLink',
  'app.newMessage': 'New message',
  'app.findPhone': 'Find my phone',
  'app.syncMessages': 'Sync messages',
  'app.settings': 'Settings',
  'app.sidebarPlaceholder': 'Connect a device to see conversations',
  'app.sidebarPlaceholderAlt': 'Conversations will appear here',
  'app.emptyState': 'Select a conversation to start messaging',
  'app.syncWait': 'Please wait for initial message sync',

  // Status indicator
  'status.noDaemon': 'Daemon not running',
  'status.disconnected': 'No device connected',
  'status.discovering': 'Searching for devices...',
  'status.pairing': 'Pairing...',
  'status.connected': 'Device connected',
  'status.syncing': 'Syncing...',
  'status.ready': 'Ready',
  'status.error': 'Error',

  // Pairing page
  'pairing.starting': 'Starting...',
  'pairing.initializing': 'Initializing FossLink',
  'pairing.incomingRequest': 'Incoming Pairing Request',
  'pairing.wantsToPair': '{device} wants to pair',
  'pairing.verifyHint': 'Verify the code matches on your phone before accepting',
  'pairing.accept': 'Accept',
  'pairing.reject': 'Reject',
  'pairing.title': 'Pairing',
  'pairing.confirmCode': 'Confirm this code matches on your phone',
  'pairing.acceptOnPhone': 'Accept the pairing request on your phone',
  'pairing.connectionError': 'Connection Error',
  'pairing.unexpectedError': 'An unexpected error occurred',
  'pairing.autoRecover': 'The daemon will attempt to recover automatically',
  'pairing.connectTitle': 'Connect to Your Phone',
  'pairing.searching': 'Searching for devices...',
  'pairing.dontSeePhone': "Don't see your phone?",
  'pairing.installApp': 'Install the',
  'pairing.companionApp': 'FossLink companion app',
  'pairing.sameWifi': 'and connect to the same Wi-Fi network.',
  'pairing.getStarted': 'Get Started with FossLink',
  'pairing.installDescription': 'Install the FossLink companion app on your Android phone to sync your messages, contacts, and notifications with your computer.',
  'pairing.qrAlt': 'QR code to download the FossLink companion app',
  'pairing.downloadApp': 'Download Companion App',
  'pairing.step1': 'Install the FossLink app on your phone',
  'pairing.step2': "Open the app and make sure you're on the same Wi-Fi network",
  'pairing.step3': 'Your phone will appear here automatically',
  'pairing.dismiss': 'Dismiss',

  // Device list
  'devices.pairedDevices': 'Paired Devices',
  'devices.offline': 'Offline',
  'devices.unpair': 'Unpair',
  'devices.nearbyDevices': 'Nearby Devices',
  'devices.pair': 'Pair',
  'devices.noDevices': 'No devices found nearby',

  // Conversations
  'conversations.loading': 'Loading conversations...',
  'conversations.noMatch': 'No conversations match your search',
  'conversations.empty': 'No conversations yet',

  // Search bar
  'search.placeholder': 'Search conversations...',
  'search.clear': 'Clear search',
  'search.showUnread': 'Show unread only',
  'search.showAll': 'Show all conversations',
  'search.filterSpam': 'Filter spam/unknown',

  // Message thread
  'messages.loading': 'Loading messages...',
  'messages.empty': 'No messages in this conversation',
  'messages.sending': 'Sending...',
  'messages.sent': 'Sent',
  'messages.failed': 'Failed to send',
  'messages.retry': 'Retry',
  'messages.cancel': 'Cancel',
  'messages.compose': 'Type a message...',
  'messages.send': 'Send message',
  'messages.emoji': 'Emoji',
  'messages.attach': 'Attach file',
  'messages.removeAttachment': 'Remove attachment',
  'messages.attachmentTooLarge': 'Total size exceeds MMS limit. Message may fail.',
  'messages.attachmentTooMany': 'Maximum 10 attachments allowed',

  // Export
  'export.tooltip': 'Export conversation',
  'export.txt': 'Export as TXT',
  'export.csv': 'Export as CSV',
  'export.csvHeader': 'Date,From,Body',
  'export.me': 'Me',

  // Message bubble
  'bubble.saveAttachment': 'Save attachment',
  'bubble.mmsAlt': 'MMS attachment',
  'bubble.videoAlt': 'Video',
  'bubble.failedToLoad': 'Failed to load',
  'bubble.copyCode': 'Copy {code}',
  'bubble.codeCopied': '{code} copied to clipboard',

  // New conversation
  'newMessage.to': 'To:',
  'newMessage.changeRecipient': 'Change recipient',
  'newMessage.startNew': 'Start a new conversation',
  'newMessage.enterContact': 'Enter a contact name or phone number above',

  // Contact autocomplete
  'contacts.placeholder': 'Type a name or phone number...',

  // Settings panel
  'settings.title': 'Settings',
  'settings.close': 'Close settings',
  'settings.connection': 'Connection',
  'settings.status': 'Status',
  'settings.device': 'Device',
  'settings.waitingDevice': 'Waiting for device...',
  'settings.ipAddress': 'IP Address',
  'settings.type': 'Type',
  'settings.service': 'Service',
  'settings.storage': 'Storage free',
  'settings.statusConnected': 'Connected',
  'settings.statusReconnecting': 'Reconnecting',
  'settings.statusDisconnected': 'Disconnected',
  'settings.notifications': 'Notifications',
  'settings.desktopNotifications': 'Desktop notifications',
  'settings.flashTaskbar': 'Flash taskbar on new message',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.linkPreviews': 'Show link previews',

  // Language
  'settings.language': 'Language',
  'settings.languageAuto': 'Auto (detect from system)',

  // Theme
  'settings.theme': 'Theme',

  // Updates
  'updates.title': 'Updates',
  'updates.version': 'Version',
  'updates.checkAuto': 'Check automatically',
  'updates.checking': 'Checking for updates...',
  'updates.available': 'Version {version} available',
  'updates.upToDate': 'You are up to date',
  'updates.downloading': 'Downloading... {percent}%',
  'updates.ready': 'Version {version} ready to install',
  'updates.error': 'Update error: {message}',
  'updates.checkBtn': 'Check for Updates',
  'updates.checkingBtn': 'Checking...',
  'updates.viewOnGithub': 'View Update on GitHub',
  'updates.updateNow': 'Update Now',
  'updates.restartBtn': 'Restart to Update',
  'updates.installing': 'Downloading update... {percent}%',

  // Update banner
  'banner.available': 'Version {version} is available.',
  'banner.updateNow': 'Update Now',
  'banner.installing': 'Downloading update... {percent}%',
  'banner.ready': 'Version {version} is ready to install.',
  'banner.restart': 'Restart to Update',
  'banner.later': 'Later',

  // Device settings section
  'settings.deviceSection': 'Device',
  'settings.unpairConfirm': "Unpair from {device}? You'll need to pair again to use FossLink.",
  'settings.unpairBtn': 'Unpair',
  'settings.unpairing': 'Unpairing...',
  'settings.cancelBtn': 'Cancel',
  'settings.unpairDevice': 'Unpair Device',
  'settings.aboutBtn': 'About FossLink',

  // Find my phone
  'findPhone.close': 'Close',
  'findPhone.title': 'Find My Phone',
  'findPhone.description': "This will make your phone ring at full volume, even if it's on silent.",
  'findPhone.ring': 'Ring Phone',
  'findPhone.ringing': 'Ringing...',
  'findPhone.ringingDesc': 'Your phone should be ringing now.',
  'findPhone.ringAgain': 'Ring Again',
  'findPhone.errorTitle': "Couldn't Ring Phone",
  'findPhone.tryAgain': 'Try Again',

  // About dialog
  'about.close': 'Close',
  'about.name': 'FossLink',
  'about.version': 'Version 1.5.0',
  'about.credit': '2026 by Brian Hanson',
  'about.releasedUnder': 'Released under the',
  'about.mitLicense': 'MIT License',
  'about.acknowledgments': 'Acknowledgments',
  'about.ffmpegDesc': 'video transcoding and thumbnail generation',
  'about.electronDesc': 'cross-platform desktop framework',
  'about.svelteDesc': 'reactive UI framework',
  'about.sourceAvailable': 'Full license and source available at',
  'about.androidApp': 'Get the Android companion app on',
  'about.googlePlay': 'Google Play',
  'about.tagline': 'This software was provided in the spirit of open source, in the hope that it makes your life a little easier.',

  // Dial confirmation
  'dial.confirm': 'Call {number} on your phone?',
  'dial.ok': 'OK',
  'dial.cancel': 'Cancel',
  'dial.callBtn': 'Call',

  // URL sharing
  'app.shareUrl': 'Open URL on Phone',
  'shareUrl.title': 'Open URL on Phone',
  'shareUrl.placeholder': 'https://...',
  'shareUrl.cancel': 'Cancel',
  'shareUrl.share': 'Share',
  'shareUrl.invalidUrl': 'Enter a valid URL starting with http:// or https://',

  // Resync
  'settings.resyncBtn': 'Resync',

  // Version compatibility
  'version.companionUpdateRequired': 'Companion App Update Required',
  'version.companionUpdateDesc': "Your phone's FossLink app (v{peerVersion}) is not compatible with this version of FossLink Desktop (v{desktopVersion}). Please update the companion app to continue.",
  'version.desktopUpdateRequired': 'Desktop Update Required',
  'version.desktopUpdateDesc': 'This version of FossLink Desktop (v{desktopVersion}) is not compatible with your phone\'s FossLink app (v{peerVersion}). Please update FossLink Desktop to continue.',
  'version.updateCompanion': 'Update Companion App',
  'version.downloadUpdate': 'Download Update',
  'version.orScanQR': 'Or scan this QR code on your phone to download the latest version:',
  'version.sentToPhone': 'Update prompt sent to phone',
  'version.outdatedStatus': 'Outdated Software - Please Update',
  'version.companionOutdatedStatus': 'Companion App Outdated',
  'version.dismiss': 'Dismiss',

  // Extras section
  'extras.title': 'Extras',
  'extras.filesTitle': 'Phone Files',
  'extras.filesSubtitle': 'Browse phone filesystem',
  'extras.filesMounted': 'Mounted',
  'extras.migrationTitle': 'Contact Migration',
  'extras.migrationSubtitle': 'Move device contacts to Google',

  // Contact migration
  'migration.title': 'Contact Migration',
  'migration.intro': "Find contacts stored on your device or SIM that aren't backed up to Google Contacts, and migrate them.",
  'migration.scanBtn': 'Scan for Device Contacts',
  'migration.scanning': 'Scanning contacts on phone...',
  'migration.found': '{count} device-only contacts found',
  'migration.migrateTo': 'Migrate to: {account}',
  'migration.noGoogle': 'No Google account found on phone.',
  'migration.selectAll': 'Select all ({count})',
  'migration.migrateBtn': 'Migrate {count} Contacts to Google',
  'migration.migrating': 'Migrating contacts...',
  'migration.success': '{count} contacts migrated successfully.',
  'migration.failed': '{count} contacts failed.',
  'migration.allGood': 'All contacts are already backed up to Google.',
  'migration.done': 'Done',
  'migration.retry': 'Retry',

  // Gallery
  'app.gallery': 'Phone Gallery',
  'gallery.title': 'Phone Gallery',
  'gallery.close': 'Close gallery',
  'gallery.viewDcim': 'DCIM',
  'gallery.viewScreenshots': 'Screenshots',
  'gallery.viewFolders': 'Folders',
  'gallery.viewAll': 'All',
  'gallery.sizeSmall': 'Small thumbnails',
  'gallery.sizeLarge': 'Large thumbnails',
  'gallery.toggleHidden': 'Toggle hidden files',
  'gallery.scanning': 'Scanning phone gallery...',
  'gallery.retry': 'Retry',
  'gallery.empty': 'No media found',
  'gallery.noFolders': 'No folders found',

  // Notification
  'notification.newMessage': 'New message received',

  // Time formatting
  'time.today': 'Today',
  'time.yesterday': 'Yesterday',
}

export default en
