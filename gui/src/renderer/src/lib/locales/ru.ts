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
  'messages.attach': 'Прикрепить файл',
  'messages.removeAttachment': 'Удалить вложение',
  'messages.attachmentTooLarge': 'Общий размер превышает лимит MMS. Сообщение может не отправиться.',
  'messages.attachmentTooMany': 'Максимум 10 вложений',

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
  'settings.service': 'Сервис',
  'settings.storage': 'Свободно',
  'settings.statusConnected': 'Подключено',
  'settings.statusReconnecting': 'Переподключение',
  'settings.statusDisconnected': 'Отключено',
  'settings.notifications': 'Уведомления',
  'settings.desktopNotifications': 'Уведомления на рабочем столе',
  'settings.flashTaskbar': 'Мигание панели задач при новом сообщении',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.linkPreviews': 'Показывать превью ссылок',

  // Language
  'settings.language': 'Язык',
  'settings.languageAuto': 'Авто (определить по системе)',

  // Theme
  'settings.theme': 'Тема',

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
  'about.version': 'Version 1.0.0',
  'about.credit': '2026, Brian Hanson',
  'about.releasedUnder': 'Выпущено под лицензией',
  'about.mitLicense': 'Лицензия MIT',
  'about.acknowledgments': 'Благодарности',
  'about.ffmpegDesc': 'транскодирование видео и создание миниатюр',
  'about.electronDesc': 'кроссплатформенный десктопный фреймворк',
  'about.svelteDesc': 'реактивный UI-фреймворк',
  'about.sourceAvailable': 'Полная лицензия и исходный код доступны на',
  'about.androidApp': 'Get the Android companion app on',
  'about.googlePlay': 'Google Play',
  'about.tagline': 'Это программное обеспечение предоставлено в духе открытого исходного кода, в надежде сделать вашу жизнь немного проще.',

  // Dial confirmation
  'dial.confirm': 'Позвонить на {number} с телефона?',
  'dial.ok': 'ОК',
  'dial.cancel': 'Отмена',
  'dial.callBtn': 'Позвонить',

  // URL sharing
  'app.shareUrl': 'Открыть URL на телефоне',
  'shareUrl.title': 'Открыть URL на телефоне',
  'shareUrl.placeholder': 'https://...',
  'shareUrl.cancel': 'Отмена',
  'shareUrl.share': 'Поделиться',
  'shareUrl.invalidUrl': 'Введите корректный URL, начинающийся с http:// или https://',

  // Resync
  'settings.resyncBtn': 'Пересинхронизировать',

  // Version compatibility
  'version.companionUpdateRequired': 'Требуется обновление приложения',
  'version.companionUpdateDesc': 'Приложение FossLink на вашем телефоне (v{peerVersion}) несовместимо с этой версией FossLink Desktop (v{desktopVersion}). Обновите приложение.',
  'version.desktopUpdateRequired': 'Требуется обновление десктопа',
  'version.desktopUpdateDesc': 'Эта версия FossLink Desktop (v{desktopVersion}) несовместима с приложением FossLink на вашем телефоне (v{peerVersion}). Обновите FossLink Desktop.',
  'version.updateCompanion': 'Обновить приложение',
  'version.downloadUpdate': 'Скачать обновление',
  'version.orScanQR': 'Или отсканируйте QR-код на телефоне для загрузки последней версии:',
  'version.sentToPhone': 'Запрос на обновление отправлен на телефон',
  'version.outdatedStatus': 'Outdated Software - Please Update',
  'version.companionOutdatedStatus': 'Companion App Outdated',
  'version.dismiss': 'Dismiss',

  // Storage analyzer
  'storage.title': 'Анализатор хранилища',
  'storage.analyzing': 'Анализ хранилища телефона...',
  'storage.analyzeBtn': 'Анализировать хранилище',
  'storage.close': 'Закрыть',
  'storage.free': '{free} ГБ свободно из {total} ГБ',
  'storage.error': 'Ошибка анализа хранилища',
  'storage.noRoot': 'Включите root-интеграцию на телефоне для подробного анализа.',

  // Extras section
  'extras.title': 'Дополнительно',
  'extras.storageTitle': 'Обзор хранилища',
  'extras.storageSubtitle': 'Анализ использования хранилища',
  'extras.filesTitle': 'Файлы телефона',
  'extras.filesSubtitle': 'Обзор файловой системы',
  'extras.filesMounted': 'Подключено',
  'extras.migrationTitle': 'Миграция контактов',
  'extras.migrationSubtitle': 'Перенос контактов в Google',

  // Contact migration
  'migration.title': 'Миграция контактов',
  'migration.intro': 'Найдите контакты на устройстве или SIM, не сохранённые в Google Contacts, и перенесите их.',
  'migration.scanBtn': 'Найти контакты устройства',
  'migration.scanning': 'Сканирование контактов на телефоне...',
  'migration.found': '{count} контактов найдено только на устройстве',
  'migration.migrateTo': 'Перенести в: {account}',
  'migration.noGoogle': 'Аккаунт Google не найден на телефоне.',
  'migration.selectAll': 'Выбрать все ({count})',
  'migration.migrateBtn': 'Перенести {count} контактов в Google',
  'migration.migrating': 'Перенос контактов...',
  'migration.success': '{count} контактов успешно перенесено.',
  'migration.failed': '{count} контактов не удалось перенести.',
  'migration.allGood': 'Все контакты уже сохранены в Google.',
  'migration.done': 'Готово',
  'migration.retry': 'Повторить',

  // Gallery
  'app.gallery': 'Галерея телефона',
  'gallery.title': 'Галерея телефона',
  'gallery.close': 'Закрыть галерею',
  'gallery.viewDcim': 'DCIM',
  'gallery.viewScreenshots': 'Скриншоты',
  'gallery.viewFolders': 'Папки',
  'gallery.viewAll': 'Все',
  'gallery.sizeSmall': 'Маленькие миниатюры',
  'gallery.sizeLarge': 'Большие миниатюры',
  'gallery.toggleHidden': 'Показать скрытые файлы',
  'gallery.scanning': 'Сканирование галереи телефона...',
  'gallery.retry': 'Повторить',
  'gallery.empty': 'Медиа не найдено',
  'gallery.noFolders': 'Папки не найдены',

  // Notification
  'notification.newMessage': 'Получено новое сообщение',

  // Time formatting
  'time.today': 'Сегодня',
  'time.yesterday': 'Вчера',
}

export default ru
