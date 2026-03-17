/**
 * Polish translations for FossLink GUI.
 * All keys must match the English source (en.ts).
 */
export const pl: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'O FossLink',
  'app.newMessage': 'Nowa wiadomość',
  'app.findPhone': 'Znajdź mój telefon',
  'app.syncMessages': 'Synchronizuj wiadomości',
  'app.settings': 'Ustawienia',
  'app.sidebarPlaceholder': 'Połącz urządzenie, aby zobaczyć rozmowy',
  'app.sidebarPlaceholderAlt': 'Rozmowy pojawią się tutaj',
  'app.emptyState': 'Wybierz rozmowę, aby rozpocząć wysyłanie wiadomości',

  // Status indicator
  'status.noDaemon': 'Usługa nie działa',
  'status.disconnected': 'Brak połączonego urządzenia',
  'status.discovering': 'Wyszukiwanie urządzeń...',
  'status.pairing': 'Parowanie...',
  'status.connected': 'Urządzenie połączone',
  'status.syncing': 'Synchronizacja...',
  'status.ready': 'Gotowe',
  'status.error': 'Błąd',

  // Pairing page
  'pairing.starting': 'Uruchamianie...',
  'pairing.initializing': 'Inicjalizacja FossLink',
  'pairing.incomingRequest': 'Przychodzące żądanie parowania',
  'pairing.wantsToPair': '{device} chce się sparować',
  'pairing.verifyHint': 'Przed zaakceptowaniem sprawdź, czy kod zgadza się z tym na telefonie',
  'pairing.accept': 'Akceptuj',
  'pairing.reject': 'Odrzuć',
  'pairing.title': 'Parowanie',
  'pairing.confirmCode': 'Potwierdź, że ten kod zgadza się z kodem na telefonie',
  'pairing.connectionError': 'Błąd połączenia',
  'pairing.unexpectedError': 'Wystąpił nieoczekiwany błąd',
  'pairing.autoRecover': 'Usługa spróbuje odzyskać połączenie automatycznie',
  'pairing.connectTitle': 'Połącz się z telefonem',
  'pairing.searching': 'Wyszukiwanie urządzeń...',
  'pairing.dontSeePhone': 'Nie widzisz swojego telefonu?',
  'pairing.installApp': 'Zainstaluj',
  'pairing.companionApp': 'aplikację towarzyszącą FossLink',
  'pairing.sameWifi': 'i połącz się z tą samą siecią Wi-Fi.',
  'pairing.getStarted': 'Zacznij korzystać z FossLink',
  'pairing.installDescription': 'Zainstaluj aplikację towarzyszącą FossLink na swoim telefonie z Androidem, aby synchronizować wiadomości, kontakty i powiadomienia z komputerem.',
  'pairing.qrAlt': 'Kod QR do pobrania aplikacji towarzyszącej FossLink',
  'pairing.downloadApp': 'Pobierz aplikację towarzyszącą',
  'pairing.step1': 'Zainstaluj aplikację FossLink na swoim telefonie',
  'pairing.step2': 'Otwórz aplikację i upewnij się, że jesteś w tej samej sieci Wi-Fi',
  'pairing.step3': 'Twój telefon pojawi się tutaj automatycznie',
  'pairing.dismiss': 'Zamknij',

  // Device list
  'devices.pairedDevices': 'Sparowane urządzenia',
  'devices.offline': 'Offline',
  'devices.unpair': 'Rozparuj',
  'devices.nearbyDevices': 'Urządzenia w pobliżu',
  'devices.pair': 'Sparuj',
  'devices.noDevices': 'Nie znaleziono urządzeń w pobliżu',

  // Conversations
  'conversations.loading': 'Ładowanie rozmów...',
  'conversations.noMatch': 'Brak rozmów pasujących do wyszukiwania',
  'conversations.empty': 'Brak rozmów',

  // Search bar
  'search.placeholder': 'Szukaj w rozmowach...',
  'search.clear': 'Wyczyść wyszukiwanie',
  'search.showUnread': 'Pokaż tylko nieprzeczytane',
  'search.showAll': 'Pokaż wszystkie rozmowy',
  'search.filterSpam': 'Filtruj spam/nieznane',

  // Message thread
  'messages.loading': 'Ładowanie wiadomości...',
  'messages.empty': 'Brak wiadomości w tej rozmowie',
  'messages.sending': 'Wysyłanie...',
  'messages.sent': 'Wysłano',
  'messages.failed': 'Nie udało się wysłać',
  'messages.retry': 'Ponów',
  'messages.cancel': 'Anuluj',
  'messages.compose': 'Napisz wiadomość...',
  'messages.send': 'Wyślij wiadomość',
  'messages.emoji': 'Emoji',
  'messages.attach': 'Dołącz plik',
  'messages.removeAttachment': 'Usuń załącznik',
  'messages.attachmentTooLarge': 'Całkowity rozmiar przekracza limit MMS. Wiadomość może się nie wysłać.',
  'messages.attachmentTooMany': 'Maksymalnie 10 załączników',

  // Export
  'export.tooltip': 'Eksportuj rozmowę',
  'export.txt': 'Eksportuj jako TXT',
  'export.csv': 'Eksportuj jako CSV',
  'export.csvHeader': 'Data,Od,Treść',
  'export.me': 'Ja',

  // Message bubble
  'bubble.saveAttachment': 'Zapisz załącznik',
  'bubble.mmsAlt': 'Załącznik MMS',
  'bubble.videoAlt': 'Wideo',
  'bubble.failedToLoad': 'Nie udało się załadować',
  'bubble.copyCode': 'Kopiuj {code}',
  'bubble.codeCopied': '{code} skopiowano do schowka',

  // New conversation
  'newMessage.to': 'Do:',
  'newMessage.changeRecipient': 'Zmień odbiorcę',
  'newMessage.startNew': 'Rozpocznij nową rozmowę',
  'newMessage.enterContact': 'Wpisz powyżej nazwę kontaktu lub numer telefonu',

  // Contact autocomplete
  'contacts.placeholder': 'Wpisz nazwę lub numer telefonu...',

  // Settings panel
  'settings.title': 'Ustawienia',
  'settings.close': 'Zamknij ustawienia',
  'settings.connection': 'Połączenie',
  'settings.status': 'Status',
  'settings.device': 'Urządzenie',
  'settings.waitingDevice': 'Oczekiwanie na urządzenie...',
  'settings.ipAddress': 'Adres IP',
  'settings.type': 'Typ',
  'settings.service': 'Usługa',
  'settings.storage': 'Wolna pamięć',
  'settings.statusConnected': 'Połączono',
  'settings.statusReconnecting': 'Ponowne łączenie',
  'settings.statusDisconnected': 'Rozłączono',
  'settings.notifications': 'Powiadomienia',
  'settings.desktopNotifications': 'Powiadomienia na pulpicie',
  'settings.flashTaskbar': 'Migaj paskiem zadań przy nowej wiadomości',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.linkPreviews': 'Pokaż podgląd linków',

  // Language
  'settings.language': 'Język',
  'settings.languageAuto': 'Automatycznie (wykryj z systemu)',

  // Theme
  'settings.theme': 'Motyw',

  // Updates
  'updates.title': 'Aktualizacje',
  'updates.version': 'Wersja',
  'updates.checkAuto': 'Sprawdzaj automatycznie',
  'updates.checking': 'Sprawdzanie aktualizacji...',
  'updates.available': 'Wersja {version} dostępna',
  'updates.upToDate': 'Masz najnowszą wersję',
  'updates.downloading': 'Pobieranie... {percent}%',
  'updates.ready': 'Wersja {version} gotowa do zainstalowania',
  'updates.error': 'Błąd aktualizacji: {message}',
  'updates.checkBtn': 'Sprawdź aktualizacje',
  'updates.checkingBtn': 'Sprawdzanie...',
  'updates.viewOnGithub': 'Zobacz aktualizację na GitHub',
  'updates.restartBtn': 'Uruchom ponownie, aby zaktualizować',

  // Update banner
  'banner.ready': 'Wersja {version} jest gotowa do zainstalowania.',
  'banner.restart': 'Uruchom ponownie, aby zaktualizować',
  'banner.later': 'Później',

  // Device settings section
  'settings.deviceSection': 'Urządzenie',
  'settings.unpairConfirm': 'Rozparować z {device}? Aby korzystać z FossLink, trzeba będzie sparować ponownie.',
  'settings.unpairBtn': 'Rozparuj',
  'settings.unpairing': 'Rozparowywanie...',
  'settings.cancelBtn': 'Anuluj',
  'settings.unpairDevice': 'Rozparuj urządzenie',
  'settings.aboutBtn': 'O FossLink',

  // Find my phone
  'findPhone.close': 'Zamknij',
  'findPhone.title': 'Znajdź mój telefon',
  'findPhone.description': 'Telefon zadzwoni na pełną głośność, nawet jeśli jest wyciszony.',
  'findPhone.ring': 'Zadzwoń na telefon',
  'findPhone.ringing': 'Dzwoni...',
  'findPhone.ringingDesc': 'Twój telefon powinien teraz dzwonić.',
  'findPhone.ringAgain': 'Zadzwoń ponownie',
  'findPhone.errorTitle': 'Nie udało się zadzwonić',
  'findPhone.tryAgain': 'Spróbuj ponownie',

  // About dialog
  'about.close': 'Zamknij',
  'about.name': 'FossLink',
  'about.version': 'Version 1.0.0',
  'about.credit': '2026 Brian Hanson',
  'about.releasedUnder': 'Wydano na licencji',
  'about.mitLicense': 'Licencja MIT',
  'about.acknowledgments': 'Podziękowania',
  'about.ffmpegDesc': 'transkodowanie wideo i generowanie miniatur',
  'about.electronDesc': 'wieloplatformowy framework desktopowy',
  'about.svelteDesc': 'reaktywny framework UI',
  'about.sourceAvailable': 'Pełna licencja i kod źródłowy dostępne na',
  'about.androidApp': 'Get the Android companion app on',
  'about.googlePlay': 'Google Play',
  'about.tagline': 'To oprogramowanie zostało udostępnione w duchu open source, z nadzieją, że uczyni Twoje życie nieco łatwiejszym.',

  // Dial confirmation
  'dial.confirm': 'Zadzwonić na {number} z telefonu?',
  'dial.ok': 'OK',
  'dial.cancel': 'Anuluj',
  'dial.callBtn': 'Zadzwoń',

  // URL sharing
  'app.shareUrl': 'Otwórz URL na telefonie',
  'shareUrl.title': 'Otwórz URL na telefonie',
  'shareUrl.placeholder': 'https://...',
  'shareUrl.cancel': 'Anuluj',
  'shareUrl.share': 'Udostępnij',
  'shareUrl.invalidUrl': 'Wprowadź prawidłowy URL zaczynający się od http:// lub https://',

  // Resync
  'settings.resyncBtn': 'Resynchronizuj',

  // Version compatibility
  'version.companionUpdateRequired': 'Wymagana aktualizacja aplikacji',
  'version.companionUpdateDesc': 'Aplikacja FossLink na telefonie (v{peerVersion}) nie jest kompatybilna z tą wersją FossLink Desktop (v{desktopVersion}). Zaktualizuj aplikację.',
  'version.desktopUpdateRequired': 'Wymagana aktualizacja pulpitu',
  'version.desktopUpdateDesc': 'Ta wersja FossLink Desktop (v{desktopVersion}) nie jest kompatybilna z aplikacją FossLink na telefonie (v{peerVersion}). Zaktualizuj FossLink Desktop.',
  'version.updateCompanion': 'Zaktualizuj aplikację',
  'version.downloadUpdate': 'Pobierz aktualizację',
  'version.orScanQR': 'Lub zeskanuj ten kod QR na telefonie, aby pobrać najnowszą wersję:',
  'version.sentToPhone': 'Żądanie aktualizacji wysłane na telefon',

  // Storage analyzer
  'storage.title': 'Analizator pamięci',
  'storage.analyzing': 'Analizowanie pamięci telefonu...',
  'storage.analyzeBtn': 'Analizuj pamięć',
  'storage.close': 'Zamknij',
  'storage.free': '{free} GB wolne z {total} GB',
  'storage.error': 'Analiza pamięci nie powiodła się',
  'storage.noRoot': 'Włącz integrację Root na telefonie, aby uzyskać szczegółową analizę.',

  // Extras section
  'extras.title': 'Dodatki',
  'extras.storageTitle': 'Eksplorator pamięci',
  'extras.storageSubtitle': 'Analizuj wykorzystanie pamięci',
  'extras.filesTitle': 'Pliki telefonu',
  'extras.filesSubtitle': 'Przeglądaj system plików',
  'extras.filesMounted': 'Zamontowany',
  'extras.migrationTitle': 'Migracja kontaktów',
  'extras.migrationSubtitle': 'Przenieś kontakty do Google',

  // Contact migration
  'migration.title': 'Migracja kontaktów',
  'migration.intro': 'Znajdź kontakty zapisane na urządzeniu lub karcie SIM, które nie są kopią zapasową w Google Contacts, i przenieś je.',
  'migration.scanBtn': 'Skanuj kontakty urządzenia',
  'migration.scanning': 'Skanowanie kontaktów na telefonie...',
  'migration.found': 'Znaleziono {count} kontaktów tylko na urządzeniu',
  'migration.migrateTo': 'Migruj do: {account}',
  'migration.noGoogle': 'Nie znaleziono konta Google na telefonie.',
  'migration.selectAll': 'Zaznacz wszystkie ({count})',
  'migration.migrateBtn': 'Migruj {count} kontaktów do Google',
  'migration.migrating': 'Migrowanie kontaktów...',
  'migration.success': '{count} kontaktów pomyślnie zmigrowanych.',
  'migration.failed': '{count} kontaktów nie powiodło się.',
  'migration.allGood': 'Wszystkie kontakty są już zapisane w Google.',
  'migration.done': 'Gotowe',
  'migration.retry': 'Ponów',

  // Gallery
  'app.gallery': 'Galeria telefonu',
  'gallery.title': 'Galeria telefonu',
  'gallery.close': 'Zamknij galerię',
  'gallery.viewDcim': 'DCIM',
  'gallery.viewScreenshots': 'Zrzuty ekranu',
  'gallery.viewFolders': 'Foldery',
  'gallery.viewAll': 'Wszystkie',
  'gallery.sizeSmall': 'Małe miniatury',
  'gallery.sizeLarge': 'Duże miniatury',
  'gallery.toggleHidden': 'Pokaż/ukryj ukryte pliki',
  'gallery.scanning': 'Skanowanie galerii telefonu...',
  'gallery.retry': 'Ponów',
  'gallery.empty': 'Nie znaleziono mediów',
  'gallery.noFolders': 'Nie znaleziono folderów',

  // Notification
  'notification.newMessage': 'Otrzymano nową wiadomość',

  // Time formatting
  'time.today': 'Dzisiaj',
  'time.yesterday': 'Wczoraj',
}

export default pl
