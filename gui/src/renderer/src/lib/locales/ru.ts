/**
 * Russian (Русский) translations.
 * All keys must match en.ts exactly.
 */
export const ru: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'О FossLink',
  'app.newMessage': 'Новое сообщение',
  'app.findPhone': 'Найти телефон',
  'app.syncMessages': 'Синхронизировать сообщения',
  'app.settings': 'Настройки',
  'app.sidebarPlaceholder': 'Подключите устройство, чтобы увидеть беседы',
  'app.sidebarPlaceholderAlt': 'Беседы появятся здесь',
  'app.emptyState': 'Выберите беседу, чтобы начать общение',

  // Status indicator
  'status.noDaemon': 'Демон не запущен',
  'status.disconnected': 'Устройство не подключено',
  'status.discovering': 'Поиск устройств...',
  'status.pairing': 'Сопряжение...',
  'status.connected': 'Устройство подключено',
  'status.syncing': 'Синхронизация...',
  'status.ready': 'Готово',
  'status.error': 'Ошибка',

  // Pairing page
  'pairing.starting': 'Запуск...',
  'pairing.initializing': 'Инициализация FossLink',
  'pairing.incomingRequest': 'Входящий запрос на сопряжение',
  'pairing.wantsToPair': '{device} хочет выполнить сопряжение',
  'pairing.verifyHint': 'Убедитесь, что код совпадает на вашем телефоне, прежде чем принять',
  'pairing.accept': 'Принять',
  'pairing.reject': 'Отклонить',
  'pairing.title': 'Сопряжение',
  'pairing.confirmCode': 'Убедитесь, что этот код совпадает на вашем телефоне',
  'pairing.connectionError': 'Ошибка подключения',
  'pairing.unexpectedError': 'Произошла непредвиденная ошибка',
  'pairing.autoRecover': 'Демон попытается восстановиться автоматически',
  'pairing.connectTitle': 'Подключитесь к телефону',
  'pairing.searching': 'Поиск устройств...',
  'pairing.dontSeePhone': 'Не видите свой телефон?',
  'pairing.installApp': 'Установите',
  'pairing.companionApp': 'приложение-компаньон FossLink',
  'pairing.sameWifi': 'и подключитесь к той же сети Wi-Fi.',
  'pairing.getStarted': 'Начало работы с FossLink',
  'pairing.installDescription': 'Установите приложение-компаньон FossLink на свой Android-телефон, чтобы синхронизировать сообщения, контакты и уведомления с компьютером.',
  'pairing.qrAlt': 'QR-код для загрузки приложения-компаньона FossLink',
  'pairing.downloadApp': 'Скачать приложение-компаньон',
  'pairing.step1': 'Установите приложение FossLink на телефон',
  'pairing.step2': 'Откройте приложение и убедитесь, что вы подключены к той же сети Wi-Fi',
  'pairing.step3': 'Ваш телефон появится здесь автоматически',
  'pairing.dismiss': 'Закрыть',

  // Device list
  'devices.pairedDevices': 'Сопряжённые устройства',
  'devices.offline': 'Не в сети',
  'devices.unpair': 'Отключить',
  'devices.nearbyDevices': 'Устройства поблизости',
  'devices.pair': 'Сопряжение',
  'devices.noDevices': 'Устройства поблизости не найдены',

  // Conversations
  'conversations.loading': 'Загрузка бесед...',
  'conversations.noMatch': 'Нет бесед, соответствующих вашему запросу',
  'conversations.empty': 'Бесед пока нет',

  // Search bar
  'search.placeholder': 'Поиск бесед...',
  'search.clear': 'Очистить поиск',
  'search.showUnread': 'Только непрочитанные',
  'search.showAll': 'Показать все беседы',
  'search.filterSpam': 'Фильтровать спам/неизвестные',

  // Message thread
  'messages.loading': 'Загрузка сообщений...',
  'messages.empty': 'В этой беседе нет сообщений',
  'messages.sending': 'Отправка...',
  'messages.sent': 'Отправлено',
  'messages.failed': 'Не удалось отправить',
  'messages.retry': 'Повторить',
  'messages.cancel': 'Отмена',
  'messages.compose': 'Введите сообщение...',
  'messages.send': 'Отправить сообщение',
  'messages.emoji': 'Эмодзи',

  // Export
  'export.tooltip': 'Экспортировать беседу',
  'export.txt': 'Экспорт в TXT',
  'export.csv': 'Экспорт в CSV',
  'export.csvHeader': 'Дата,От,Текст',
  'export.me': 'Я',

  // Message bubble
  'bubble.saveAttachment': 'Сохранить вложение',
  'bubble.mmsAlt': 'MMS-вложение',
  'bubble.videoAlt': 'Видео',
  'bubble.failedToLoad': 'Не удалось загрузить',
  'bubble.copyCode': 'Копировать {code}',
  'bubble.codeCopied': '{code} скопирован в буфер обмена',

  // New conversation
  'newMessage.to': 'Кому:',
  'newMessage.changeRecipient': 'Изменить получателя',
  'newMessage.startNew': 'Начать новую беседу',
  'newMessage.enterContact': 'Введите имя контакта или номер телефона выше',

  // Contact autocomplete
  'contacts.placeholder': 'Введите имя или номер телефона...',

  // Settings panel
  'settings.title': 'Настройки',
  'settings.close': 'Закрыть настройки',
  'settings.connection': 'Подключение',
  'settings.status': 'Статус',
  'settings.device': 'Устройство',
  'settings.waitingDevice': 'Ожидание устройства...',
  'settings.ipAddress': 'IP-адрес',
  'settings.type': 'Тип',
  'settings.statusConnected': 'Подключено',
  'settings.statusReconnecting': 'Переподключение',
  'settings.statusDisconnected': 'Отключено',
  'settings.notifications': 'Уведомления',
  'settings.desktopNotifications': 'Уведомления на рабочем столе',
  'settings.flashTaskbar': 'Мигание панели задач при новом сообщении',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.language': 'Язык',
  'settings.languageAuto': 'Авто (определить по системе)',

  // Updates
  'updates.title': 'Обновления',
  'updates.version': 'Версия',
  'updates.checkAuto': 'Проверять автоматически',
  'updates.checking': 'Проверка обновлений...',
  'updates.available': 'Доступна версия {version}',
  'updates.upToDate': 'У вас последняя версия',
  'updates.downloading': 'Загрузка... {percent}%',
  'updates.ready': 'Версия {version} готова к установке',
  'updates.error': 'Ошибка обновления: {message}',
  'updates.checkBtn': 'Проверить обновления',
  'updates.checkingBtn': 'Проверка...',
  'updates.viewOnGithub': 'Посмотреть обновление на GitHub',
  'updates.restartBtn': 'Перезапустить для обновления',

  // Update banner
  'banner.ready': 'Версия {version} готова к установке.',
  'banner.restart': 'Перезапустить для обновления',
  'banner.later': 'Позже',

  // Device settings section
  'settings.deviceSection': 'Устройство',
  'settings.unpairConfirm': 'Отключить {device}? Для использования FossLink потребуется повторное сопряжение.',
  'settings.unpairBtn': 'Отключить',
  'settings.unpairing': 'Отключение...',
  'settings.cancelBtn': 'Отмена',
  'settings.unpairDevice': 'Отключить устройство',
  'settings.aboutBtn': 'О FossLink',

  // Find my phone
  'findPhone.close': 'Закрыть',
  'findPhone.title': 'Найти телефон',
  'findPhone.description': 'Телефон зазвонит на полной громкости, даже если он в беззвучном режиме.',
  'findPhone.ring': 'Позвонить на телефон',
  'findPhone.ringing': 'Звонит...',
  'findPhone.ringingDesc': 'Ваш телефон сейчас должен звонить.',
  'findPhone.ringAgain': 'Позвонить снова',
  'findPhone.errorTitle': 'Не удалось позвонить на телефон',
  'findPhone.tryAgain': 'Попробовать снова',

  // About dialog
  'about.close': 'Закрыть',
  'about.name': 'FossLink',
  'about.version': 'Версия 0.1',
  'about.credit': '2026, Brian Hanson',
  'about.releasedUnder': 'Выпущено под лицензией',
  'about.mitLicense': 'Лицензия MIT',
  'about.acknowledgments': 'Благодарности',
  'about.ffmpegDesc': 'транскодирование видео и создание миниатюр',
  'about.electronDesc': 'кроссплатформенный десктопный фреймворк',
  'about.svelteDesc': 'реактивный UI-фреймворк',
  'about.sourceAvailable': 'Полная лицензия и исходный код доступны на',
  'about.tagline': 'Это программное обеспечение предоставлено в духе открытого исходного кода, в надежде сделать вашу жизнь немного проще.',

  // Notification
  'notification.newMessage': 'Получено новое сообщение',

  // Time formatting
  'time.today': 'Сегодня',
  'time.yesterday': 'Вчера',
}

export default ru
