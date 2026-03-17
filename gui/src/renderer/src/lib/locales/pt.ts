/** Brazilian Portuguese translations */
export const pt: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'Sobre o FossLink',
  'app.newMessage': 'Nova mensagem',
  'app.findPhone': 'Encontrar meu celular',
  'app.syncMessages': 'Sincronizar mensagens',
  'app.settings': 'Configurações',
  'app.sidebarPlaceholder': 'Conecte um dispositivo para ver as conversas',
  'app.sidebarPlaceholderAlt': 'As conversas aparecerão aqui',
  'app.emptyState': 'Selecione uma conversa para começar a escrever',

  // Status indicator
  'status.noDaemon': 'O daemon não está em execução',
  'status.disconnected': 'Nenhum dispositivo conectado',
  'status.discovering': 'Procurando dispositivos...',
  'status.pairing': 'Pareando...',
  'status.connected': 'Dispositivo conectado',
  'status.syncing': 'Sincronizando...',
  'status.ready': 'Pronto',
  'status.error': 'Erro',

  // Pairing page
  'pairing.starting': 'Iniciando...',
  'pairing.initializing': 'Iniciando o FossLink',
  'pairing.incomingRequest': 'Solicitação de pareamento recebida',
  'pairing.wantsToPair': '{device} quer parear',
  'pairing.verifyHint': 'Verifique se o código é igual no seu celular antes de aceitar',
  'pairing.accept': 'Aceitar',
  'pairing.reject': 'Rejeitar',
  'pairing.title': 'Pareamento',
  'pairing.confirmCode': 'Confirme que este código é o mesmo no seu celular',
  'pairing.connectionError': 'Erro de conexão',
  'pairing.unexpectedError': 'Ocorreu um erro inesperado',
  'pairing.autoRecover': 'O daemon tentará se recuperar automaticamente',
  'pairing.connectTitle': 'Conecte seu celular',
  'pairing.searching': 'Procurando dispositivos...',
  'pairing.dontSeePhone': 'Não encontra seu celular?',
  'pairing.installApp': 'Instale o',
  'pairing.companionApp': 'app complementar FossLink',
  'pairing.sameWifi': 'e conecte-se à mesma rede Wi-Fi.',
  'pairing.getStarted': 'Comece com o FossLink',
  'pairing.installDescription': 'Instale o app complementar FossLink no seu celular Android para sincronizar suas mensagens, contatos e notificações com o seu computador.',
  'pairing.qrAlt': 'Código QR para baixar o app complementar FossLink',
  'pairing.downloadApp': 'Baixar App Complementar',
  'pairing.step1': 'Instale o app FossLink no seu celular',
  'pairing.step2': 'Abra o app e certifique-se de que está na mesma rede Wi-Fi',
  'pairing.step3': 'Seu celular aparecerá aqui automaticamente',
  'pairing.dismiss': 'Fechar',

  // Device list
  'devices.pairedDevices': 'Dispositivos pareados',
  'devices.offline': 'Offline',
  'devices.unpair': 'Desparear',
  'devices.nearbyDevices': 'Dispositivos próximos',
  'devices.pair': 'Parear',
  'devices.noDevices': 'Nenhum dispositivo encontrado por perto',

  // Conversations
  'conversations.loading': 'Carregando conversas...',
  'conversations.noMatch': 'Nenhuma conversa corresponde à sua pesquisa',
  'conversations.empty': 'Nenhuma conversa ainda',

  // Search bar
  'search.placeholder': 'Pesquisar conversas...',
  'search.clear': 'Limpar pesquisa',
  'search.showUnread': 'Apenas não lidas',
  'search.showAll': 'Todas as conversas',
  'search.filterSpam': 'Filtrar spam/desconhecidos',

  // Message thread
  'messages.loading': 'Carregando mensagens...',
  'messages.empty': 'Nenhuma mensagem nesta conversa',
  'messages.sending': 'Enviando...',
  'messages.sent': 'Enviada',
  'messages.failed': 'Falha ao enviar',
  'messages.retry': 'Tentar novamente',
  'messages.cancel': 'Cancelar',
  'messages.compose': 'Digite uma mensagem...',
  'messages.send': 'Enviar mensagem',
  'messages.emoji': 'Emoji',
  'messages.attach': 'Anexar arquivo',
  'messages.removeAttachment': 'Remover anexo',
  'messages.attachmentTooLarge': 'O tamanho total excede o limite MMS. A mensagem pode falhar.',
  'messages.attachmentTooMany': 'Máximo de 10 anexos permitidos',

  // Export
  'export.tooltip': 'Exportar conversa',
  'export.txt': 'Exportar como TXT',
  'export.csv': 'Exportar como CSV',
  'export.csvHeader': 'Data,De,Corpo',
  'export.me': 'Eu',

  // Message bubble
  'bubble.saveAttachment': 'Salvar anexo',
  'bubble.mmsAlt': 'Anexo MMS',
  'bubble.videoAlt': 'Vídeo',
  'bubble.failedToLoad': 'Falha ao carregar',
  'bubble.copyCode': 'Copiar {code}',
  'bubble.codeCopied': '{code} copiado para a área de transferência',

  // New conversation
  'newMessage.to': 'Para:',
  'newMessage.changeRecipient': 'Alterar destinatário',
  'newMessage.startNew': 'Iniciar uma nova conversa',
  'newMessage.enterContact': 'Digite um nome de contato ou número de telefone acima',

  // Contact autocomplete
  'contacts.placeholder': 'Digite um nome ou número de telefone...',

  // Settings panel
  'settings.title': 'Configurações',
  'settings.close': 'Fechar configurações',
  'settings.connection': 'Conexão',
  'settings.status': 'Status',
  'settings.device': 'Dispositivo',
  'settings.waitingDevice': 'Aguardando dispositivo...',
  'settings.ipAddress': 'Endereço IP',
  'settings.type': 'Tipo',
  'settings.service': 'Serviço',
  'settings.storage': 'Armazenamento livre',
  'settings.statusConnected': 'Conectado',
  'settings.statusReconnecting': 'Reconectando',
  'settings.statusDisconnected': 'Desconectado',
  'settings.notifications': 'Notificações',
  'settings.desktopNotifications': 'Notificações na área de trabalho',
  'settings.flashTaskbar': 'Piscar barra de tarefas ao receber mensagem',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.linkPreviews': 'Mostrar pré-visualização de links',

  // Language
  'settings.language': 'Idioma',
  'settings.languageAuto': 'Automático (detectar do sistema)',

  // Theme
  'settings.theme': 'Tema',

  // Updates
  'updates.title': 'Atualizações',
  'updates.version': 'Versão',
  'updates.checkAuto': 'Verificar automaticamente',
  'updates.checking': 'Verificando atualizações...',
  'updates.available': 'Versão {version} disponível',
  'updates.upToDate': 'Você está atualizado',
  'updates.downloading': 'Baixando... {percent}%',
  'updates.ready': 'Versão {version} pronta para instalar',
  'updates.error': 'Erro de atualização: {message}',
  'updates.checkBtn': 'Verificar atualizações',
  'updates.checkingBtn': 'Verificando...',
  'updates.viewOnGithub': 'Ver atualização no GitHub',
  'updates.restartBtn': 'Reiniciar para atualizar',

  // Update banner
  'banner.ready': 'A versão {version} está pronta para instalar.',
  'banner.restart': 'Reiniciar para atualizar',
  'banner.later': 'Mais tarde',

  // Device settings section
  'settings.deviceSection': 'Dispositivo',
  'settings.unpairConfirm': 'Desparear de {device}? Você precisará parear novamente para usar o FossLink.',
  'settings.unpairBtn': 'Desparear',
  'settings.unpairing': 'Despareando...',
  'settings.cancelBtn': 'Cancelar',
  'settings.unpairDevice': 'Desparear dispositivo',
  'settings.aboutBtn': 'Sobre o FossLink',

  // Find my phone
  'findPhone.close': 'Fechar',
  'findPhone.title': 'Encontrar meu celular',
  'findPhone.description': 'Isso fará seu celular tocar no volume máximo, mesmo que esteja no silencioso.',
  'findPhone.ring': 'Tocar celular',
  'findPhone.ringing': 'Tocando...',
  'findPhone.ringingDesc': 'Seu celular deve estar tocando agora.',
  'findPhone.ringAgain': 'Tocar novamente',
  'findPhone.errorTitle': 'Não foi possível tocar o celular',
  'findPhone.tryAgain': 'Tentar novamente',

  // About dialog
  'about.close': 'Fechar',
  'about.name': 'FossLink',
  'about.version': 'Version 1.0.0',
  'about.credit': '2026 por Brian Hanson',
  'about.releasedUnder': 'Publicado sob a',
  'about.mitLicense': 'Licença MIT',
  'about.acknowledgments': 'Agradecimentos',
  'about.ffmpegDesc': 'transcodificação de vídeo e geração de miniaturas',
  'about.electronDesc': 'framework de desktop multiplataforma',
  'about.svelteDesc': 'framework de UI reativo',
  'about.sourceAvailable': 'Licença completa e código-fonte disponíveis em',
  'about.androidApp': 'Get the Android companion app on',
  'about.googlePlay': 'Google Play',
  'about.tagline': 'Este software foi criado no espírito do código aberto, na esperança de tornar sua vida um pouco mais fácil.',

  // Dial confirmation
  'dial.confirm': 'Ligar para {number} no seu telefone?',
  'dial.ok': 'OK',
  'dial.cancel': 'Cancelar',
  'dial.callBtn': 'Ligar',

  // URL sharing
  'app.shareUrl': 'Abrir URL no telefone',
  'shareUrl.title': 'Abrir URL no telefone',
  'shareUrl.placeholder': 'https://...',
  'shareUrl.cancel': 'Cancelar',
  'shareUrl.share': 'Compartilhar',
  'shareUrl.invalidUrl': 'Digite uma URL válida começando com http:// ou https://',

  // Resync
  'settings.resyncBtn': 'Ressincronizar',

  // Version compatibility
  'version.companionUpdateRequired': 'Atualização do aplicativo necessária',
  'version.companionUpdateDesc': 'O aplicativo FossLink do seu telefone (v{peerVersion}) não é compatível com esta versão do FossLink Desktop (v{desktopVersion}). Por favor, atualize o aplicativo.',
  'version.desktopUpdateRequired': 'Atualização do desktop necessária',
  'version.desktopUpdateDesc': 'Esta versão do FossLink Desktop (v{desktopVersion}) não é compatível com o aplicativo FossLink do seu telefone (v{peerVersion}). Por favor, atualize o FossLink Desktop.',
  'version.updateCompanion': 'Atualizar aplicativo',
  'version.downloadUpdate': 'Baixar atualização',
  'version.orScanQR': 'Ou escaneie este código QR no seu telefone para baixar a versão mais recente:',
  'version.sentToPhone': 'Solicitação de atualização enviada ao telefone',
  'version.outdatedStatus': 'Outdated Software - Please Update',
  'version.companionOutdatedStatus': 'Companion App Outdated',
  'version.dismiss': 'Dismiss',

  // Storage analyzer
  'storage.title': 'Analisador de armazenamento',
  'storage.analyzing': 'Analisando armazenamento do telefone...',
  'storage.analyzeBtn': 'Analisar armazenamento',
  'storage.close': 'Fechar',
  'storage.free': '{free} GB livres de {total} GB',
  'storage.error': 'Falha na análise de armazenamento',
  'storage.noRoot': 'Ative a integração root no seu telefone para uma análise detalhada.',

  // Extras section
  'extras.title': 'Extras',
  'extras.storageTitle': 'Explorador de armazenamento',
  'extras.storageSubtitle': 'Analisar uso de armazenamento',
  'extras.filesTitle': 'Arquivos do telefone',
  'extras.filesSubtitle': 'Navegar pelo sistema de arquivos',
  'extras.filesMounted': 'Montado',
  'extras.migrationTitle': 'Migração de contatos',
  'extras.migrationSubtitle': 'Mover contatos do dispositivo para Google',

  // Contact migration
  'migration.title': 'Migração de contatos',
  'migration.intro': 'Encontre contatos armazenados no seu dispositivo ou SIM que não estão salvos no Google Contacts e migre-os.',
  'migration.scanBtn': 'Buscar contatos do dispositivo',
  'migration.scanning': 'Escaneando contatos no telefone...',
  'migration.found': '{count} contatos encontrados apenas no dispositivo',
  'migration.migrateTo': 'Migrar para: {account}',
  'migration.noGoogle': 'Nenhuma conta Google encontrada no telefone.',
  'migration.selectAll': 'Selecionar todos ({count})',
  'migration.migrateBtn': 'Migrar {count} contatos para Google',
  'migration.migrating': 'Migrando contatos...',
  'migration.success': '{count} contatos migrados com sucesso.',
  'migration.failed': '{count} contatos falharam.',
  'migration.allGood': 'Todos os contatos já estão salvos no Google.',
  'migration.done': 'Concluído',
  'migration.retry': 'Tentar novamente',

  // Gallery
  'app.gallery': 'Galeria do telefone',
  'gallery.title': 'Galeria do telefone',
  'gallery.close': 'Fechar galeria',
  'gallery.viewDcim': 'DCIM',
  'gallery.viewScreenshots': 'Capturas',
  'gallery.viewFolders': 'Pastas',
  'gallery.viewAll': 'Tudo',
  'gallery.sizeSmall': 'Miniaturas pequenas',
  'gallery.sizeLarge': 'Miniaturas grandes',
  'gallery.toggleHidden': 'Alternar arquivos ocultos',
  'gallery.scanning': 'Escaneando galeria do telefone...',
  'gallery.retry': 'Tentar novamente',
  'gallery.empty': 'Nenhuma mídia encontrada',
  'gallery.noFolders': 'Nenhuma pasta encontrada',

  // Notification
  'notification.newMessage': 'Nova mensagem recebida',

  // Time formatting
  'time.today': 'Hoje',
  'time.yesterday': 'Ontem',
}

export default pt
