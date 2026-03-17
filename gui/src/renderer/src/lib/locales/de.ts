/** German translations */
export const de: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'Über FossLink',
  'app.newMessage': 'Neue Nachricht',
  'app.findPhone': 'Mein Telefon finden',
  'app.syncMessages': 'Nachrichten synchronisieren',
  'app.settings': 'Einstellungen',
  'app.sidebarPlaceholder': 'Verbinde ein Gerät, um Unterhaltungen zu sehen',
  'app.sidebarPlaceholderAlt': 'Unterhaltungen werden hier angezeigt',
  'app.emptyState': 'Wähle eine Unterhaltung aus, um zu schreiben',

  // Status indicator
  'status.noDaemon': 'Daemon läuft nicht',
  'status.disconnected': 'Kein Gerät verbunden',
  'status.discovering': 'Suche nach Geräten...',
  'status.pairing': 'Koppeln...',
  'status.connected': 'Gerät verbunden',
  'status.syncing': 'Synchronisiere...',
  'status.ready': 'Bereit',
  'status.error': 'Fehler',

  // Pairing page
  'pairing.starting': 'Starte...',
  'pairing.initializing': 'FossLink wird initialisiert',
  'pairing.incomingRequest': 'Eingehende Kopplungsanfrage',
  'pairing.wantsToPair': '{device} möchte sich koppeln',
  'pairing.verifyHint': 'Überprüfe, ob der Code auf deinem Telefon übereinstimmt, bevor du akzeptierst',
  'pairing.accept': 'Akzeptieren',
  'pairing.reject': 'Ablehnen',
  'pairing.title': 'Kopplung',
  'pairing.confirmCode': 'Bestätige, dass dieser Code auf deinem Telefon übereinstimmt',
  'pairing.connectionError': 'Verbindungsfehler',
  'pairing.unexpectedError': 'Ein unerwarteter Fehler ist aufgetreten',
  'pairing.autoRecover': 'Der Daemon wird versuchen, sich automatisch wiederherzustellen',
  'pairing.connectTitle': 'Verbinde dein Telefon',
  'pairing.searching': 'Suche nach Geräten...',
  'pairing.dontSeePhone': 'Dein Telefon wird nicht angezeigt?',
  'pairing.installApp': 'Installiere die',
  'pairing.companionApp': 'FossLink-Begleit-App',
  'pairing.sameWifi': 'und verbinde dich mit dem gleichen WLAN.',
  'pairing.getStarted': 'Erste Schritte mit FossLink',
  'pairing.installDescription': 'Installiere die FossLink-Begleit-App auf deinem Android-Telefon, um Nachrichten, Kontakte und Benachrichtigungen mit deinem Computer zu synchronisieren.',
  'pairing.qrAlt': 'QR-Code zum Herunterladen der FossLink-Begleit-App',
  'pairing.downloadApp': 'Begleit-App herunterladen',
  'pairing.step1': 'Installiere die FossLink-App auf deinem Telefon',
  'pairing.step2': 'Öffne die App und stelle sicher, dass du im gleichen WLAN bist',
  'pairing.step3': 'Dein Telefon erscheint hier automatisch',
  'pairing.dismiss': 'Schließen',

  // Device list
  'devices.pairedDevices': 'Gekoppelte Geräte',
  'devices.offline': 'Offline',
  'devices.unpair': 'Entkoppeln',
  'devices.nearbyDevices': 'Geräte in der Nähe',
  'devices.pair': 'Koppeln',
  'devices.noDevices': 'Keine Geräte in der Nähe gefunden',

  // Conversations
  'conversations.loading': 'Lade Unterhaltungen...',
  'conversations.noMatch': 'Keine Unterhaltungen stimmen mit deiner Suche überein',
  'conversations.empty': 'Noch keine Unterhaltungen',

  // Search bar
  'search.placeholder': 'Unterhaltungen durchsuchen...',
  'search.clear': 'Suche löschen',
  'search.showUnread': 'Nur ungelesene',
  'search.showAll': 'Alle Unterhaltungen',
  'search.filterSpam': 'Spam/Unbekannte filtern',

  // Message thread
  'messages.loading': 'Lade Nachrichten...',
  'messages.empty': 'Keine Nachrichten in dieser Unterhaltung',
  'messages.sending': 'Sende...',
  'messages.sent': 'Gesendet',
  'messages.failed': 'Senden fehlgeschlagen',
  'messages.retry': 'Erneut versuchen',
  'messages.cancel': 'Abbrechen',
  'messages.compose': 'Nachricht eingeben...',
  'messages.send': 'Nachricht senden',
  'messages.emoji': 'Emoji',

  // Export
  'export.tooltip': 'Unterhaltung exportieren',
  'export.txt': 'Als TXT exportieren',
  'export.csv': 'Als CSV exportieren',
  'export.csvHeader': 'Datum,Von,Inhalt',
  'export.me': 'Ich',

  // Message bubble
  'bubble.saveAttachment': 'Anhang speichern',
  'bubble.mmsAlt': 'MMS-Anhang',
  'bubble.videoAlt': 'Video',
  'bubble.failedToLoad': 'Laden fehlgeschlagen',
  'bubble.copyCode': '{code} kopieren',
  'bubble.codeCopied': '{code} in die Zwischenablage kopiert',

  // New conversation
  'newMessage.to': 'An:',
  'newMessage.changeRecipient': 'Empfänger ändern',
  'newMessage.startNew': 'Neue Unterhaltung starten',
  'newMessage.enterContact': 'Gib oben einen Kontaktnamen oder eine Telefonnummer ein',

  // Contact autocomplete
  'contacts.placeholder': 'Name oder Telefonnummer eingeben...',

  // Settings panel
  'settings.title': 'Einstellungen',
  'settings.close': 'Einstellungen schließen',
  'settings.connection': 'Verbindung',
  'settings.status': 'Status',
  'settings.device': 'Gerät',
  'settings.waitingDevice': 'Warte auf Gerät...',
  'settings.ipAddress': 'IP-Adresse',
  'settings.type': 'Typ',
  'settings.statusConnected': 'Verbunden',
  'settings.statusReconnecting': 'Verbindung wird wiederhergestellt',
  'settings.statusDisconnected': 'Getrennt',
  'settings.notifications': 'Benachrichtigungen',
  'settings.desktopNotifications': 'Desktop-Benachrichtigungen',
  'settings.flashTaskbar': 'Taskleiste bei neuer Nachricht blinken',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.language': 'Sprache',
  'settings.languageAuto': 'Automatisch (vom System erkennen)',

  // Updates
  'updates.title': 'Aktualisierungen',
  'updates.version': 'Version',
  'updates.checkAuto': 'Automatisch prüfen',
  'updates.checking': 'Suche nach Aktualisierungen...',
  'updates.available': 'Version {version} verfügbar',
  'updates.upToDate': 'Du bist auf dem neuesten Stand',
  'updates.downloading': 'Herunterladen... {percent}%',
  'updates.ready': 'Version {version} bereit zur Installation',
  'updates.error': 'Aktualisierungsfehler: {message}',
  'updates.checkBtn': 'Nach Aktualisierungen suchen',
  'updates.checkingBtn': 'Suche...',
  'updates.viewOnGithub': 'Aktualisierung auf GitHub ansehen',
  'updates.restartBtn': 'Neu starten zum Aktualisieren',

  // Update banner
  'banner.ready': 'Version {version} ist bereit zur Installation.',
  'banner.restart': 'Neu starten zum Aktualisieren',
  'banner.later': 'Später',

  // Device settings section
  'settings.deviceSection': 'Gerät',
  'settings.unpairConfirm': 'Von {device} entkoppeln? Du musst dich erneut koppeln, um FossLink zu verwenden.',
  'settings.unpairBtn': 'Entkoppeln',
  'settings.unpairing': 'Entkoppeln...',
  'settings.cancelBtn': 'Abbrechen',
  'settings.unpairDevice': 'Gerät entkoppeln',
  'settings.aboutBtn': 'Über FossLink',

  // Find my phone
  'findPhone.close': 'Schließen',
  'findPhone.title': 'Mein Telefon finden',
  'findPhone.description': 'Dein Telefon wird auf voller Lautstärke klingeln, auch wenn es stummgeschaltet ist.',
  'findPhone.ring': 'Telefon klingeln lassen',
  'findPhone.ringing': 'Klingelt...',
  'findPhone.ringingDesc': 'Dein Telefon sollte jetzt klingeln.',
  'findPhone.ringAgain': 'Erneut klingeln',
  'findPhone.errorTitle': 'Telefon konnte nicht angeklingelt werden',
  'findPhone.tryAgain': 'Erneut versuchen',

  // About dialog
  'about.close': 'Schließen',
  'about.name': 'FossLink',
  'about.version': 'Version 0.1',
  'about.credit': '2026 von Brian Hanson',
  'about.releasedUnder': 'Veröffentlicht unter der',
  'about.mitLicense': 'MIT-Lizenz',
  'about.acknowledgments': 'Danksagungen',
  'about.ffmpegDesc': 'Videotranskodierung und Miniaturbilderzeugung',
  'about.electronDesc': 'plattformübergreifendes Desktop-Framework',
  'about.svelteDesc': 'reaktives UI-Framework',
  'about.sourceAvailable': 'Vollständige Lizenz und Quellcode verfügbar unter',
  'about.tagline': 'Diese Software wurde im Geiste von Open Source bereitgestellt, in der Hoffnung, dir das Leben ein wenig leichter zu machen.',

  // Notification
  'notification.newMessage': 'Neue Nachricht erhalten',

  // Time formatting
  'time.today': 'Heute',
  'time.yesterday': 'Gestern',
}

export default de
