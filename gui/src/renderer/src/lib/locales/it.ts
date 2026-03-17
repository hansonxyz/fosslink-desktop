/** Italian translations */
export const it: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'Informazioni su FossLink',
  'app.newMessage': 'Nuovo messaggio',
  'app.findPhone': 'Trova il mio telefono',
  'app.syncMessages': 'Sincronizza messaggi',
  'app.settings': 'Impostazioni',
  'app.sidebarPlaceholder': 'Connetti un dispositivo per vedere le conversazioni',
  'app.sidebarPlaceholderAlt': 'Le conversazioni appariranno qui',
  'app.emptyState': 'Seleziona una conversazione per iniziare a scrivere',

  // Status indicator
  'status.noDaemon': 'Il daemon non è in esecuzione',
  'status.disconnected': 'Nessun dispositivo connesso',
  'status.discovering': 'Ricerca dispositivi...',
  'status.pairing': 'Accoppiamento...',
  'status.connected': 'Dispositivo connesso',
  'status.syncing': 'Sincronizzazione...',
  'status.ready': 'Pronto',
  'status.error': 'Errore',

  // Pairing page
  'pairing.starting': 'Avvio...',
  'pairing.initializing': 'Inizializzazione di FossLink',
  'pairing.incomingRequest': 'Richiesta di accoppiamento in arrivo',
  'pairing.wantsToPair': '{device} vuole accoppiarsi',
  'pairing.verifyHint': 'Verifica che il codice corrisponda sul tuo telefono prima di accettare',
  'pairing.accept': 'Accetta',
  'pairing.reject': 'Rifiuta',
  'pairing.title': 'Accoppiamento',
  'pairing.confirmCode': 'Conferma che questo codice corrisponde sul tuo telefono',
  'pairing.connectionError': 'Errore di connessione',
  'pairing.unexpectedError': 'Si è verificato un errore imprevisto',
  'pairing.autoRecover': 'Il daemon tenterà di ripristinarsi automaticamente',
  'pairing.connectTitle': 'Connetti il tuo telefono',
  'pairing.searching': 'Ricerca dispositivi...',
  'pairing.dontSeePhone': 'Non vedi il tuo telefono?',
  'pairing.installApp': 'Installa l\'',
  'pairing.companionApp': 'app companion FossLink',
  'pairing.sameWifi': 'e connettiti alla stessa rete Wi-Fi.',
  'pairing.getStarted': 'Inizia con FossLink',
  'pairing.installDescription': 'Installa l\'app companion FossLink sul tuo telefono Android per sincronizzare messaggi, contatti e notifiche con il tuo computer.',
  'pairing.qrAlt': 'Codice QR per scaricare l\'app companion FossLink',
  'pairing.downloadApp': 'Scarica App Companion',
  'pairing.step1': 'Installa l\'app FossLink sul tuo telefono',
  'pairing.step2': 'Apri l\'app e assicurati di essere sulla stessa rete Wi-Fi',
  'pairing.step3': 'Il tuo telefono apparirà qui automaticamente',
  'pairing.dismiss': 'Chiudi',

  // Device list
  'devices.pairedDevices': 'Dispositivi accoppiati',
  'devices.offline': 'Non in linea',
  'devices.unpair': 'Disaccoppia',
  'devices.nearbyDevices': 'Dispositivi nelle vicinanze',
  'devices.pair': 'Accoppia',
  'devices.noDevices': 'Nessun dispositivo trovato nelle vicinanze',

  // Conversations
  'conversations.loading': 'Caricamento conversazioni...',
  'conversations.noMatch': 'Nessuna conversazione corrisponde alla ricerca',
  'conversations.empty': 'Nessuna conversazione ancora',

  // Search bar
  'search.placeholder': 'Cerca conversazioni...',
  'search.clear': 'Cancella ricerca',
  'search.showUnread': 'Solo non letti',
  'search.showAll': 'Tutte le conversazioni',
  'search.filterSpam': 'Filtra spam/sconosciuti',

  // Message thread
  'messages.loading': 'Caricamento messaggi...',
  'messages.empty': 'Nessun messaggio in questa conversazione',
  'messages.sending': 'Invio...',
  'messages.sent': 'Inviato',
  'messages.failed': 'Invio non riuscito',
  'messages.retry': 'Riprova',
  'messages.cancel': 'Annulla',
  'messages.compose': 'Scrivi un messaggio...',
  'messages.send': 'Invia messaggio',
  'messages.emoji': 'Emoji',
  'messages.attach': 'Allega file',
  'messages.removeAttachment': 'Rimuovi allegato',
  'messages.attachmentTooLarge': 'La dimensione totale supera il limite MMS. Il messaggio potrebbe fallire.',
  'messages.attachmentTooMany': 'Massimo 10 allegati consentiti',

  // Export
  'export.tooltip': 'Esporta conversazione',
  'export.txt': 'Esporta come TXT',
  'export.csv': 'Esporta come CSV',
  'export.csvHeader': 'Data,Da,Corpo',
  'export.me': 'Io',

  // Message bubble
  'bubble.saveAttachment': 'Salva allegato',
  'bubble.mmsAlt': 'Allegato MMS',
  'bubble.videoAlt': 'Video',
  'bubble.failedToLoad': 'Caricamento non riuscito',
  'bubble.copyCode': 'Copia {code}',
  'bubble.codeCopied': '{code} copiato negli appunti',

  // New conversation
  'newMessage.to': 'A:',
  'newMessage.changeRecipient': 'Cambia destinatario',
  'newMessage.startNew': 'Inizia una nuova conversazione',
  'newMessage.enterContact': 'Inserisci un nome di contatto o un numero di telefono sopra',

  // Contact autocomplete
  'contacts.placeholder': 'Digita un nome o un numero di telefono...',

  // Settings panel
  'settings.title': 'Impostazioni',
  'settings.close': 'Chiudi impostazioni',
  'settings.connection': 'Connessione',
  'settings.status': 'Stato',
  'settings.device': 'Dispositivo',
  'settings.waitingDevice': 'In attesa del dispositivo...',
  'settings.ipAddress': 'Indirizzo IP',
  'settings.type': 'Tipo',
  'settings.service': 'Servizio',
  'settings.storage': 'Spazio libero',
  'settings.statusConnected': 'Connesso',
  'settings.statusReconnecting': 'Riconnessione',
  'settings.statusDisconnected': 'Disconnesso',
  'settings.notifications': 'Notifiche',
  'settings.desktopNotifications': 'Notifiche desktop',
  'settings.flashTaskbar': 'Lampeggia barra delle applicazioni per nuovo messaggio',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.linkPreviews': 'Mostra anteprime link',

  // Language
  'settings.language': 'Lingua',
  'settings.languageAuto': 'Automatica (rileva dal sistema)',

  // Theme
  'settings.theme': 'Tema',

  // Updates
  'updates.title': 'Aggiornamenti',
  'updates.version': 'Versione',
  'updates.checkAuto': 'Controlla automaticamente',
  'updates.checking': 'Controllo aggiornamenti...',
  'updates.available': 'Versione {version} disponibile',
  'updates.upToDate': 'Sei aggiornato',
  'updates.downloading': 'Download... {percent}%',
  'updates.ready': 'Versione {version} pronta per l\'installazione',
  'updates.error': 'Errore di aggiornamento: {message}',
  'updates.checkBtn': 'Controlla aggiornamenti',
  'updates.checkingBtn': 'Controllo...',
  'updates.viewOnGithub': 'Vedi aggiornamento su GitHub',
  'updates.restartBtn': 'Riavvia per aggiornare',

  // Update banner
  'banner.ready': 'La versione {version} è pronta per l\'installazione.',
  'banner.restart': 'Riavvia per aggiornare',
  'banner.later': 'Più tardi',

  // Device settings section
  'settings.deviceSection': 'Dispositivo',
  'settings.unpairConfirm': 'Disaccoppiare da {device}? Dovrai accoppiarti di nuovo per usare FossLink.',
  'settings.unpairBtn': 'Disaccoppia',
  'settings.unpairing': 'Disaccoppiamento...',
  'settings.cancelBtn': 'Annulla',
  'settings.unpairDevice': 'Disaccoppia dispositivo',
  'settings.aboutBtn': 'Informazioni su FossLink',

  // Find my phone
  'findPhone.close': 'Chiudi',
  'findPhone.title': 'Trova il mio telefono',
  'findPhone.description': 'Il tuo telefono squillerà al volume massimo, anche se è in modalità silenziosa.',
  'findPhone.ring': 'Fai squillare',
  'findPhone.ringing': 'Squillando...',
  'findPhone.ringingDesc': 'Il tuo telefono dovrebbe squillare adesso.',
  'findPhone.ringAgain': 'Squilla di nuovo',
  'findPhone.errorTitle': 'Impossibile far squillare il telefono',
  'findPhone.tryAgain': 'Riprova',

  // About dialog
  'about.close': 'Chiudi',
  'about.name': 'FossLink',
  'about.version': 'Version 1.0.0',
  'about.credit': '2026 di Brian Hanson',
  'about.releasedUnder': 'Rilasciato sotto la',
  'about.mitLicense': 'Licenza MIT',
  'about.acknowledgments': 'Ringraziamenti',
  'about.ffmpegDesc': 'transcodifica video e generazione di miniature',
  'about.electronDesc': 'framework desktop multipiattaforma',
  'about.svelteDesc': 'framework UI reattivo',
  'about.sourceAvailable': 'Licenza completa e codice sorgente disponibili su',
  'about.androidApp': 'Get the Android companion app on',
  'about.googlePlay': 'Google Play',
  'about.tagline': 'Questo software è stato creato nello spirito dell\'open source, nella speranza di rendere la tua vita un po\' più semplice.',

  // Dial confirmation
  'dial.confirm': 'Chiamare {number} sul tuo telefono?',
  'dial.ok': 'OK',
  'dial.cancel': 'Annulla',
  'dial.callBtn': 'Chiama',

  // URL sharing
  'app.shareUrl': 'Apri URL sul telefono',
  'shareUrl.title': 'Apri URL sul telefono',
  'shareUrl.placeholder': 'https://...',
  'shareUrl.cancel': 'Annulla',
  'shareUrl.share': 'Condividi',
  'shareUrl.invalidUrl': 'Inserisci un URL valido che inizia con http:// o https://',

  // Resync
  'settings.resyncBtn': 'Risincronizza',

  // Version compatibility
  'version.companionUpdateRequired': 'Aggiornamento app richiesto',
  'version.companionUpdateDesc': 'L\'app FossLink del tuo telefono (v{peerVersion}) non è compatibile con questa versione di FossLink Desktop (v{desktopVersion}). Aggiorna l\'app.',
  'version.desktopUpdateRequired': 'Aggiornamento desktop richiesto',
  'version.desktopUpdateDesc': 'Questa versione di FossLink Desktop (v{desktopVersion}) non è compatibile con l\'app FossLink del tuo telefono (v{peerVersion}). Aggiorna FossLink Desktop.',
  'version.updateCompanion': 'Aggiorna app',
  'version.downloadUpdate': 'Scarica aggiornamento',
  'version.orScanQR': 'Oppure scansiona questo codice QR sul tuo telefono per scaricare l\'ultima versione:',
  'version.sentToPhone': 'Richiesta di aggiornamento inviata al telefono',

  // Storage analyzer
  'storage.title': 'Analizzatore di archiviazione',
  'storage.analyzing': 'Analisi dell\'archiviazione del telefono...',
  'storage.analyzeBtn': 'Analizza archiviazione',
  'storage.close': 'Chiudi',
  'storage.free': '{free} GB liberi di {total} GB',
  'storage.error': 'Analisi dell\'archiviazione fallita',
  'storage.noRoot': 'Attiva l\'integrazione root sul tuo telefono per un\'analisi dettagliata.',

  // Extras section
  'extras.title': 'Extra',
  'extras.storageTitle': 'Esplora archiviazione',
  'extras.storageSubtitle': 'Analizza l\'uso dello spazio',
  'extras.filesTitle': 'File del telefono',
  'extras.filesSubtitle': 'Sfoglia il file system',
  'extras.filesMounted': 'Montato',
  'extras.migrationTitle': 'Migrazione contatti',
  'extras.migrationSubtitle': 'Sposta contatti del dispositivo su Google',

  // Contact migration
  'migration.title': 'Migrazione contatti',
  'migration.intro': 'Trova i contatti memorizzati sul dispositivo o SIM che non sono salvati in Google Contacts e migrali.',
  'migration.scanBtn': 'Cerca contatti del dispositivo',
  'migration.scanning': 'Scansione contatti sul telefono...',
  'migration.found': '{count} contatti trovati solo sul dispositivo',
  'migration.migrateTo': 'Migra a: {account}',
  'migration.noGoogle': 'Nessun account Google trovato sul telefono.',
  'migration.selectAll': 'Seleziona tutti ({count})',
  'migration.migrateBtn': 'Migra {count} contatti su Google',
  'migration.migrating': 'Migrazione contatti...',
  'migration.success': '{count} contatti migrati con successo.',
  'migration.failed': '{count} contatti falliti.',
  'migration.allGood': 'Tutti i contatti sono già salvati in Google.',
  'migration.done': 'Fatto',
  'migration.retry': 'Riprova',

  // Gallery
  'app.gallery': 'Galleria del telefono',
  'gallery.title': 'Galleria del telefono',
  'gallery.close': 'Chiudi galleria',
  'gallery.viewDcim': 'DCIM',
  'gallery.viewScreenshots': 'Screenshot',
  'gallery.viewFolders': 'Cartelle',
  'gallery.viewAll': 'Tutto',
  'gallery.sizeSmall': 'Miniature piccole',
  'gallery.sizeLarge': 'Miniature grandi',
  'gallery.toggleHidden': 'Mostra/nascondi file nascosti',
  'gallery.scanning': 'Scansione della galleria del telefono...',
  'gallery.retry': 'Riprova',
  'gallery.empty': 'Nessun media trovato',
  'gallery.noFolders': 'Nessuna cartella trovata',

  // Notification
  'notification.newMessage': 'Nuovo messaggio ricevuto',

  // Time formatting
  'time.today': 'Oggi',
  'time.yesterday': 'Ieri',
}

export default it
