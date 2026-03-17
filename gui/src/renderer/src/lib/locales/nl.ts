/**
 * Dutch (Nederlands) translations.
 * All keys must match en.ts exactly.
 */
export const nl: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'Over FossLink',
  'app.newMessage': 'Nieuw bericht',
  'app.findPhone': 'Vind mijn telefoon',
  'app.syncMessages': 'Berichten synchroniseren',
  'app.settings': 'Instellingen',
  'app.sidebarPlaceholder': 'Verbind een apparaat om gesprekken te zien',
  'app.sidebarPlaceholderAlt': 'Gesprekken verschijnen hier',
  'app.emptyState': 'Selecteer een gesprek om te beginnen met berichten',

  // Status indicator
  'status.noDaemon': 'Daemon draait niet',
  'status.disconnected': 'Geen apparaat verbonden',
  'status.discovering': 'Apparaten zoeken...',
  'status.pairing': 'Koppelen...',
  'status.connected': 'Apparaat verbonden',
  'status.syncing': 'Synchroniseren...',
  'status.ready': 'Gereed',
  'status.error': 'Fout',

  // Pairing page
  'pairing.starting': 'Starten...',
  'pairing.initializing': 'FossLink initialiseren',
  'pairing.incomingRequest': 'Inkomend koppelverzoek',
  'pairing.wantsToPair': '{device} wil koppelen',
  'pairing.verifyHint': 'Controleer of de code overeenkomt op je telefoon voordat je accepteert',
  'pairing.accept': 'Accepteren',
  'pairing.reject': 'Weigeren',
  'pairing.title': 'Koppelen',
  'pairing.confirmCode': 'Bevestig dat deze code overeenkomt op je telefoon',
  'pairing.connectionError': 'Verbindingsfout',
  'pairing.unexpectedError': 'Er is een onverwachte fout opgetreden',
  'pairing.autoRecover': 'De daemon zal automatisch proberen te herstellen',
  'pairing.connectTitle': 'Verbind met je telefoon',
  'pairing.searching': 'Apparaten zoeken...',
  'pairing.dontSeePhone': 'Zie je je telefoon niet?',
  'pairing.installApp': 'Installeer de',
  'pairing.companionApp': 'FossLink-begeleidingsapp',
  'pairing.sameWifi': 'en verbind met hetzelfde Wi-Fi-netwerk.',
  'pairing.getStarted': 'Aan de slag met FossLink',
  'pairing.installDescription': 'Installeer de FossLink-begeleidingsapp op je Android-telefoon om je berichten, contacten en meldingen te synchroniseren met je computer.',
  'pairing.qrAlt': 'QR-code om de FossLink-begeleidingsapp te downloaden',
  'pairing.downloadApp': 'Begeleidingsapp downloaden',
  'pairing.step1': 'Installeer de FossLink-app op je telefoon',
  'pairing.step2': 'Open de app en zorg dat je verbonden bent met hetzelfde Wi-Fi-netwerk',
  'pairing.step3': 'Je telefoon verschijnt hier automatisch',
  'pairing.dismiss': 'Sluiten',

  // Device list
  'devices.pairedDevices': 'Gekoppelde apparaten',
  'devices.offline': 'Offline',
  'devices.unpair': 'Ontkoppelen',
  'devices.nearbyDevices': 'Apparaten in de buurt',
  'devices.pair': 'Koppelen',
  'devices.noDevices': 'Geen apparaten in de buurt gevonden',

  // Conversations
  'conversations.loading': 'Gesprekken laden...',
  'conversations.noMatch': 'Geen gesprekken komen overeen met je zoekopdracht',
  'conversations.empty': 'Nog geen gesprekken',

  // Search bar
  'search.placeholder': 'Gesprekken zoeken...',
  'search.clear': 'Zoekopdracht wissen',
  'search.showUnread': 'Alleen ongelezen tonen',
  'search.showAll': 'Alle gesprekken tonen',
  'search.filterSpam': 'Spam/onbekend filteren',

  // Message thread
  'messages.loading': 'Berichten laden...',
  'messages.empty': 'Geen berichten in dit gesprek',
  'messages.sending': 'Verzenden...',
  'messages.sent': 'Verzonden',
  'messages.failed': 'Verzenden mislukt',
  'messages.retry': 'Opnieuw proberen',
  'messages.cancel': 'Annuleren',
  'messages.compose': 'Typ een bericht...',
  'messages.send': 'Bericht verzenden',
  'messages.emoji': 'Emoji',

  // Export
  'export.tooltip': 'Gesprek exporteren',
  'export.txt': 'Exporteren als TXT',
  'export.csv': 'Exporteren als CSV',
  'export.csvHeader': 'Datum,Van,Inhoud',
  'export.me': 'Ik',

  // Message bubble
  'bubble.saveAttachment': 'Bijlage opslaan',
  'bubble.mmsAlt': 'MMS-bijlage',
  'bubble.videoAlt': 'Video',
  'bubble.failedToLoad': 'Laden mislukt',
  'bubble.copyCode': '{code} kopiëren',
  'bubble.codeCopied': '{code} gekopieerd naar klembord',

  // New conversation
  'newMessage.to': 'Aan:',
  'newMessage.changeRecipient': 'Ontvanger wijzigen',
  'newMessage.startNew': 'Nieuw gesprek starten',
  'newMessage.enterContact': 'Voer hierboven een contactnaam of telefoonnummer in',

  // Contact autocomplete
  'contacts.placeholder': 'Typ een naam of telefoonnummer...',

  // Settings panel
  'settings.title': 'Instellingen',
  'settings.close': 'Instellingen sluiten',
  'settings.connection': 'Verbinding',
  'settings.status': 'Status',
  'settings.device': 'Apparaat',
  'settings.waitingDevice': 'Wachten op apparaat...',
  'settings.ipAddress': 'IP-adres',
  'settings.type': 'Type',
  'settings.statusConnected': 'Verbonden',
  'settings.statusReconnecting': 'Opnieuw verbinden',
  'settings.statusDisconnected': 'Niet verbonden',
  'settings.notifications': 'Meldingen',
  'settings.desktopNotifications': 'Bureaubladmeldingen',
  'settings.flashTaskbar': 'Taakbalk laten knipperen bij nieuw bericht',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.language': 'Taal',
  'settings.languageAuto': 'Automatisch (detecteren van systeem)',

  // Updates
  'updates.title': 'Updates',
  'updates.version': 'Versie',
  'updates.checkAuto': 'Automatisch controleren',
  'updates.checking': 'Controleren op updates...',
  'updates.available': 'Versie {version} beschikbaar',
  'updates.upToDate': 'Je bent up-to-date',
  'updates.downloading': 'Downloaden... {percent}%',
  'updates.ready': 'Versie {version} klaar om te installeren',
  'updates.error': 'Updatefout: {message}',
  'updates.checkBtn': 'Controleren op updates',
  'updates.checkingBtn': 'Controleren...',
  'updates.viewOnGithub': 'Update bekijken op GitHub',
  'updates.restartBtn': 'Herstarten om te updaten',

  // Update banner
  'banner.ready': 'Versie {version} is klaar om te installeren.',
  'banner.restart': 'Herstarten om te updaten',
  'banner.later': 'Later',

  // Device settings section
  'settings.deviceSection': 'Apparaat',
  'settings.unpairConfirm': 'Ontkoppelen van {device}? Je moet opnieuw koppelen om FossLink te gebruiken.',
  'settings.unpairBtn': 'Ontkoppelen',
  'settings.unpairing': 'Ontkoppelen...',
  'settings.cancelBtn': 'Annuleren',
  'settings.unpairDevice': 'Apparaat ontkoppelen',
  'settings.aboutBtn': 'Over FossLink',

  // Find my phone
  'findPhone.close': 'Sluiten',
  'findPhone.title': 'Vind mijn telefoon',
  'findPhone.description': 'Dit laat je telefoon op vol volume rinkelen, zelfs als deze op stil staat.',
  'findPhone.ring': 'Telefoon laten rinkelen',
  'findPhone.ringing': 'Rinkelen...',
  'findPhone.ringingDesc': 'Je telefoon zou nu moeten rinkelen.',
  'findPhone.ringAgain': 'Opnieuw rinkelen',
  'findPhone.errorTitle': 'Kon telefoon niet laten rinkelen',
  'findPhone.tryAgain': 'Opnieuw proberen',

  // About dialog
  'about.close': 'Sluiten',
  'about.name': 'FossLink',
  'about.version': 'Versie 0.1',
  'about.credit': '2026 door Brian Hanson',
  'about.releasedUnder': 'Uitgebracht onder de',
  'about.mitLicense': 'MIT-licentie',
  'about.acknowledgments': 'Dankbetuigingen',
  'about.ffmpegDesc': 'videotranscodering en miniatuurgeneratie',
  'about.electronDesc': 'cross-platform desktopframework',
  'about.svelteDesc': 'reactief UI-framework',
  'about.sourceAvailable': 'Volledige licentie en broncode beschikbaar op',
  'about.tagline': 'Deze software is aangeboden in de geest van open source, in de hoop dat het je leven een beetje makkelijker maakt.',

  // Notification
  'notification.newMessage': 'Nieuw bericht ontvangen',

  // Time formatting
  'time.today': 'Vandaag',
  'time.yesterday': 'Gisteren',
}

export default nl
