/**
 * Turkish translations for FossLink GUI.
 * All keys must match the English source (en.ts).
 */
export const tr: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'FossLink Hakkında',
  'app.newMessage': 'Yeni mesaj',
  'app.findPhone': 'Telefonumu bul',
  'app.syncMessages': 'Mesajları senkronize et',
  'app.settings': 'Ayarlar',
  'app.sidebarPlaceholder': 'Konuşmaları görmek için bir cihaz bağlayın',
  'app.sidebarPlaceholderAlt': 'Konuşmalar burada görünecek',
  'app.emptyState': 'Mesajlaşmaya başlamak için bir konuşma seçin',

  // Status indicator
  'status.noDaemon': 'Arka plan hizmeti çalışmıyor',
  'status.disconnected': 'Bağlı cihaz yok',
  'status.discovering': 'Cihazlar aranıyor...',
  'status.pairing': 'Eşleştiriliyor...',
  'status.connected': 'Cihaz bağlı',
  'status.syncing': 'Senkronize ediliyor...',
  'status.ready': 'Hazır',
  'status.error': 'Hata',

  // Pairing page
  'pairing.starting': 'Başlatılıyor...',
  'pairing.initializing': 'FossLink başlatılıyor',
  'pairing.incomingRequest': 'Gelen Eşleştirme İsteği',
  'pairing.wantsToPair': '{device} eşleştirmek istiyor',
  'pairing.verifyHint': 'Kabul etmeden önce kodun telefonunuzdakiyle eşleştiğini doğrulayın',
  'pairing.accept': 'Kabul Et',
  'pairing.reject': 'Reddet',
  'pairing.title': 'Eşleştirme',
  'pairing.confirmCode': 'Bu kodun telefonunuzdakiyle eşleştiğini onaylayın',
  'pairing.connectionError': 'Bağlantı Hatası',
  'pairing.unexpectedError': 'Beklenmeyen bir hata oluştu',
  'pairing.autoRecover': 'Arka plan hizmeti otomatik olarak kurtarmayı deneyecek',
  'pairing.connectTitle': 'Telefonunuza Bağlanın',
  'pairing.searching': 'Cihazlar aranıyor...',
  'pairing.dontSeePhone': 'Telefonunuzu görmüyor musunuz?',
  'pairing.installApp': 'Kurun',
  'pairing.companionApp': 'FossLink yardımcı uygulaması',
  'pairing.sameWifi': 've aynı Wi-Fi ağına bağlanın.',
  'pairing.getStarted': 'FossLink ile Başlayın',
  'pairing.installDescription': 'Mesajlarınızı, kişilerinizi ve bildirimlerinizi bilgisayarınızla senkronize etmek için Android telefonunuza FossLink yardımcı uygulamasını kurun.',
  'pairing.qrAlt': 'FossLink yardımcı uygulamasını indirmek için QR kodu',
  'pairing.downloadApp': 'Yardımcı Uygulamayı İndir',
  'pairing.step1': 'Telefonunuza FossLink uygulamasını kurun',
  'pairing.step2': 'Uygulamayı açın ve aynı Wi-Fi ağında olduğunuzdan emin olun',
  'pairing.step3': 'Telefonunuz burada otomatik olarak görünecek',
  'pairing.dismiss': 'Kapat',

  // Device list
  'devices.pairedDevices': 'Eşleştirilmiş Cihazlar',
  'devices.offline': 'Çevrimdışı',
  'devices.unpair': 'Eşleştirmeyi Kaldır',
  'devices.nearbyDevices': 'Yakındaki Cihazlar',
  'devices.pair': 'Eşleştir',
  'devices.noDevices': 'Yakında cihaz bulunamadı',

  // Conversations
  'conversations.loading': 'Konuşmalar yükleniyor...',
  'conversations.noMatch': 'Aramanızla eşleşen konuşma yok',
  'conversations.empty': 'Henüz konuşma yok',

  // Search bar
  'search.placeholder': 'Konuşmalarda ara...',
  'search.clear': 'Aramayı temizle',
  'search.showUnread': 'Yalnızca okunmamışları göster',
  'search.showAll': 'Tüm konuşmaları göster',
  'search.filterSpam': 'Spam/bilinmeyen filtrele',

  // Message thread
  'messages.loading': 'Mesajlar yükleniyor...',
  'messages.empty': 'Bu konuşmada mesaj yok',
  'messages.sending': 'Gönderiliyor...',
  'messages.sent': 'Gönderildi',
  'messages.failed': 'Gönderilemedi',
  'messages.retry': 'Tekrar Dene',
  'messages.cancel': 'İptal',
  'messages.compose': 'Bir mesaj yazın...',
  'messages.send': 'Mesaj gönder',
  'messages.emoji': 'Emoji',

  // Export
  'export.tooltip': 'Konuşmayı dışa aktar',
  'export.txt': 'TXT olarak dışa aktar',
  'export.csv': 'CSV olarak dışa aktar',
  'export.csvHeader': 'Tarih,Gönderen,İçerik',
  'export.me': 'Ben',

  // Message bubble
  'bubble.saveAttachment': 'Eki kaydet',
  'bubble.mmsAlt': 'MMS eki',
  'bubble.videoAlt': 'Video',
  'bubble.failedToLoad': 'Yüklenemedi',
  'bubble.copyCode': '{code} kopyala',
  'bubble.codeCopied': '{code} panoya kopyalandı',

  // New conversation
  'newMessage.to': 'Kime:',
  'newMessage.changeRecipient': 'Alıcıyı değiştir',
  'newMessage.startNew': 'Yeni bir konuşma başlat',
  'newMessage.enterContact': 'Yukarıya bir kişi adı veya telefon numarası girin',

  // Contact autocomplete
  'contacts.placeholder': 'Ad veya telefon numarası yazın...',

  // Settings panel
  'settings.title': 'Ayarlar',
  'settings.close': 'Ayarları kapat',
  'settings.connection': 'Bağlantı',
  'settings.status': 'Durum',
  'settings.device': 'Cihaz',
  'settings.waitingDevice': 'Cihaz bekleniyor...',
  'settings.ipAddress': 'IP Adresi',
  'settings.type': 'Tür',
  'settings.statusConnected': 'Bağlı',
  'settings.statusReconnecting': 'Yeniden bağlanıyor',
  'settings.statusDisconnected': 'Bağlantı kesildi',
  'settings.notifications': 'Bildirimler',
  'settings.desktopNotifications': 'Masaüstü bildirimleri',
  'settings.flashTaskbar': 'Yeni mesajda görev çubuğunu yanıp söndür',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.language': 'Dil',
  'settings.languageAuto': 'Otomatik (sistemden algıla)',

  // Updates
  'updates.title': 'Güncellemeler',
  'updates.version': 'Sürüm',
  'updates.checkAuto': 'Otomatik kontrol et',
  'updates.checking': 'Güncellemeler kontrol ediliyor...',
  'updates.available': 'Sürüm {version} mevcut',
  'updates.upToDate': 'Güncelsiniz',
  'updates.downloading': 'İndiriliyor... {percent}%',
  'updates.ready': 'Sürüm {version} yüklenmeye hazır',
  'updates.error': 'Güncelleme hatası: {message}',
  'updates.checkBtn': 'Güncellemeleri Kontrol Et',
  'updates.checkingBtn': 'Kontrol ediliyor...',
  'updates.viewOnGithub': 'Güncellemeyi GitHub\'da Görüntüle',
  'updates.restartBtn': 'Güncellemek İçin Yeniden Başlat',

  // Update banner
  'banner.ready': 'Sürüm {version} yüklenmeye hazır.',
  'banner.restart': 'Güncellemek İçin Yeniden Başlat',
  'banner.later': 'Daha Sonra',

  // Device settings section
  'settings.deviceSection': 'Cihaz',
  'settings.unpairConfirm': '{device} ile eşleştirme kaldırılsın mı? FossLink kullanmak için tekrar eşleştirmeniz gerekecek.',
  'settings.unpairBtn': 'Eşleştirmeyi Kaldır',
  'settings.unpairing': 'Eşleştirme kaldırılıyor...',
  'settings.cancelBtn': 'İptal',
  'settings.unpairDevice': 'Cihaz Eşleştirmesini Kaldır',
  'settings.aboutBtn': 'FossLink Hakkında',

  // Find my phone
  'findPhone.close': 'Kapat',
  'findPhone.title': 'Telefonumu Bul',
  'findPhone.description': 'Bu, telefonunuzu sessiz modda olsa bile en yüksek sesle çaldıracak.',
  'findPhone.ring': 'Telefonu Çaldır',
  'findPhone.ringing': 'Çalıyor...',
  'findPhone.ringingDesc': 'Telefonunuz şimdi çalıyor olmalı.',
  'findPhone.ringAgain': 'Tekrar Çaldır',
  'findPhone.errorTitle': 'Telefon Çaldırılamadı',
  'findPhone.tryAgain': 'Tekrar Dene',

  // About dialog
  'about.close': 'Kapat',
  'about.name': 'FossLink',
  'about.version': 'Sürüm 0.1',
  'about.credit': '2026 Brian Hanson tarafından',
  'about.releasedUnder': 'Lisans altında yayınlanmıştır:',
  'about.mitLicense': 'MIT Lisansı',
  'about.acknowledgments': 'Teşekkürler',
  'about.ffmpegDesc': 'video dönüştürme ve küçük resim oluşturma',
  'about.electronDesc': 'çapraz platform masaüstü çerçevesi',
  'about.svelteDesc': 'reaktif kullanıcı arayüzü çerçevesi',
  'about.sourceAvailable': 'Tam lisans ve kaynak kodu şurada mevcuttur',
  'about.tagline': 'Bu yazılım açık kaynak ruhuyla, hayatınızı biraz daha kolaylaştırması umuduyla sunulmuştur.',

  // Notification
  'notification.newMessage': 'Yeni mesaj alındı',

  // Time formatting
  'time.today': 'Bugün',
  'time.yesterday': 'Dün',
}

export default tr
