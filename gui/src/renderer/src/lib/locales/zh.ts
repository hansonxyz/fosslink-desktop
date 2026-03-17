/**
 * Chinese Simplified (中文) translations.
 * All keys must match en.ts exactly.
 */
export const zh: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': '关于 FossLink',
  'app.newMessage': '新消息',
  'app.findPhone': '查找手机',
  'app.syncMessages': '同步消息',
  'app.settings': '设置',
  'app.sidebarPlaceholder': '连接设备以查看会话',
  'app.sidebarPlaceholderAlt': '会话将显示在此处',
  'app.emptyState': '选择一个会话开始发送消息',

  // Status indicator
  'status.noDaemon': '守护进程未运行',
  'status.disconnected': '未连接设备',
  'status.discovering': '正在搜索设备...',
  'status.pairing': '正在配对...',
  'status.connected': '设备已连接',
  'status.syncing': '正在同步...',
  'status.ready': '就绪',
  'status.error': '错误',

  // Pairing page
  'pairing.starting': '正在启动...',
  'pairing.initializing': '正在初始化 FossLink',
  'pairing.incomingRequest': '收到配对请求',
  'pairing.wantsToPair': '{device} 请求配对',
  'pairing.verifyHint': '接受之前，请确认手机上的配对码一致',
  'pairing.accept': '接受',
  'pairing.reject': '拒绝',
  'pairing.title': '配对',
  'pairing.confirmCode': '确认此配对码与手机上的一致',
  'pairing.connectionError': '连接错误',
  'pairing.unexpectedError': '发生了意外错误',
  'pairing.autoRecover': '守护进程将自动尝试恢复',
  'pairing.connectTitle': '连接到您的手机',
  'pairing.searching': '正在搜索设备...',
  'pairing.dontSeePhone': '没有看到您的手机？',
  'pairing.installApp': '安装',
  'pairing.companionApp': 'FossLink 配套应用',
  'pairing.sameWifi': '并连接到同一 Wi-Fi 网络。',
  'pairing.getStarted': '开始使用 FossLink',
  'pairing.installDescription': '在您的 Android 手机上安装 FossLink 配套应用，将消息、联系人和通知同步到电脑。',
  'pairing.qrAlt': '下载 FossLink 配套应用的二维码',
  'pairing.downloadApp': '下载配套应用',
  'pairing.step1': '在手机上安装 FossLink 应用',
  'pairing.step2': '打开应用，确保连接到同一 Wi-Fi 网络',
  'pairing.step3': '您的手机将自动显示在此处',
  'pairing.dismiss': '关闭',

  // Device list
  'devices.pairedDevices': '已配对设备',
  'devices.offline': '离线',
  'devices.unpair': '取消配对',
  'devices.nearbyDevices': '附近的设备',
  'devices.pair': '配对',
  'devices.noDevices': '未发现附近的设备',

  // Conversations
  'conversations.loading': '正在加载会话...',
  'conversations.noMatch': '没有匹配搜索的会话',
  'conversations.empty': '暂无会话',

  // Search bar
  'search.placeholder': '搜索会话...',
  'search.clear': '清除搜索',
  'search.showUnread': '仅显示未读',
  'search.showAll': '显示所有会话',
  'search.filterSpam': '过滤垃圾/未知',

  // Message thread
  'messages.loading': '正在加载消息...',
  'messages.empty': '此会话中没有消息',
  'messages.sending': '正在发送...',
  'messages.sent': '已发送',
  'messages.failed': '发送失败',
  'messages.retry': '重试',
  'messages.cancel': '取消',
  'messages.compose': '输入消息...',
  'messages.send': '发送消息',
  'messages.emoji': '表情',
  'messages.attach': '添加附件',
  'messages.removeAttachment': '移除附件',
  'messages.attachmentTooLarge': '总大小超出彩信限制，消息可能发送失败。',
  'messages.attachmentTooMany': '最多允许10个附件',

  // Export
  'export.tooltip': '导出会话',
  'export.txt': '导出为 TXT',
  'export.csv': '导出为 CSV',
  'export.csvHeader': '日期,发件人,内容',
  'export.me': '我',

  // Message bubble
  'bubble.saveAttachment': '保存附件',
  'bubble.mmsAlt': '彩信附件',
  'bubble.videoAlt': '视频',
  'bubble.failedToLoad': '加载失败',
  'bubble.copyCode': '复制 {code}',
  'bubble.codeCopied': '{code} 已复制到剪贴板',

  // New conversation
  'newMessage.to': '收件人：',
  'newMessage.changeRecipient': '更改收件人',
  'newMessage.startNew': '发起新会话',
  'newMessage.enterContact': '在上方输入联系人姓名或电话号码',

  // Contact autocomplete
  'contacts.placeholder': '输入姓名或电话号码...',

  // Settings panel
  'settings.title': '设置',
  'settings.close': '关闭设置',
  'settings.connection': '连接',
  'settings.status': '状态',
  'settings.device': '设备',
  'settings.waitingDevice': '等待设备...',
  'settings.ipAddress': 'IP 地址',
  'settings.type': '类型',
  'settings.service': '服务',
  'settings.storage': '可用存储',
  'settings.statusConnected': '已连接',
  'settings.statusReconnecting': '正在重新连接',
  'settings.statusDisconnected': '未连接',
  'settings.notifications': '通知',
  'settings.desktopNotifications': '桌面通知',
  'settings.flashTaskbar': '收到新消息时闪烁任务栏',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.linkPreviews': '显示链接预览',

  // Language
  'settings.language': '语言',
  'settings.languageAuto': '自动（从系统检测）',

  // Theme
  'settings.theme': '主题',

  // Updates
  'updates.title': '更新',
  'updates.version': '版本',
  'updates.checkAuto': '自动检查',
  'updates.checking': '正在检查更新...',
  'updates.available': '版本 {version} 可用',
  'updates.upToDate': '已是最新版本',
  'updates.downloading': '正在下载... {percent}%',
  'updates.ready': '版本 {version} 已准备好安装',
  'updates.error': '更新错误：{message}',
  'updates.checkBtn': '检查更新',
  'updates.checkingBtn': '正在检查...',
  'updates.viewOnGithub': '在 GitHub 上查看更新',
  'updates.restartBtn': '重启以更新',

  // Update banner
  'banner.ready': '版本 {version} 已准备好安装。',
  'banner.restart': '重启以更新',
  'banner.later': '稍后',

  // Device settings section
  'settings.deviceSection': '设备',
  'settings.unpairConfirm': '取消与 {device} 的配对？您需要重新配对才能使用 FossLink。',
  'settings.unpairBtn': '取消配对',
  'settings.unpairing': '正在取消配对...',
  'settings.cancelBtn': '取消',
  'settings.unpairDevice': '取消配对设备',
  'settings.aboutBtn': '关于 FossLink',

  // Find my phone
  'findPhone.close': '关闭',
  'findPhone.title': '查找手机',
  'findPhone.description': '这将使您的手机以最大音量响铃，即使处于静音模式。',
  'findPhone.ring': '使手机响铃',
  'findPhone.ringing': '正在响铃...',
  'findPhone.ringingDesc': '您的手机现在应该在响铃。',
  'findPhone.ringAgain': '再次响铃',
  'findPhone.errorTitle': '无法使手机响铃',
  'findPhone.tryAgain': '重试',

  // About dialog
  'about.close': '关闭',
  'about.name': 'FossLink',
  'about.version': 'Version 1.0.0',
  'about.credit': '2026 年，Brian Hanson',
  'about.releasedUnder': '基于以下许可证发布：',
  'about.mitLicense': 'MIT 许可证',
  'about.acknowledgments': '致谢',
  'about.ffmpegDesc': '视频转码和缩略图生成',
  'about.electronDesc': '跨平台桌面框架',
  'about.svelteDesc': '响应式 UI 框架',
  'about.sourceAvailable': '完整许可证和源代码可在此获取：',
  'about.androidApp': 'Get the Android companion app on',
  'about.googlePlay': 'Google Play',
  'about.tagline': '本软件秉承开源精神提供，希望能让您的生活更加便利。',

  // Dial confirmation
  'dial.confirm': '在手机上拨打 {number}？',
  'dial.ok': '确定',
  'dial.cancel': '取消',
  'dial.callBtn': '拨打',

  // URL sharing
  'app.shareUrl': '在手机上打开链接',
  'shareUrl.title': '在手机上打开链接',
  'shareUrl.placeholder': 'https://...',
  'shareUrl.cancel': '取消',
  'shareUrl.share': '分享',
  'shareUrl.invalidUrl': '请输入以 http:// 或 https:// 开头的有效网址',

  // Resync
  'settings.resyncBtn': '重新同步',

  // Version compatibility
  'version.companionUpdateRequired': '需要更新配套应用',
  'version.companionUpdateDesc': '您手机上的 FossLink 应用 (v{peerVersion}) 与此版本的 FossLink Desktop (v{desktopVersion}) 不兼容。请更新应用。',
  'version.desktopUpdateRequired': '需要更新桌面版',
  'version.desktopUpdateDesc': '此版本的 FossLink Desktop (v{desktopVersion}) 与您手机上的 FossLink 应用 (v{peerVersion}) 不兼容。请更新 FossLink Desktop。',
  'version.updateCompanion': '更新配套应用',
  'version.downloadUpdate': '下载更新',
  'version.orScanQR': '或在手机上扫描此二维码下载最新版本：',
  'version.sentToPhone': '更新请求已发送到手机',

  // Storage analyzer
  'storage.title': '存储分析器',
  'storage.analyzing': '正在分析手机存储...',
  'storage.analyzeBtn': '分析存储',
  'storage.close': '关闭',
  'storage.free': '{total} GB 中有 {free} GB 可用',
  'storage.error': '存储分析失败',
  'storage.noRoot': '在手机上启用 Root 集成以获取详细分析。',

  // Extras section
  'extras.title': '附加功能',
  'extras.storageTitle': '存储浏览器',
  'extras.storageSubtitle': '分析存储使用情况',
  'extras.filesTitle': '手机文件',
  'extras.filesSubtitle': '浏览文件系统',
  'extras.filesMounted': '已挂载',
  'extras.migrationTitle': '联系人迁移',
  'extras.migrationSubtitle': '将设备联系人移至 Google',

  // Contact migration
  'migration.title': '联系人迁移',
  'migration.intro': '查找存储在设备或 SIM 卡上未备份到 Google 通讯录的联系人，并进行迁移。',
  'migration.scanBtn': '扫描设备联系人',
  'migration.scanning': '正在扫描手机联系人...',
  'migration.found': '找到 {count} 个仅存在于设备上的联系人',
  'migration.migrateTo': '迁移到：{account}',
  'migration.noGoogle': '手机上未找到 Google 账户。',
  'migration.selectAll': '全选 ({count})',
  'migration.migrateBtn': '将 {count} 个联系人迁移到 Google',
  'migration.migrating': '正在迁移联系人...',
  'migration.success': '{count} 个联系人迁移成功。',
  'migration.failed': '{count} 个联系人迁移失败。',
  'migration.allGood': '所有联系人已备份到 Google。',
  'migration.done': '完成',
  'migration.retry': '重试',

  // Gallery
  'app.gallery': '手机相册',
  'gallery.title': '手机相册',
  'gallery.close': '关闭相册',
  'gallery.viewDcim': 'DCIM',
  'gallery.viewScreenshots': '截图',
  'gallery.viewFolders': '文件夹',
  'gallery.viewAll': '全部',
  'gallery.sizeSmall': '小缩略图',
  'gallery.sizeLarge': '大缩略图',
  'gallery.toggleHidden': '切换隐藏文件',
  'gallery.scanning': '正在扫描手机相册...',
  'gallery.retry': '重试',
  'gallery.empty': '未找到媒体文件',
  'gallery.noFolders': '未找到文件夹',

  // Notification
  'notification.newMessage': '收到新消息',

  // Time formatting
  'time.today': '今天',
  'time.yesterday': '昨天',
}

export default zh
