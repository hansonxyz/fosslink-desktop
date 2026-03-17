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
  'settings.statusConnected': '已连接',
  'settings.statusReconnecting': '正在重新连接',
  'settings.statusDisconnected': '未连接',
  'settings.notifications': '通知',
  'settings.desktopNotifications': '桌面通知',
  'settings.flashTaskbar': '收到新消息时闪烁任务栏',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.language': '语言',
  'settings.languageAuto': '自动（从系统检测）',

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
  'about.version': '版本 0.1',
  'about.credit': '2026 年，Brian Hanson',
  'about.releasedUnder': '基于以下许可证发布：',
  'about.mitLicense': 'MIT 许可证',
  'about.acknowledgments': '致谢',
  'about.ffmpegDesc': '视频转码和缩略图生成',
  'about.electronDesc': '跨平台桌面框架',
  'about.svelteDesc': '响应式 UI 框架',
  'about.sourceAvailable': '完整许可证和源代码可在此获取：',
  'about.tagline': '本软件秉承开源精神提供，希望能让您的生活更加便利。',

  // Notification
  'notification.newMessage': '收到新消息',

  // Time formatting
  'time.today': '今天',
  'time.yesterday': '昨天',
}

export default zh
