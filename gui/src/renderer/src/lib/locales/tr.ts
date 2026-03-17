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
  'messages.attach': 'Dosya ekle',
  'messages.removeAttachment': 'Eki kaldır',
  'messages.attachmentTooLarge': 'Toplam boyut MMS sınırını aşıyor. Mesaj gönderilemeyebilir.',
  'messages.attachmentTooMany': 'En fazla 10 ek izin verilir',

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
  'settings.service': 'Servis',
  'settings.storage': 'Boş alan',
  'settings.statusConnected': 'Bağlı',
  'settings.statusReconnecting': 'Yeniden bağlanıyor',
  'settings.statusDisconnected': 'Bağlantı kesildi',
  'settings.notifications': 'Bildirimler',
  'settings.desktopNotifications': 'Masaüstü bildirimleri',
  'settings.flashTaskbar': 'Yeni mesajda görev çubuğunu yanıp söndür',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.linkPreviews': 'Bağlantı önizlemelerini göster',

  // Language
  'settings.language': 'Dil',
  'settings.languageAuto': 'Otomatik (sistemden algıla)',

  // Theme
  'settings.theme': 'Tema',

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
  'about.version': 'Version 1.0.0',
  'about.credit': '2026 Brian Hanson tarafından',
  'about.releasedUnder': 'Lisans altında yayınlanmıştır:',
  'about.mitLicense': 'MIT Lisansı',
  'about.acknowledgments': 'Teşekkürler',
  'about.ffmpegDesc': 'video dönüştürme ve küçük resim oluşturma',
  'about.electronDesc': 'çapraz platform masaüstü çerçevesi',
  'about.svelteDesc': 'reaktif kullanıcı arayüzü çerçevesi',
  'about.sourceAvailable': 'Tam lisans ve kaynak kodu şurada mevcuttur',
  'about.androidApp': 'Get the Android companion app on',
  'about.googlePlay': 'Google Play',
  'about.tagline': 'Bu yazılım açık kaynak ruhuyla, hayatınızı biraz daha kolaylaştırması umuduyla sunulmuştur.',

  // Dial confirmation
  'dial.confirm': 'Telefonunuzdan {number} numarasını arayın?',
  'dial.ok': 'Tamam',
  'dial.cancel': 'İptal',
  'dial.callBtn': 'Ara',

  // URL sharing
  'app.shareUrl': 'Telefonda URL aç',
  'shareUrl.title': 'Telefonda URL aç',
  'shareUrl.placeholder': 'https://...',
  'shareUrl.cancel': 'İptal',
  'shareUrl.share': 'Paylaş',
  'shareUrl.invalidUrl': 'http:// veya https:// ile başlayan geçerli bir URL girin',

  // Resync
  'settings.resyncBtn': 'Yeniden senkronize et',

  // Version compatibility
  'version.companionUpdateRequired': 'Uygulama güncellemesi gerekli',
  'version.companionUpdateDesc': 'Telefonunuzdaki FossLink uygulaması (v{peerVersion}) bu FossLink Desktop sürümüyle (v{desktopVersion}) uyumlu değil. Lütfen uygulamayı güncelleyin.',
  'version.desktopUpdateRequired': 'Masaüstü güncellemesi gerekli',
  'version.desktopUpdateDesc': 'Bu FossLink Desktop sürümü (v{desktopVersion}) telefonunuzdaki FossLink uygulamasıyla (v{peerVersion}) uyumlu değil. Lütfen FossLink Desktop\'ı güncelleyin.',
  'version.updateCompanion': 'Uygulamayı güncelle',
  'version.downloadUpdate': 'Güncellemeyi indir',
  'version.orScanQR': 'Veya en son sürümü indirmek için telefonunuzla bu QR kodunu tarayın:',
  'version.sentToPhone': 'Güncelleme isteği telefona gönderildi',

  // Storage analyzer
  'storage.title': 'Depolama Analizörü',
  'storage.analyzing': 'Telefon depolaması analiz ediliyor...',
  'storage.analyzeBtn': 'Depolamayı analiz et',
  'storage.close': 'Kapat',
  'storage.free': '{total} GB\'den {free} GB boş',
  'storage.error': 'Depolama analizi başarısız',
  'storage.noRoot': 'Ayrıntılı analiz için telefonunuzda Root entegrasyonunu etkinleştirin.',

  // Extras section
  'extras.title': 'Ekstralar',
  'extras.storageTitle': 'Depolama Gezgini',
  'extras.storageSubtitle': 'Depolama kullanımını analiz et',
  'extras.filesTitle': 'Telefon Dosyaları',
  'extras.filesSubtitle': 'Dosya sistemini gözat',
  'extras.filesMounted': 'Bağlı',
  'extras.migrationTitle': 'Kişi Taşıma',
  'extras.migrationSubtitle': 'Cihaz kişilerini Google\'a taşı',

  // Contact migration
  'migration.title': 'Kişi Taşıma',
  'migration.intro': 'Cihazınızda veya SIM kartınızda kayıtlı olup Google Kişiler\'e yedeklenmemiş kişileri bulun ve taşıyın.',
  'migration.scanBtn': 'Cihaz kişilerini tara',
  'migration.scanning': 'Telefondaki kişiler taranıyor...',
  'migration.found': 'Yalnızca cihazda {count} kişi bulundu',
  'migration.migrateTo': 'Taşınacak yer: {account}',
  'migration.noGoogle': 'Telefonda Google hesabı bulunamadı.',
  'migration.selectAll': 'Tümünü seç ({count})',
  'migration.migrateBtn': '{count} kişiyi Google\'a taşı',
  'migration.migrating': 'Kişiler taşınıyor...',
  'migration.success': '{count} kişi başarıyla taşındı.',
  'migration.failed': '{count} kişi başarısız oldu.',
  'migration.allGood': 'Tüm kişiler zaten Google\'da yedeklenmiş.',
  'migration.done': 'Bitti',
  'migration.retry': 'Tekrar dene',

  // Gallery
  'app.gallery': 'Telefon Galerisi',
  'gallery.title': 'Telefon Galerisi',
  'gallery.close': 'Galeriyi kapat',
  'gallery.viewDcim': 'DCIM',
  'gallery.viewScreenshots': 'Ekran görüntüleri',
  'gallery.viewFolders': 'Klasörler',
  'gallery.viewAll': 'Tümü',
  'gallery.sizeSmall': 'Küçük küçük resimler',
  'gallery.sizeLarge': 'Büyük küçük resimler',
  'gallery.toggleHidden': 'Gizli dosyaları göster/gizle',
  'gallery.scanning': 'Telefon galerisi taranıyor...',
  'gallery.retry': 'Tekrar dene',
  'gallery.empty': 'Medya bulunamadı',
  'gallery.noFolders': 'Klasör bulunamadı',

  // Notification
  'notification.newMessage': 'Yeni mesaj alındı',

  // Time formatting
  'time.today': 'Bugün',
  'time.yesterday': 'Dün',
}

export default tr
