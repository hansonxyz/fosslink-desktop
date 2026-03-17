/** French translations */
export const fr: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'À propos de FossLink',
  'app.newMessage': 'Nouveau message',
  'app.findPhone': 'Trouver mon téléphone',
  'app.syncMessages': 'Synchroniser les messages',
  'app.settings': 'Paramètres',
  'app.sidebarPlaceholder': 'Connectez un appareil pour voir les conversations',
  'app.sidebarPlaceholderAlt': 'Les conversations apparaîtront ici',
  'app.emptyState': 'Sélectionnez une conversation pour commencer à écrire',

  // Status indicator
  'status.noDaemon': 'Le daemon ne fonctionne pas',
  'status.disconnected': 'Aucun appareil connecté',
  'status.discovering': 'Recherche d\'appareils...',
  'status.pairing': 'Appairage...',
  'status.connected': 'Appareil connecté',
  'status.syncing': 'Synchronisation...',
  'status.ready': 'Prêt',
  'status.error': 'Erreur',

  // Pairing page
  'pairing.starting': 'Démarrage...',
  'pairing.initializing': 'Initialisation de FossLink',
  'pairing.incomingRequest': 'Demande d\'appairage entrante',
  'pairing.wantsToPair': '{device} souhaite s\'appairer',
  'pairing.verifyHint': 'Vérifiez que le code correspond sur votre téléphone avant d\'accepter',
  'pairing.accept': 'Accepter',
  'pairing.reject': 'Refuser',
  'pairing.title': 'Appairage',
  'pairing.confirmCode': 'Confirmez que ce code correspond sur votre téléphone',
  'pairing.connectionError': 'Erreur de connexion',
  'pairing.unexpectedError': 'Une erreur inattendue est survenue',
  'pairing.autoRecover': 'Le daemon va tenter de se rétablir automatiquement',
  'pairing.connectTitle': 'Connectez votre téléphone',
  'pairing.searching': 'Recherche d\'appareils...',
  'pairing.dontSeePhone': 'Vous ne voyez pas votre téléphone ?',
  'pairing.installApp': 'Installez l\'',
  'pairing.companionApp': 'application compagnon FossLink',
  'pairing.sameWifi': 'et connectez-vous au même réseau Wi-Fi.',
  'pairing.getStarted': 'Premiers pas avec FossLink',
  'pairing.installDescription': 'Installez l\'application compagnon FossLink sur votre téléphone Android pour synchroniser vos messages, contacts et notifications avec votre ordinateur.',
  'pairing.qrAlt': 'Code QR pour télécharger l\'application compagnon FossLink',
  'pairing.downloadApp': 'Télécharger l\'application compagnon',
  'pairing.step1': 'Installez l\'application FossLink sur votre téléphone',
  'pairing.step2': 'Ouvrez l\'application et vérifiez que vous êtes sur le même réseau Wi-Fi',
  'pairing.step3': 'Votre téléphone apparaîtra ici automatiquement',
  'pairing.dismiss': 'Fermer',

  // Device list
  'devices.pairedDevices': 'Appareils appairés',
  'devices.offline': 'Hors ligne',
  'devices.unpair': 'Désappairer',
  'devices.nearbyDevices': 'Appareils à proximité',
  'devices.pair': 'Appairer',
  'devices.noDevices': 'Aucun appareil trouvé à proximité',

  // Conversations
  'conversations.loading': 'Chargement des conversations...',
  'conversations.noMatch': 'Aucune conversation ne correspond à votre recherche',
  'conversations.empty': 'Aucune conversation pour le moment',

  // Search bar
  'search.placeholder': 'Rechercher des conversations...',
  'search.clear': 'Effacer la recherche',
  'search.showUnread': 'Non lus uniquement',
  'search.showAll': 'Toutes les conversations',
  'search.filterSpam': 'Filtrer spam/inconnus',

  // Message thread
  'messages.loading': 'Chargement des messages...',
  'messages.empty': 'Aucun message dans cette conversation',
  'messages.sending': 'Envoi...',
  'messages.sent': 'Envoyé',
  'messages.failed': 'Échec de l\'envoi',
  'messages.retry': 'Réessayer',
  'messages.cancel': 'Annuler',
  'messages.compose': 'Saisissez un message...',
  'messages.send': 'Envoyer le message',
  'messages.emoji': 'Emoji',
  'messages.attach': 'Joindre un fichier',
  'messages.removeAttachment': 'Supprimer la pièce jointe',
  'messages.attachmentTooLarge': 'La taille totale dépasse la limite MMS. Le message peut échouer.',
  'messages.attachmentTooMany': 'Maximum 10 pièces jointes autorisées',

  // Export
  'export.tooltip': 'Exporter la conversation',
  'export.txt': 'Exporter en TXT',
  'export.csv': 'Exporter en CSV',
  'export.csvHeader': 'Date,De,Corps',
  'export.me': 'Moi',

  // Message bubble
  'bubble.saveAttachment': 'Enregistrer la pièce jointe',
  'bubble.mmsAlt': 'Pièce jointe MMS',
  'bubble.videoAlt': 'Vidéo',
  'bubble.failedToLoad': 'Échec du chargement',
  'bubble.copyCode': 'Copier {code}',
  'bubble.codeCopied': '{code} copié dans le presse-papiers',

  // New conversation
  'newMessage.to': 'À :',
  'newMessage.changeRecipient': 'Changer de destinataire',
  'newMessage.startNew': 'Démarrer une nouvelle conversation',
  'newMessage.enterContact': 'Saisissez un nom de contact ou un numéro de téléphone ci-dessus',

  // Contact autocomplete
  'contacts.placeholder': 'Saisissez un nom ou un numéro de téléphone...',

  // Settings panel
  'settings.title': 'Paramètres',
  'settings.close': 'Fermer les paramètres',
  'settings.connection': 'Connexion',
  'settings.status': 'État',
  'settings.device': 'Appareil',
  'settings.waitingDevice': 'En attente d\'un appareil...',
  'settings.ipAddress': 'Adresse IP',
  'settings.type': 'Type',
  'settings.service': 'Service',
  'settings.storage': 'Stockage libre',
  'settings.statusConnected': 'Connecté',
  'settings.statusReconnecting': 'Reconnexion',
  'settings.statusDisconnected': 'Déconnecté',
  'settings.notifications': 'Notifications',
  'settings.desktopNotifications': 'Notifications de bureau',
  'settings.flashTaskbar': 'Clignoter la barre des tâches pour un nouveau message',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.linkPreviews': 'Afficher les aperçus de liens',

  // Language
  'settings.language': 'Langue',
  'settings.languageAuto': 'Automatique (détecter depuis le système)',

  // Theme
  'settings.theme': 'Thème',

  // Updates
  'updates.title': 'Mises à jour',
  'updates.version': 'Version',
  'updates.checkAuto': 'Vérifier automatiquement',
  'updates.checking': 'Recherche de mises à jour...',
  'updates.available': 'Version {version} disponible',
  'updates.upToDate': 'Vous êtes à jour',
  'updates.downloading': 'Téléchargement... {percent}%',
  'updates.ready': 'Version {version} prête à installer',
  'updates.error': 'Erreur de mise à jour : {message}',
  'updates.checkBtn': 'Rechercher des mises à jour',
  'updates.checkingBtn': 'Recherche...',
  'updates.viewOnGithub': 'Voir la mise à jour sur GitHub',
  'updates.restartBtn': 'Redémarrer pour mettre à jour',

  // Update banner
  'banner.ready': 'La version {version} est prête à installer.',
  'banner.restart': 'Redémarrer pour mettre à jour',
  'banner.later': 'Plus tard',

  // Device settings section
  'settings.deviceSection': 'Appareil',
  'settings.unpairConfirm': 'Désappairer de {device} ? Vous devrez vous appairer à nouveau pour utiliser FossLink.',
  'settings.unpairBtn': 'Désappairer',
  'settings.unpairing': 'Désappairage...',
  'settings.cancelBtn': 'Annuler',
  'settings.unpairDevice': 'Désappairer l\'appareil',
  'settings.aboutBtn': 'À propos de FossLink',

  // Find my phone
  'findPhone.close': 'Fermer',
  'findPhone.title': 'Trouver mon téléphone',
  'findPhone.description': 'Cela fera sonner votre téléphone au volume maximum, même s\'il est en silencieux.',
  'findPhone.ring': 'Faire sonner',
  'findPhone.ringing': 'Sonnerie...',
  'findPhone.ringingDesc': 'Votre téléphone devrait sonner maintenant.',
  'findPhone.ringAgain': 'Sonner à nouveau',
  'findPhone.errorTitle': 'Impossible de faire sonner le téléphone',
  'findPhone.tryAgain': 'Réessayer',

  // About dialog
  'about.close': 'Fermer',
  'about.name': 'FossLink',
  'about.version': 'Version 1.0.0',
  'about.credit': '2026 par Brian Hanson',
  'about.releasedUnder': 'Publié sous la',
  'about.mitLicense': 'Licence MIT',
  'about.acknowledgments': 'Remerciements',
  'about.ffmpegDesc': 'transcodage vidéo et génération de miniatures',
  'about.electronDesc': 'framework de bureau multiplateforme',
  'about.svelteDesc': 'framework d\'interface réactif',
  'about.sourceAvailable': 'Licence complète et code source disponibles sur',
  'about.androidApp': 'Get the Android companion app on',
  'about.googlePlay': 'Google Play',
  'about.tagline': 'Ce logiciel a été créé dans l\'esprit du logiciel libre, dans l\'espoir de vous rendre la vie un peu plus facile.',

  // Dial confirmation
  'dial.confirm': 'Appeler {number} sur votre téléphone ?',
  'dial.ok': 'OK',
  'dial.cancel': 'Annuler',
  'dial.callBtn': 'Appeler',

  // URL sharing
  'app.shareUrl': 'Ouvrir l\'URL sur le téléphone',
  'shareUrl.title': 'Ouvrir l\'URL sur le téléphone',
  'shareUrl.placeholder': 'https://...',
  'shareUrl.cancel': 'Annuler',
  'shareUrl.share': 'Partager',
  'shareUrl.invalidUrl': 'Entrez une URL valide commençant par http:// ou https://',

  // Resync
  'settings.resyncBtn': 'Resynchroniser',

  // Version compatibility
  'version.companionUpdateRequired': 'Mise à jour de l\'application requise',
  'version.companionUpdateDesc': 'L\'application FossLink de votre téléphone (v{peerVersion}) n\'est pas compatible avec cette version de FossLink Desktop (v{desktopVersion}). Veuillez mettre à jour l\'application.',
  'version.desktopUpdateRequired': 'Mise à jour du bureau requise',
  'version.desktopUpdateDesc': 'Cette version de FossLink Desktop (v{desktopVersion}) n\'est pas compatible avec l\'application FossLink de votre téléphone (v{peerVersion}). Veuillez mettre à jour FossLink Desktop.',
  'version.updateCompanion': 'Mettre à jour l\'application',
  'version.downloadUpdate': 'Télécharger la mise à jour',
  'version.orScanQR': 'Ou scannez ce code QR sur votre téléphone pour télécharger la dernière version :',
  'version.sentToPhone': 'Demande de mise à jour envoyée au téléphone',

  // Storage analyzer
  'storage.title': 'Analyseur de stockage',
  'storage.analyzing': 'Analyse du stockage du téléphone...',
  'storage.analyzeBtn': 'Analyser le stockage',
  'storage.close': 'Fermer',
  'storage.free': '{free} Go libres sur {total} Go',
  'storage.error': 'Échec de l\'analyse du stockage',
  'storage.noRoot': 'Activez l\'intégration root sur votre téléphone pour une analyse détaillée.',

  // Extras section
  'extras.title': 'Extras',
  'extras.storageTitle': 'Explorateur de stockage',
  'extras.storageSubtitle': 'Analyser l\'utilisation du stockage',
  'extras.filesTitle': 'Fichiers du téléphone',
  'extras.filesSubtitle': 'Parcourir le système de fichiers',
  'extras.filesMounted': 'Monté',
  'extras.migrationTitle': 'Migration des contacts',
  'extras.migrationSubtitle': 'Déplacer les contacts vers Google',

  // Contact migration
  'migration.title': 'Migration des contacts',
  'migration.intro': 'Trouvez les contacts stockés sur votre appareil ou SIM qui ne sont pas sauvegardés dans Google Contacts, et migrez-les.',
  'migration.scanBtn': 'Rechercher les contacts de l\'appareil',
  'migration.scanning': 'Analyse des contacts sur le téléphone...',
  'migration.found': '{count} contacts trouvés uniquement sur l\'appareil',
  'migration.migrateTo': 'Migrer vers : {account}',
  'migration.noGoogle': 'Aucun compte Google trouvé sur le téléphone.',
  'migration.selectAll': 'Tout sélectionner ({count})',
  'migration.migrateBtn': 'Migrer {count} contacts vers Google',
  'migration.migrating': 'Migration des contacts...',
  'migration.success': '{count} contacts migrés avec succès.',
  'migration.failed': '{count} contacts ont échoué.',
  'migration.allGood': 'Tous les contacts sont déjà sauvegardés dans Google.',
  'migration.done': 'Terminé',
  'migration.retry': 'Réessayer',

  // Gallery
  'app.gallery': 'Galerie du téléphone',
  'gallery.title': 'Galerie du téléphone',
  'gallery.close': 'Fermer la galerie',
  'gallery.viewDcim': 'DCIM',
  'gallery.viewScreenshots': 'Captures',
  'gallery.viewFolders': 'Dossiers',
  'gallery.viewAll': 'Tout',
  'gallery.sizeSmall': 'Petites miniatures',
  'gallery.sizeLarge': 'Grandes miniatures',
  'gallery.toggleHidden': 'Basculer les fichiers cachés',
  'gallery.scanning': 'Analyse de la galerie du téléphone...',
  'gallery.retry': 'Réessayer',
  'gallery.empty': 'Aucun média trouvé',
  'gallery.noFolders': 'Aucun dossier trouvé',

  // Notification
  'notification.newMessage': 'Nouveau message reçu',

  // Time formatting
  'time.today': 'Aujourd\'hui',
  'time.yesterday': 'Hier',
}

export default fr
