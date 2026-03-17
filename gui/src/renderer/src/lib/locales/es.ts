/** Spanish translations */
export const es: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'Acerca de FossLink',
  'app.newMessage': 'Nuevo mensaje',
  'app.findPhone': 'Encontrar mi teléfono',
  'app.syncMessages': 'Sincronizar mensajes',
  'app.settings': 'Ajustes',
  'app.sidebarPlaceholder': 'Conecta un dispositivo para ver las conversaciones',
  'app.sidebarPlaceholderAlt': 'Las conversaciones aparecerán aquí',
  'app.emptyState': 'Selecciona una conversación para empezar a escribir',

  // Status indicator
  'status.noDaemon': 'El daemon no está en ejecución',
  'status.disconnected': 'Ningún dispositivo conectado',
  'status.discovering': 'Buscando dispositivos...',
  'status.pairing': 'Emparejando...',
  'status.connected': 'Dispositivo conectado',
  'status.syncing': 'Sincronizando...',
  'status.ready': 'Listo',
  'status.error': 'Error',

  // Pairing page
  'pairing.starting': 'Iniciando...',
  'pairing.initializing': 'Iniciando FossLink',
  'pairing.incomingRequest': 'Solicitud de emparejamiento entrante',
  'pairing.wantsToPair': '{device} quiere emparejarse',
  'pairing.verifyHint': 'Verifica que el código coincida en tu teléfono antes de aceptar',
  'pairing.accept': 'Aceptar',
  'pairing.reject': 'Rechazar',
  'pairing.title': 'Emparejamiento',
  'pairing.confirmCode': 'Confirma que este código coincide en tu teléfono',
  'pairing.connectionError': 'Error de conexión',
  'pairing.unexpectedError': 'Ocurrió un error inesperado',
  'pairing.autoRecover': 'El daemon intentará recuperarse automáticamente',
  'pairing.connectTitle': 'Conecta tu teléfono',
  'pairing.searching': 'Buscando dispositivos...',
  'pairing.dontSeePhone': '¿No ves tu teléfono?',
  'pairing.installApp': 'Instala la',
  'pairing.companionApp': 'app complementaria de FossLink',
  'pairing.sameWifi': 'y conéctate a la misma red Wi-Fi.',
  'pairing.getStarted': 'Empieza con FossLink',
  'pairing.installDescription': 'Instala la app complementaria de FossLink en tu teléfono Android para sincronizar tus mensajes, contactos y notificaciones con tu computadora.',
  'pairing.qrAlt': 'Código QR para descargar la app complementaria de FossLink',
  'pairing.downloadApp': 'Descargar App Complementaria',
  'pairing.step1': 'Instala la app FossLink en tu teléfono',
  'pairing.step2': 'Abre la app y asegúrate de estar en la misma red Wi-Fi',
  'pairing.step3': 'Tu teléfono aparecerá aquí automáticamente',
  'pairing.dismiss': 'Cerrar',

  // Device list
  'devices.pairedDevices': 'Dispositivos emparejados',
  'devices.offline': 'Sin conexión',
  'devices.unpair': 'Desemparejar',
  'devices.nearbyDevices': 'Dispositivos cercanos',
  'devices.pair': 'Emparejar',
  'devices.noDevices': 'No se encontraron dispositivos cercanos',

  // Conversations
  'conversations.loading': 'Cargando conversaciones...',
  'conversations.noMatch': 'Ninguna conversación coincide con tu búsqueda',
  'conversations.empty': 'Aún no hay conversaciones',

  // Search bar
  'search.placeholder': 'Buscar conversaciones...',
  'search.clear': 'Borrar búsqueda',
  'search.showUnread': 'Solo no leídos',
  'search.showAll': 'Todas las conversaciones',
  'search.filterSpam': 'Filtrar spam/desconocidos',

  // Message thread
  'messages.loading': 'Cargando mensajes...',
  'messages.empty': 'No hay mensajes en esta conversación',
  'messages.sending': 'Enviando...',
  'messages.sent': 'Enviado',
  'messages.failed': 'Error al enviar',
  'messages.retry': 'Reintentar',
  'messages.cancel': 'Cancelar',
  'messages.compose': 'Escribe un mensaje...',
  'messages.send': 'Enviar mensaje',
  'messages.emoji': 'Emoji',
  'messages.attach': 'Adjuntar archivo',
  'messages.removeAttachment': 'Eliminar adjunto',
  'messages.attachmentTooLarge': 'El tamaño total supera el límite MMS. El mensaje puede fallar.',
  'messages.attachmentTooMany': 'Máximo 10 adjuntos permitidos',

  // Export
  'export.tooltip': 'Exportar conversación',
  'export.txt': 'Exportar como TXT',
  'export.csv': 'Exportar como CSV',
  'export.csvHeader': 'Fecha,De,Cuerpo',
  'export.me': 'Yo',

  // Message bubble
  'bubble.saveAttachment': 'Guardar adjunto',
  'bubble.mmsAlt': 'Adjunto MMS',
  'bubble.videoAlt': 'Vídeo',
  'bubble.failedToLoad': 'Error al cargar',
  'bubble.copyCode': 'Copiar {code}',
  'bubble.codeCopied': '{code} copiado al portapapeles',

  // New conversation
  'newMessage.to': 'Para:',
  'newMessage.changeRecipient': 'Cambiar destinatario',
  'newMessage.startNew': 'Iniciar una nueva conversación',
  'newMessage.enterContact': 'Escribe un nombre de contacto o número de teléfono arriba',

  // Contact autocomplete
  'contacts.placeholder': 'Escribe un nombre o número de teléfono...',

  // Settings panel
  'settings.title': 'Ajustes',
  'settings.close': 'Cerrar ajustes',
  'settings.connection': 'Conexión',
  'settings.status': 'Estado',
  'settings.device': 'Dispositivo',
  'settings.waitingDevice': 'Esperando dispositivo...',
  'settings.ipAddress': 'Dirección IP',
  'settings.type': 'Tipo',
  'settings.service': 'Servicio',
  'settings.storage': 'Almacenamiento libre',
  'settings.statusConnected': 'Conectado',
  'settings.statusReconnecting': 'Reconectando',
  'settings.statusDisconnected': 'Desconectado',
  'settings.notifications': 'Notificaciones',
  'settings.desktopNotifications': 'Notificaciones de escritorio',
  'settings.flashTaskbar': 'Parpadear barra de tareas con mensaje nuevo',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.linkPreviews': 'Mostrar vista previa de enlaces',

  // Language
  'settings.language': 'Idioma',
  'settings.languageAuto': 'Automático (detectar del sistema)',

  // Theme
  'settings.theme': 'Tema',

  // Updates
  'updates.title': 'Actualizaciones',
  'updates.version': 'Versión',
  'updates.checkAuto': 'Comprobar automáticamente',
  'updates.checking': 'Buscando actualizaciones...',
  'updates.available': 'Versión {version} disponible',
  'updates.upToDate': 'Estás al día',
  'updates.downloading': 'Descargando... {percent}%',
  'updates.ready': 'Versión {version} lista para instalar',
  'updates.error': 'Error de actualización: {message}',
  'updates.checkBtn': 'Buscar actualizaciones',
  'updates.checkingBtn': 'Buscando...',
  'updates.viewOnGithub': 'Ver actualización en GitHub',
  'updates.restartBtn': 'Reiniciar para actualizar',

  // Update banner
  'banner.ready': 'La versión {version} está lista para instalar.',
  'banner.restart': 'Reiniciar para actualizar',
  'banner.later': 'Más tarde',

  // Device settings section
  'settings.deviceSection': 'Dispositivo',
  'settings.unpairConfirm': '¿Desemparejar de {device}? Tendrás que emparejarte de nuevo para usar FossLink.',
  'settings.unpairBtn': 'Desemparejar',
  'settings.unpairing': 'Desemparejando...',
  'settings.cancelBtn': 'Cancelar',
  'settings.unpairDevice': 'Desemparejar dispositivo',
  'settings.aboutBtn': 'Acerca de FossLink',

  // Find my phone
  'findPhone.close': 'Cerrar',
  'findPhone.title': 'Encontrar mi teléfono',
  'findPhone.description': 'Esto hará que tu teléfono suene a máximo volumen, incluso si está en silencio.',
  'findPhone.ring': 'Hacer sonar',
  'findPhone.ringing': 'Sonando...',
  'findPhone.ringingDesc': 'Tu teléfono debería estar sonando ahora.',
  'findPhone.ringAgain': 'Sonar de nuevo',
  'findPhone.errorTitle': 'No se pudo hacer sonar el teléfono',
  'findPhone.tryAgain': 'Intentar de nuevo',

  // About dialog
  'about.close': 'Cerrar',
  'about.name': 'FossLink',
  'about.version': 'Version 1.0.0',
  'about.credit': '2026 por Brian Hanson',
  'about.releasedUnder': 'Publicado bajo la',
  'about.mitLicense': 'Licencia MIT',
  'about.acknowledgments': 'Agradecimientos',
  'about.ffmpegDesc': 'transcodificación de vídeo y generación de miniaturas',
  'about.electronDesc': 'framework de escritorio multiplataforma',
  'about.svelteDesc': 'framework de UI reactivo',
  'about.sourceAvailable': 'Licencia completa y código fuente disponibles en',
  'about.androidApp': 'Get the Android companion app on',
  'about.googlePlay': 'Google Play',
  'about.tagline': 'Este software fue creado con el espíritu del código abierto, con la esperanza de hacer tu vida un poco más fácil.',

  // Dial confirmation
  'dial.confirm': '¿Llamar a {number} en tu teléfono?',
  'dial.ok': 'Aceptar',
  'dial.cancel': 'Cancelar',
  'dial.callBtn': 'Llamar',

  // URL sharing
  'app.shareUrl': 'Abrir URL en el teléfono',
  'shareUrl.title': 'Abrir URL en el teléfono',
  'shareUrl.placeholder': 'https://...',
  'shareUrl.cancel': 'Cancelar',
  'shareUrl.share': 'Compartir',
  'shareUrl.invalidUrl': 'Introduce una URL válida que comience con http:// o https://',

  // Resync
  'settings.resyncBtn': 'Resincronizar',

  // Version compatibility
  'version.companionUpdateRequired': 'Actualización de la app requerida',
  'version.companionUpdateDesc': 'La app FossLink de tu teléfono (v{peerVersion}) no es compatible con esta versión de FossLink Desktop (v{desktopVersion}). Por favor actualiza la app.',
  'version.desktopUpdateRequired': 'Actualización de escritorio requerida',
  'version.desktopUpdateDesc': 'Esta versión de FossLink Desktop (v{desktopVersion}) no es compatible con la app FossLink de tu teléfono (v{peerVersion}). Por favor actualiza FossLink Desktop.',
  'version.updateCompanion': 'Actualizar app',
  'version.downloadUpdate': 'Descargar actualización',
  'version.orScanQR': 'O escanea este código QR en tu teléfono para descargar la última versión:',
  'version.sentToPhone': 'Solicitud de actualización enviada al teléfono',
  'version.outdatedStatus': 'Outdated Software - Please Update',
  'version.companionOutdatedStatus': 'Companion App Outdated',
  'version.dismiss': 'Dismiss',

  // Storage analyzer
  'storage.title': 'Analizador de almacenamiento',
  'storage.analyzing': 'Analizando almacenamiento del teléfono...',
  'storage.analyzeBtn': 'Analizar almacenamiento',
  'storage.close': 'Cerrar',
  'storage.free': '{free} GB libres de {total} GB',
  'storage.error': 'Error en el análisis de almacenamiento',
  'storage.noRoot': 'Activa la integración root en tu teléfono para un desglose detallado.',

  // Extras section
  'extras.title': 'Extras',
  'extras.storageTitle': 'Explorador de almacenamiento',
  'extras.storageSubtitle': 'Analizar uso de almacenamiento',
  'extras.filesTitle': 'Archivos del teléfono',
  'extras.filesSubtitle': 'Explorar sistema de archivos',
  'extras.filesMounted': 'Montado',
  'extras.migrationTitle': 'Migración de contactos',
  'extras.migrationSubtitle': 'Mover contactos del dispositivo a Google',

  // Contact migration
  'migration.title': 'Migración de contactos',
  'migration.intro': 'Encuentra contactos almacenados en tu dispositivo o SIM que no están respaldados en Google Contacts y migrarlos.',
  'migration.scanBtn': 'Buscar contactos del dispositivo',
  'migration.scanning': 'Escaneando contactos en el teléfono...',
  'migration.found': '{count} contactos encontrados solo en el dispositivo',
  'migration.migrateTo': 'Migrar a: {account}',
  'migration.noGoogle': 'No se encontró cuenta de Google en el teléfono.',
  'migration.selectAll': 'Seleccionar todos ({count})',
  'migration.migrateBtn': 'Migrar {count} contactos a Google',
  'migration.migrating': 'Migrando contactos...',
  'migration.success': '{count} contactos migrados exitosamente.',
  'migration.failed': '{count} contactos fallaron.',
  'migration.allGood': 'Todos los contactos ya están respaldados en Google.',
  'migration.done': 'Listo',
  'migration.retry': 'Reintentar',

  // Gallery
  'app.gallery': 'Galería del teléfono',
  'gallery.title': 'Galería del teléfono',
  'gallery.close': 'Cerrar galería',
  'gallery.viewDcim': 'DCIM',
  'gallery.viewScreenshots': 'Capturas',
  'gallery.viewFolders': 'Carpetas',
  'gallery.viewAll': 'Todo',
  'gallery.sizeSmall': 'Miniaturas pequeñas',
  'gallery.sizeLarge': 'Miniaturas grandes',
  'gallery.toggleHidden': 'Alternar archivos ocultos',
  'gallery.scanning': 'Escaneando galería del teléfono...',
  'gallery.retry': 'Reintentar',
  'gallery.empty': 'No se encontraron medios',
  'gallery.noFolders': 'No se encontraron carpetas',

  // Notification
  'notification.newMessage': 'Nuevo mensaje recibido',

  // Time formatting
  'time.today': 'Hoy',
  'time.yesterday': 'Ayer',
}

export default es
