/**
 * Arabic translations for FossLink GUI.
 * All keys must match the English source (en.ts).
 */
export const ar: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'حول FossLink',
  'app.newMessage': 'رسالة جديدة',
  'app.findPhone': 'العثور على هاتفي',
  'app.syncMessages': 'مزامنة الرسائل',
  'app.settings': 'الإعدادات',
  'app.sidebarPlaceholder': 'قم بتوصيل جهاز لعرض المحادثات',
  'app.sidebarPlaceholderAlt': 'ستظهر المحادثات هنا',
  'app.emptyState': 'اختر محادثة لبدء المراسلة',

  // Status indicator
  'status.noDaemon': 'الخدمة لا تعمل',
  'status.disconnected': 'لا يوجد جهاز متصل',
  'status.discovering': 'جارٍ البحث عن أجهزة...',
  'status.pairing': 'جارٍ الاقتران...',
  'status.connected': 'الجهاز متصل',
  'status.syncing': 'جارٍ المزامنة...',
  'status.ready': 'جاهز',
  'status.error': 'خطأ',

  // Pairing page
  'pairing.starting': 'جارٍ البدء...',
  'pairing.initializing': 'جارٍ تهيئة FossLink',
  'pairing.incomingRequest': 'طلب اقتران وارد',
  'pairing.wantsToPair': '{device} يريد الاقتران',
  'pairing.verifyHint': 'تحقق من تطابق الرمز على هاتفك قبل القبول',
  'pairing.accept': 'قبول',
  'pairing.reject': 'رفض',
  'pairing.title': 'الاقتران',
  'pairing.confirmCode': 'تأكد من تطابق هذا الرمز على هاتفك',
  'pairing.connectionError': 'خطأ في الاتصال',
  'pairing.unexpectedError': 'حدث خطأ غير متوقع',
  'pairing.autoRecover': 'ستحاول الخدمة الاسترداد تلقائيًا',
  'pairing.connectTitle': 'اتصل بهاتفك',
  'pairing.searching': 'جارٍ البحث عن أجهزة...',
  'pairing.dontSeePhone': 'لا ترى هاتفك؟',
  'pairing.installApp': 'ثبّت',
  'pairing.companionApp': 'تطبيق FossLink المرافق',
  'pairing.sameWifi': 'واتصل بنفس شبكة Wi-Fi.',
  'pairing.getStarted': 'ابدأ مع FossLink',
  'pairing.installDescription': 'ثبّت تطبيق FossLink المرافق على هاتفك الأندرويد لمزامنة رسائلك وجهات اتصالك وإشعاراتك مع حاسوبك.',
  'pairing.qrAlt': 'رمز QR لتحميل تطبيق FossLink المرافق',
  'pairing.downloadApp': 'تحميل التطبيق المرافق',
  'pairing.step1': 'ثبّت تطبيق FossLink على هاتفك',
  'pairing.step2': 'افتح التطبيق وتأكد أنك على نفس شبكة Wi-Fi',
  'pairing.step3': 'سيظهر هاتفك هنا تلقائيًا',
  'pairing.dismiss': 'إغلاق',

  // Device list
  'devices.pairedDevices': 'الأجهزة المقترنة',
  'devices.offline': 'غير متصل',
  'devices.unpair': 'إلغاء الاقتران',
  'devices.nearbyDevices': 'أجهزة قريبة',
  'devices.pair': 'اقتران',
  'devices.noDevices': 'لم يتم العثور على أجهزة قريبة',

  // Conversations
  'conversations.loading': 'جارٍ تحميل المحادثات...',
  'conversations.noMatch': 'لا توجد محادثات تطابق بحثك',
  'conversations.empty': 'لا توجد محادثات بعد',

  // Search bar
  'search.placeholder': 'البحث في المحادثات...',
  'search.clear': 'مسح البحث',
  'search.showUnread': 'عرض غير المقروءة فقط',
  'search.showAll': 'عرض جميع المحادثات',
  'search.filterSpam': 'تصفية الرسائل المزعجة/غير المعروفة',

  // Message thread
  'messages.loading': 'جارٍ تحميل الرسائل...',
  'messages.empty': 'لا توجد رسائل في هذه المحادثة',
  'messages.sending': 'جارٍ الإرسال...',
  'messages.sent': 'تم الإرسال',
  'messages.failed': 'فشل الإرسال',
  'messages.retry': 'إعادة المحاولة',
  'messages.cancel': 'إلغاء',
  'messages.compose': 'اكتب رسالة...',
  'messages.send': 'إرسال رسالة',
  'messages.emoji': 'رموز تعبيرية',

  // Export
  'export.tooltip': 'تصدير المحادثة',
  'export.txt': 'تصدير كـ TXT',
  'export.csv': 'تصدير كـ CSV',
  'export.csvHeader': 'التاريخ,من,المحتوى',
  'export.me': 'أنا',

  // Message bubble
  'bubble.saveAttachment': 'حفظ المرفق',
  'bubble.mmsAlt': 'مرفق MMS',
  'bubble.videoAlt': 'فيديو',
  'bubble.failedToLoad': 'فشل التحميل',
  'bubble.copyCode': 'نسخ {code}',
  'bubble.codeCopied': 'تم نسخ {code} إلى الحافظة',

  // New conversation
  'newMessage.to': 'إلى:',
  'newMessage.changeRecipient': 'تغيير المستلم',
  'newMessage.startNew': 'بدء محادثة جديدة',
  'newMessage.enterContact': 'أدخل اسم جهة اتصال أو رقم هاتف أعلاه',

  // Contact autocomplete
  'contacts.placeholder': 'اكتب اسمًا أو رقم هاتف...',

  // Settings panel
  'settings.title': 'الإعدادات',
  'settings.close': 'إغلاق الإعدادات',
  'settings.connection': 'الاتصال',
  'settings.status': 'الحالة',
  'settings.device': 'الجهاز',
  'settings.waitingDevice': 'في انتظار الجهاز...',
  'settings.ipAddress': 'عنوان IP',
  'settings.type': 'النوع',
  'settings.statusConnected': 'متصل',
  'settings.statusReconnecting': 'جارٍ إعادة الاتصال',
  'settings.statusDisconnected': 'غير متصل',
  'settings.notifications': 'الإشعارات',
  'settings.desktopNotifications': 'إشعارات سطح المكتب',
  'settings.flashTaskbar': 'وميض شريط المهام عند رسالة جديدة',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.language': 'اللغة',
  'settings.languageAuto': 'تلقائي (اكتشاف من النظام)',

  // Updates
  'updates.title': 'التحديثات',
  'updates.version': 'الإصدار',
  'updates.checkAuto': 'التحقق تلقائيًا',
  'updates.checking': 'جارٍ التحقق من التحديثات...',
  'updates.available': 'الإصدار {version} متاح',
  'updates.upToDate': 'لديك أحدث إصدار',
  'updates.downloading': 'جارٍ التنزيل... {percent}%',
  'updates.ready': 'الإصدار {version} جاهز للتثبيت',
  'updates.error': 'خطأ في التحديث: {message}',
  'updates.checkBtn': 'التحقق من التحديثات',
  'updates.checkingBtn': 'جارٍ التحقق...',
  'updates.viewOnGithub': 'عرض التحديث على GitHub',
  'updates.restartBtn': 'إعادة التشغيل للتحديث',

  // Update banner
  'banner.ready': 'الإصدار {version} جاهز للتثبيت.',
  'banner.restart': 'إعادة التشغيل للتحديث',
  'banner.later': 'لاحقًا',

  // Device settings section
  'settings.deviceSection': 'الجهاز',
  'settings.unpairConfirm': 'إلغاء الاقتران من {device}؟ ستحتاج إلى الاقتران مرة أخرى لاستخدام FossLink.',
  'settings.unpairBtn': 'إلغاء الاقتران',
  'settings.unpairing': 'جارٍ إلغاء الاقتران...',
  'settings.cancelBtn': 'إلغاء',
  'settings.unpairDevice': 'إلغاء اقتران الجهاز',
  'settings.aboutBtn': 'حول FossLink',

  // Find my phone
  'findPhone.close': 'إغلاق',
  'findPhone.title': 'العثور على هاتفي',
  'findPhone.description': 'سيجعل هذا هاتفك يرن بأعلى صوت، حتى لو كان على الوضع الصامت.',
  'findPhone.ring': 'رنين الهاتف',
  'findPhone.ringing': 'جارٍ الرنين...',
  'findPhone.ringingDesc': 'يجب أن يرن هاتفك الآن.',
  'findPhone.ringAgain': 'رنين مرة أخرى',
  'findPhone.errorTitle': 'تعذّر رنين الهاتف',
  'findPhone.tryAgain': 'حاول مرة أخرى',

  // About dialog
  'about.close': 'إغلاق',
  'about.name': 'FossLink',
  'about.version': 'الإصدار 0.1',
  'about.credit': '2026 بواسطة Brian Hanson',
  'about.releasedUnder': 'صدر بموجب',
  'about.mitLicense': 'رخصة MIT',
  'about.acknowledgments': 'شكر وتقدير',
  'about.ffmpegDesc': 'تحويل الفيديو وإنشاء الصور المصغرة',
  'about.electronDesc': 'إطار عمل سطح مكتب متعدد المنصات',
  'about.svelteDesc': 'إطار عمل واجهة مستخدم تفاعلي',
  'about.sourceAvailable': 'الترخيص الكامل والمصدر متاح على',
  'about.tagline': 'تم تقديم هذا البرنامج بروح المصدر المفتوح، على أمل أن يجعل حياتك أسهل قليلًا.',

  // Notification
  'notification.newMessage': 'تم استلام رسالة جديدة',

  // Time formatting
  'time.today': 'اليوم',
  'time.yesterday': 'أمس',
}

export default ar
