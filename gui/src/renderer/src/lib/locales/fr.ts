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
  'settings.statusConnected': 'Connecté',
  'settings.statusReconnecting': 'Reconnexion',
  'settings.statusDisconnected': 'Déconnecté',
  'settings.notifications': 'Notifications',
  'settings.desktopNotifications': 'Notifications de bureau',
  'settings.flashTaskbar': 'Clignoter la barre des tâches pour un nouveau message',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.language': 'Langue',
  'settings.languageAuto': 'Automatique (détecter depuis le système)',

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
  'about.version': 'Version 0.1',
  'about.credit': '2026 par Brian Hanson',
  'about.releasedUnder': 'Publié sous la',
  'about.mitLicense': 'Licence MIT',
  'about.acknowledgments': 'Remerciements',
  'about.ffmpegDesc': 'transcodage vidéo et génération de miniatures',
  'about.electronDesc': 'framework de bureau multiplateforme',
  'about.svelteDesc': 'framework d\'interface réactif',
  'about.sourceAvailable': 'Licence complète et code source disponibles sur',
  'about.tagline': 'Ce logiciel a été créé dans l\'esprit du logiciel libre, dans l\'espoir de vous rendre la vie un peu plus facile.',

  // Notification
  'notification.newMessage': 'Nouveau message reçu',

  // Time formatting
  'time.today': 'Aujourd\'hui',
  'time.yesterday': 'Hier',
}

export default fr
