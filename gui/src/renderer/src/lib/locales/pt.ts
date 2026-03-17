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
  'settings.statusConnected': 'Conectado',
  'settings.statusReconnecting': 'Reconectando',
  'settings.statusDisconnected': 'Desconectado',
  'settings.notifications': 'Notificações',
  'settings.desktopNotifications': 'Notificações na área de trabalho',
  'settings.flashTaskbar': 'Piscar barra de tarefas ao receber mensagem',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.language': 'Idioma',
  'settings.languageAuto': 'Automático (detectar do sistema)',

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
  'about.version': 'Versão 0.1',
  'about.credit': '2026 por Brian Hanson',
  'about.releasedUnder': 'Publicado sob a',
  'about.mitLicense': 'Licença MIT',
  'about.acknowledgments': 'Agradecimentos',
  'about.ffmpegDesc': 'transcodificação de vídeo e geração de miniaturas',
  'about.electronDesc': 'framework de desktop multiplataforma',
  'about.svelteDesc': 'framework de UI reativo',
  'about.sourceAvailable': 'Licença completa e código-fonte disponíveis em',
  'about.tagline': 'Este software foi criado no espírito do código aberto, na esperança de tornar sua vida um pouco mais fácil.',

  // Notification
  'notification.newMessage': 'Nova mensagem recebida',

  // Time formatting
  'time.today': 'Hoje',
  'time.yesterday': 'Ontem',
}

export default pt
