/**
 * Japanese (日本語) translations.
 * All keys must match en.ts exactly.
 */
export const ja: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'FossLink について',
  'app.newMessage': '新しいメッセージ',
  'app.findPhone': 'スマートフォンを探す',
  'app.syncMessages': 'メッセージを同期',
  'app.settings': '設定',
  'app.sidebarPlaceholder': 'デバイスを接続して会話を表示',
  'app.sidebarPlaceholderAlt': '会話がここに表示されます',
  'app.emptyState': '会話を選択してメッセージを開始',

  // Status indicator
  'status.noDaemon': 'デーモンが実行されていません',
  'status.disconnected': 'デバイスが接続されていません',
  'status.discovering': 'デバイスを検索中...',
  'status.pairing': 'ペアリング中...',
  'status.connected': 'デバイス接続済み',
  'status.syncing': '同期中...',
  'status.ready': '準備完了',
  'status.error': 'エラー',

  // Pairing page
  'pairing.starting': '起動中...',
  'pairing.initializing': 'FossLink を初期化中',
  'pairing.incomingRequest': 'ペアリングリクエストを受信',
  'pairing.wantsToPair': '{device} がペアリングを要求しています',
  'pairing.verifyHint': '承認する前に、スマートフォンのコードが一致していることを確認してください',
  'pairing.accept': '承認',
  'pairing.reject': '拒否',
  'pairing.title': 'ペアリング',
  'pairing.confirmCode': 'このコードがスマートフォンと一致していることを確認してください',
  'pairing.connectionError': '接続エラー',
  'pairing.unexpectedError': '予期しないエラーが発生しました',
  'pairing.autoRecover': 'デーモンが自動的に復旧を試みます',
  'pairing.connectTitle': 'スマートフォンに接続',
  'pairing.searching': 'デバイスを検索中...',
  'pairing.dontSeePhone': 'スマートフォンが見つかりませんか？',
  'pairing.installApp': '',
  'pairing.companionApp': 'FossLink コンパニオンアプリ',
  'pairing.sameWifi': 'をインストールして、同じ Wi-Fi ネットワークに接続してください。',
  'pairing.getStarted': 'FossLink を始めよう',
  'pairing.installDescription': 'Android スマートフォンに FossLink コンパニオンアプリをインストールして、メッセージ、連絡先、通知をパソコンと同期しましょう。',
  'pairing.qrAlt': 'FossLink コンパニオンアプリをダウンロードする QR コード',
  'pairing.downloadApp': 'コンパニオンアプリをダウンロード',
  'pairing.step1': 'スマートフォンに FossLink アプリをインストール',
  'pairing.step2': 'アプリを開き、同じ Wi-Fi ネットワークに接続されていることを確認',
  'pairing.step3': 'スマートフォンが自動的にここに表示されます',
  'pairing.dismiss': '閉じる',

  // Device list
  'devices.pairedDevices': 'ペアリング済みデバイス',
  'devices.offline': 'オフライン',
  'devices.unpair': 'ペアリング解除',
  'devices.nearbyDevices': '近くのデバイス',
  'devices.pair': 'ペアリング',
  'devices.noDevices': '近くにデバイスが見つかりません',

  // Conversations
  'conversations.loading': '会話を読み込み中...',
  'conversations.noMatch': '検索に一致する会話がありません',
  'conversations.empty': '会話はまだありません',

  // Search bar
  'search.placeholder': '会話を検索...',
  'search.clear': '検索をクリア',
  'search.showUnread': '未読のみ表示',
  'search.showAll': 'すべての会話を表示',
  'search.filterSpam': 'スパム/不明をフィルター',

  // Message thread
  'messages.loading': 'メッセージを読み込み中...',
  'messages.empty': 'この会話にはメッセージがありません',
  'messages.sending': '送信中...',
  'messages.sent': '送信済み',
  'messages.failed': '送信に失敗しました',
  'messages.retry': '再試行',
  'messages.cancel': 'キャンセル',
  'messages.compose': 'メッセージを入力...',
  'messages.send': 'メッセージを送信',
  'messages.emoji': '絵文字',
  'messages.attach': 'ファイルを添付',
  'messages.removeAttachment': '添付ファイルを削除',
  'messages.attachmentTooLarge': '合計サイズがMMS制限を超えています。送信に失敗する可能性があります。',
  'messages.attachmentTooMany': '添付ファイルは最大10個までです',

  // Export
  'export.tooltip': '会話をエクスポート',
  'export.txt': 'TXT としてエクスポート',
  'export.csv': 'CSV としてエクスポート',
  'export.csvHeader': '日付,送信者,本文',
  'export.me': '自分',

  // Message bubble
  'bubble.saveAttachment': '添付ファイルを保存',
  'bubble.mmsAlt': 'MMS 添付ファイル',
  'bubble.videoAlt': '動画',
  'bubble.failedToLoad': '読み込みに失敗しました',
  'bubble.copyCode': '{code} をコピー',
  'bubble.codeCopied': '{code} をクリップボードにコピーしました',

  // New conversation
  'newMessage.to': '宛先：',
  'newMessage.changeRecipient': '宛先を変更',
  'newMessage.startNew': '新しい会話を開始',
  'newMessage.enterContact': '上に連絡先の名前または電話番号を入力してください',

  // Contact autocomplete
  'contacts.placeholder': '名前または電話番号を入力...',

  // Settings panel
  'settings.title': '設定',
  'settings.close': '設定を閉じる',
  'settings.connection': '接続',
  'settings.status': 'ステータス',
  'settings.device': 'デバイス',
  'settings.waitingDevice': 'デバイスを待機中...',
  'settings.ipAddress': 'IP アドレス',
  'settings.type': 'タイプ',
  'settings.service': 'サービス',
  'settings.storage': '空き容量',
  'settings.statusConnected': '接続済み',
  'settings.statusReconnecting': '再接続中',
  'settings.statusDisconnected': '未接続',
  'settings.notifications': '通知',
  'settings.desktopNotifications': 'デスクトップ通知',
  'settings.flashTaskbar': '新しいメッセージでタスクバーを点滅',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.linkPreviews': 'リンクプレビューを表示',

  // Language
  'settings.language': '言語',
  'settings.languageAuto': '自動（システムから検出）',

  // Theme
  'settings.theme': 'テーマ',

  // Updates
  'updates.title': 'アップデート',
  'updates.version': 'バージョン',
  'updates.checkAuto': '自動で確認',
  'updates.checking': 'アップデートを確認中...',
  'updates.available': 'バージョン {version} が利用可能です',
  'updates.upToDate': '最新の状態です',
  'updates.downloading': 'ダウンロード中... {percent}%',
  'updates.ready': 'バージョン {version} をインストールできます',
  'updates.error': 'アップデートエラー：{message}',
  'updates.checkBtn': 'アップデートを確認',
  'updates.checkingBtn': '確認中...',
  'updates.viewOnGithub': 'GitHub でアップデートを確認',
  'updates.restartBtn': '再起動してアップデート',

  // Update banner
  'banner.ready': 'バージョン {version} をインストールできます。',
  'banner.restart': '再起動してアップデート',
  'banner.later': '後で',

  // Device settings section
  'settings.deviceSection': 'デバイス',
  'settings.unpairConfirm': '{device} とのペアリングを解除しますか？FossLink を使用するには再度ペアリングが必要です。',
  'settings.unpairBtn': 'ペアリング解除',
  'settings.unpairing': 'ペアリング解除中...',
  'settings.cancelBtn': 'キャンセル',
  'settings.unpairDevice': 'デバイスのペアリング解除',
  'settings.aboutBtn': 'FossLink について',

  // Find my phone
  'findPhone.close': '閉じる',
  'findPhone.title': 'スマートフォンを探す',
  'findPhone.description': 'マナーモードでもスマートフォンが最大音量で鳴ります。',
  'findPhone.ring': 'スマートフォンを鳴らす',
  'findPhone.ringing': '鳴動中...',
  'findPhone.ringingDesc': 'スマートフォンが鳴っているはずです。',
  'findPhone.ringAgain': 'もう一度鳴らす',
  'findPhone.errorTitle': 'スマートフォンを鳴らせませんでした',
  'findPhone.tryAgain': '再試行',

  // About dialog
  'about.close': '閉じる',
  'about.name': 'FossLink',
  'about.version': 'Version 1.0.0',
  'about.credit': '2026 年 Brian Hanson',
  'about.releasedUnder': 'ライセンス：',
  'about.mitLicense': 'MIT ライセンス',
  'about.acknowledgments': '謝辞',
  'about.ffmpegDesc': '動画トランスコードとサムネイル生成',
  'about.electronDesc': 'クロスプラットフォームのデスクトップフレームワーク',
  'about.svelteDesc': 'リアクティブ UI フレームワーク',
  'about.sourceAvailable': '完全なライセンスとソースコードはこちらで入手できます：',
  'about.androidApp': 'Get the Android companion app on',
  'about.googlePlay': 'Google Play',
  'about.tagline': 'このソフトウェアはオープンソースの精神に基づき、皆様の生活が少しでも便利になることを願って提供されています。',

  // Dial confirmation
  'dial.confirm': '{number}に電話しますか？',
  'dial.ok': 'OK',
  'dial.cancel': 'キャンセル',
  'dial.callBtn': '電話',

  // URL sharing
  'app.shareUrl': '電話でURLを開く',
  'shareUrl.title': '電話でURLを開く',
  'shareUrl.placeholder': 'https://...',
  'shareUrl.cancel': 'キャンセル',
  'shareUrl.share': '共有',
  'shareUrl.invalidUrl': 'http:// または https:// で始まる有効なURLを入力してください',

  // Resync
  'settings.resyncBtn': '再同期',

  // Version compatibility
  'version.companionUpdateRequired': 'コンパニオンアプリの更新が必要です',
  'version.companionUpdateDesc': 'お使いの電話のFossLinkアプリ (v{peerVersion}) はこのバージョンのFossLink Desktop (v{desktopVersion}) と互換性がありません。アプリを更新してください。',
  'version.desktopUpdateRequired': 'デスクトップの更新が必要です',
  'version.desktopUpdateDesc': 'このバージョンのFossLink Desktop (v{desktopVersion}) はお使いの電話のFossLinkアプリ (v{peerVersion}) と互換性がありません。FossLink Desktopを更新してください。',
  'version.updateCompanion': 'アプリを更新',
  'version.downloadUpdate': 'アップデートをダウンロード',
  'version.orScanQR': 'または電話でこのQRコードをスキャンして最新バージョンをダウンロード：',
  'version.sentToPhone': '更新リクエストを電話に送信しました',

  // Storage analyzer
  'storage.title': 'ストレージ分析',
  'storage.analyzing': '電話のストレージを分析中...',
  'storage.analyzeBtn': 'ストレージを分析',
  'storage.close': '閉じる',
  'storage.free': '{total} GB 中 {free} GB 空き',
  'storage.error': 'ストレージ分析に失敗しました',
  'storage.noRoot': '詳細な分析には電話でRoot統合を有効にしてください。',

  // Extras section
  'extras.title': 'その他',
  'extras.storageTitle': 'ストレージエクスプローラー',
  'extras.storageSubtitle': 'ストレージ使用量を分析',
  'extras.filesTitle': '電話のファイル',
  'extras.filesSubtitle': 'ファイルシステムを閲覧',
  'extras.filesMounted': 'マウント済み',
  'extras.migrationTitle': '連絡先の移行',
  'extras.migrationSubtitle': 'デバイスの連絡先をGoogleに移動',

  // Contact migration
  'migration.title': '連絡先の移行',
  'migration.intro': 'デバイスやSIMに保存されていてGoogle連絡先にバックアップされていない連絡先を見つけて移行します。',
  'migration.scanBtn': 'デバイスの連絡先を検索',
  'migration.scanning': '電話の連絡先をスキャン中...',
  'migration.found': 'デバイスのみに {count} 件の連絡先が見つかりました',
  'migration.migrateTo': '移行先：{account}',
  'migration.noGoogle': '電話にGoogleアカウントが見つかりません。',
  'migration.selectAll': 'すべて選択 ({count})',
  'migration.migrateBtn': '{count} 件の連絡先をGoogleに移行',
  'migration.migrating': '連絡先を移行中...',
  'migration.success': '{count} 件の連絡先が正常に移行されました。',
  'migration.failed': '{count} 件の連絡先が失敗しました。',
  'migration.allGood': 'すべての連絡先はすでにGoogleにバックアップされています。',
  'migration.done': '完了',
  'migration.retry': '再試行',

  // Gallery
  'app.gallery': '電話ギャラリー',
  'gallery.title': '電話ギャラリー',
  'gallery.close': 'ギャラリーを閉じる',
  'gallery.viewDcim': 'DCIM',
  'gallery.viewScreenshots': 'スクリーンショット',
  'gallery.viewFolders': 'フォルダ',
  'gallery.viewAll': 'すべて',
  'gallery.sizeSmall': '小さいサムネイル',
  'gallery.sizeLarge': '大きいサムネイル',
  'gallery.toggleHidden': '隠しファイルの表示切替',
  'gallery.scanning': '電話ギャラリーをスキャン中...',
  'gallery.retry': '再試行',
  'gallery.empty': 'メディアが見つかりません',
  'gallery.noFolders': 'フォルダが見つかりません',

  // Notification
  'notification.newMessage': '新しいメッセージを受信しました',

  // Time formatting
  'time.today': '今日',
  'time.yesterday': '昨日',
}

export default ja
