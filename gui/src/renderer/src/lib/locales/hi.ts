/**
 * Hindi translations for FossLink GUI.
 * All keys must match the English source (en.ts).
 */
export const hi: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'FossLink के बारे में',
  'app.newMessage': 'नया संदेश',
  'app.findPhone': 'मेरा फ़ोन ढूँढें',
  'app.syncMessages': 'संदेश सिंक करें',
  'app.settings': 'सेटिंग्स',
  'app.sidebarPlaceholder': 'बातचीत देखने के लिए एक डिवाइस कनेक्ट करें',
  'app.sidebarPlaceholderAlt': 'बातचीत यहाँ दिखाई देगी',
  'app.emptyState': 'मैसेजिंग शुरू करने के लिए एक बातचीत चुनें',

  // Status indicator
  'status.noDaemon': 'डेमन नहीं चल रहा',
  'status.disconnected': 'कोई डिवाइस कनेक्ट नहीं है',
  'status.discovering': 'डिवाइस खोज रहे हैं...',
  'status.pairing': 'पेयरिंग हो रही है...',
  'status.connected': 'डिवाइस कनेक्ट है',
  'status.syncing': 'सिंक हो रहा है...',
  'status.ready': 'तैयार',
  'status.error': 'त्रुटि',

  // Pairing page
  'pairing.starting': 'शुरू हो रहा है...',
  'pairing.initializing': 'FossLink शुरू हो रहा है',
  'pairing.incomingRequest': 'आने वाला पेयरिंग अनुरोध',
  'pairing.wantsToPair': '{device} पेयर करना चाहता है',
  'pairing.verifyHint': 'स्वीकार करने से पहले अपने फ़ोन पर कोड का मिलान सत्यापित करें',
  'pairing.accept': 'स्वीकार करें',
  'pairing.reject': 'अस्वीकार करें',
  'pairing.title': 'पेयरिंग',
  'pairing.confirmCode': 'पुष्टि करें कि यह कोड आपके फ़ोन पर मेल खाता है',
  'pairing.connectionError': 'कनेक्शन त्रुटि',
  'pairing.unexpectedError': 'एक अप्रत्याशित त्रुटि हुई',
  'pairing.autoRecover': 'डेमन स्वचालित रूप से पुनर्प्राप्त करने का प्रयास करेगा',
  'pairing.connectTitle': 'अपने फ़ोन से कनेक्ट करें',
  'pairing.searching': 'डिवाइस खोज रहे हैं...',
  'pairing.dontSeePhone': 'अपना फ़ोन नहीं दिख रहा?',
  'pairing.installApp': 'इंस्टॉल करें',
  'pairing.companionApp': 'FossLink साथी ऐप',
  'pairing.sameWifi': 'और उसी Wi-Fi नेटवर्क से कनेक्ट करें।',
  'pairing.getStarted': 'FossLink के साथ शुरू करें',
  'pairing.installDescription': 'अपने संदेशों, संपर्कों और सूचनाओं को अपने कंप्यूटर के साथ सिंक करने के लिए अपने Android फ़ोन पर FossLink साथी ऐप इंस्टॉल करें।',
  'pairing.qrAlt': 'FossLink साथी ऐप डाउनलोड करने के लिए QR कोड',
  'pairing.downloadApp': 'साथी ऐप डाउनलोड करें',
  'pairing.step1': 'अपने फ़ोन पर FossLink ऐप इंस्टॉल करें',
  'pairing.step2': 'ऐप खोलें और सुनिश्चित करें कि आप उसी Wi-Fi नेटवर्क पर हैं',
  'pairing.step3': 'आपका फ़ोन यहाँ स्वचालित रूप से दिखाई देगा',
  'pairing.dismiss': 'खारिज करें',

  // Device list
  'devices.pairedDevices': 'पेयर किए गए डिवाइस',
  'devices.offline': 'ऑफ़लाइन',
  'devices.unpair': 'अनपेयर',
  'devices.nearbyDevices': 'पास के डिवाइस',
  'devices.pair': 'पेयर',
  'devices.noDevices': 'पास में कोई डिवाइस नहीं मिला',

  // Conversations
  'conversations.loading': 'बातचीत लोड हो रही हैं...',
  'conversations.noMatch': 'आपकी खोज से कोई बातचीत मेल नहीं खाती',
  'conversations.empty': 'अभी तक कोई बातचीत नहीं',

  // Search bar
  'search.placeholder': 'बातचीत खोजें...',
  'search.clear': 'खोज साफ़ करें',
  'search.showUnread': 'केवल अपठित दिखाएँ',
  'search.showAll': 'सभी बातचीत दिखाएँ',
  'search.filterSpam': 'स्पैम/अज्ञात फ़िल्टर करें',

  // Message thread
  'messages.loading': 'संदेश लोड हो रहे हैं...',
  'messages.empty': 'इस बातचीत में कोई संदेश नहीं',
  'messages.sending': 'भेज रहे हैं...',
  'messages.sent': 'भेजा गया',
  'messages.failed': 'भेजने में विफल',
  'messages.retry': 'पुनः प्रयास',
  'messages.cancel': 'रद्द करें',
  'messages.compose': 'संदेश लिखें...',
  'messages.send': 'संदेश भेजें',
  'messages.emoji': 'इमोजी',
  'messages.attach': 'फ़ाइल संलग्न करें',
  'messages.removeAttachment': 'संलग्नक हटाएं',
  'messages.attachmentTooLarge': 'कुल आकार MMS सीमा से अधिक है। संदेश विफल हो सकता है।',
  'messages.attachmentTooMany': 'अधिकतम 10 संलग्नक अनुमत',

  // Export
  'export.tooltip': 'बातचीत निर्यात करें',
  'export.txt': 'TXT के रूप में निर्यात',
  'export.csv': 'CSV के रूप में निर्यात',
  'export.csvHeader': 'तारीख,प्रेषक,संदेश',
  'export.me': 'मैं',

  // Message bubble
  'bubble.saveAttachment': 'अटैचमेंट सहेजें',
  'bubble.mmsAlt': 'MMS अटैचमेंट',
  'bubble.videoAlt': 'वीडियो',
  'bubble.failedToLoad': 'लोड करने में विफल',
  'bubble.copyCode': '{code} कॉपी करें',
  'bubble.codeCopied': '{code} क्लिपबोर्ड पर कॉपी हुआ',

  // New conversation
  'newMessage.to': 'प्रति:',
  'newMessage.changeRecipient': 'प्राप्तकर्ता बदलें',
  'newMessage.startNew': 'नई बातचीत शुरू करें',
  'newMessage.enterContact': 'ऊपर संपर्क नाम या फ़ोन नंबर दर्ज करें',

  // Contact autocomplete
  'contacts.placeholder': 'नाम या फ़ोन नंबर लिखें...',

  // Settings panel
  'settings.title': 'सेटिंग्स',
  'settings.close': 'सेटिंग्स बंद करें',
  'settings.connection': 'कनेक्शन',
  'settings.status': 'स्थिति',
  'settings.device': 'डिवाइस',
  'settings.waitingDevice': 'डिवाइस की प्रतीक्षा...',
  'settings.ipAddress': 'IP पता',
  'settings.type': 'प्रकार',
  'settings.service': 'सेवा',
  'settings.storage': 'उपलब्ध स्टोरेज',
  'settings.statusConnected': 'कनेक्टेड',
  'settings.statusReconnecting': 'पुनः कनेक्ट हो रहा है',
  'settings.statusDisconnected': 'डिस्कनेक्टेड',
  'settings.notifications': 'सूचनाएँ',
  'settings.desktopNotifications': 'डेस्कटॉप सूचनाएँ',
  'settings.flashTaskbar': 'नए संदेश पर टास्कबार फ्लैश करें',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.linkPreviews': 'लिंक प्रीव्यू दिखाएं',

  // Language
  'settings.language': 'भाषा',
  'settings.languageAuto': 'स्वचालित (सिस्टम से पता लगाएँ)',

  // Theme
  'settings.theme': 'थीम',

  // Updates
  'updates.title': 'अपडेट',
  'updates.version': 'संस्करण',
  'updates.checkAuto': 'स्वचालित रूप से जाँचें',
  'updates.checking': 'अपडेट की जाँच हो रही है...',
  'updates.available': 'संस्करण {version} उपलब्ध है',
  'updates.upToDate': 'आप अद्यतित हैं',
  'updates.downloading': 'डाउनलोड हो रहा है... {percent}%',
  'updates.ready': 'संस्करण {version} इंस्टॉल के लिए तैयार',
  'updates.error': 'अपडेट त्रुटि: {message}',
  'updates.checkBtn': 'अपडेट की जाँच करें',
  'updates.checkingBtn': 'जाँच हो रही है...',
  'updates.viewOnGithub': 'GitHub पर अपडेट देखें',
  'updates.restartBtn': 'अपडेट के लिए पुनः आरंभ करें',

  // Update banner
  'banner.ready': 'संस्करण {version} इंस्टॉल के लिए तैयार है।',
  'banner.restart': 'अपडेट के लिए पुनः आरंभ करें',
  'banner.later': 'बाद में',

  // Device settings section
  'settings.deviceSection': 'डिवाइस',
  'settings.unpairConfirm': '{device} से अनपेयर करें? FossLink का उपयोग करने के लिए आपको फिर से पेयर करना होगा।',
  'settings.unpairBtn': 'अनपेयर',
  'settings.unpairing': 'अनपेयर हो रहा है...',
  'settings.cancelBtn': 'रद्द करें',
  'settings.unpairDevice': 'डिवाइस अनपेयर करें',
  'settings.aboutBtn': 'FossLink के बारे में',

  // Find my phone
  'findPhone.close': 'बंद करें',
  'findPhone.title': 'मेरा फ़ोन ढूँढें',
  'findPhone.description': 'यह आपके फ़ोन को पूरी आवाज़ में बजाएगा, भले ही वह साइलेंट पर हो।',
  'findPhone.ring': 'फ़ोन बजाएँ',
  'findPhone.ringing': 'बज रहा है...',
  'findPhone.ringingDesc': 'आपका फ़ोन अभी बज रहा होगा।',
  'findPhone.ringAgain': 'फिर से बजाएँ',
  'findPhone.errorTitle': 'फ़ोन नहीं बजा सका',
  'findPhone.tryAgain': 'पुनः प्रयास करें',

  // About dialog
  'about.close': 'बंद करें',
  'about.name': 'FossLink',
  'about.version': 'Version 1.0.0',
  'about.credit': '2026 Brian Hanson द्वारा',
  'about.releasedUnder': 'के तहत जारी',
  'about.mitLicense': 'MIT लाइसेंस',
  'about.acknowledgments': 'आभार',
  'about.ffmpegDesc': 'वीडियो ट्रांसकोडिंग और थंबनेल जनरेशन',
  'about.electronDesc': 'क्रॉस-प्लेटफ़ॉर्म डेस्कटॉप फ्रेमवर्क',
  'about.svelteDesc': 'रिएक्टिव UI फ्रेमवर्क',
  'about.sourceAvailable': 'पूर्ण लाइसेंस और स्रोत यहाँ उपलब्ध है',
  'about.androidApp': 'Get the Android companion app on',
  'about.googlePlay': 'Google Play',
  'about.tagline': 'यह सॉफ़्टवेयर ओपन सोर्स की भावना से प्रदान किया गया है, इस आशा में कि यह आपके जीवन को थोड़ा आसान बना दे।',

  // Dial confirmation
  'dial.confirm': 'फ़ोन पर {number} को कॉल करें?',
  'dial.ok': 'ठीक है',
  'dial.cancel': 'रद्द करें',
  'dial.callBtn': 'कॉल',

  // URL sharing
  'app.shareUrl': 'फ़ोन पर URL खोलें',
  'shareUrl.title': 'फ़ोन पर URL खोलें',
  'shareUrl.placeholder': 'https://...',
  'shareUrl.cancel': 'रद्द करें',
  'shareUrl.share': 'शेयर',
  'shareUrl.invalidUrl': 'http:// या https:// से शुरू होने वाला मान्य URL दर्ज करें',

  // Resync
  'settings.resyncBtn': 'पुन: सिंक करें',

  // Version compatibility
  'version.companionUpdateRequired': 'ऐप अपडेट आवश्यक',
  'version.companionUpdateDesc': 'आपके फ़ोन का FossLink ऐप (v{peerVersion}) FossLink Desktop (v{desktopVersion}) के इस संस्करण के साथ संगत नहीं है। कृपया ऐप अपडेट करें।',
  'version.desktopUpdateRequired': 'डेस्कटॉप अपडेट आवश्यक',
  'version.desktopUpdateDesc': 'FossLink Desktop (v{desktopVersion}) का यह संस्करण आपके फ़ोन के FossLink ऐप (v{peerVersion}) के साथ संगत नहीं है। कृपया FossLink Desktop अपडेट करें।',
  'version.updateCompanion': 'ऐप अपडेट करें',
  'version.downloadUpdate': 'अपडेट डाउनलोड करें',
  'version.orScanQR': 'या नवीनतम संस्करण डाउनलोड करने के लिए अपने फ़ोन पर यह QR कोड स्कैन करें:',
  'version.sentToPhone': 'अपडेट अनुरोध फ़ोन पर भेजा गया',

  // Storage analyzer
  'storage.title': 'स्टोरेज विश्लेषक',
  'storage.analyzing': 'फ़ोन स्टोरेज का विश्लेषण...',
  'storage.analyzeBtn': 'स्टोरेज विश्लेषण',
  'storage.close': 'बंद करें',
  'storage.free': '{total} GB में से {free} GB उपलब्ध',
  'storage.error': 'स्टोरेज विश्लेषण विफल',
  'storage.noRoot': 'विस्तृत विश्लेषण के लिए अपने फ़ोन पर Root एकीकरण सक्षम करें।',

  // Extras section
  'extras.title': 'अतिरिक्त',
  'extras.storageTitle': 'स्टोरेज एक्सप्लोरर',
  'extras.storageSubtitle': 'स्टोरेज उपयोग का विश्लेषण',
  'extras.filesTitle': 'फ़ोन फ़ाइलें',
  'extras.filesSubtitle': 'फ़ाइल सिस्टम ब्राउज़ करें',
  'extras.filesMounted': 'माउंट किया गया',
  'extras.migrationTitle': 'संपर्क माइग्रेशन',
  'extras.migrationSubtitle': 'डिवाइस संपर्कों को Google में ले जाएं',

  // Contact migration
  'migration.title': 'संपर्क माइग्रेशन',
  'migration.intro': 'अपने डिवाइस या SIM पर संग्रहीत संपर्कों को खोजें जो Google Contacts में बैकअप नहीं हैं, और उन्हें माइग्रेट करें।',
  'migration.scanBtn': 'डिवाइस संपर्क खोजें',
  'migration.scanning': 'फ़ोन पर संपर्क स्कैन हो रहे हैं...',
  'migration.found': 'केवल डिवाइस पर {count} संपर्क मिले',
  'migration.migrateTo': 'माइग्रेट करें: {account}',
  'migration.noGoogle': 'फ़ोन पर कोई Google खाता नहीं मिला।',
  'migration.selectAll': 'सभी चुनें ({count})',
  'migration.migrateBtn': '{count} संपर्कों को Google में माइग्रेट करें',
  'migration.migrating': 'संपर्क माइग्रेट हो रहे हैं...',
  'migration.success': '{count} संपर्क सफलतापूर्वक माइग्रेट हुए।',
  'migration.failed': '{count} संपर्क विफल हुए।',
  'migration.allGood': 'सभी संपर्क पहले से Google में बैकअप हैं।',
  'migration.done': 'हो गया',
  'migration.retry': 'पुनः प्रयास',

  // Gallery
  'app.gallery': 'फ़ोन गैलरी',
  'gallery.title': 'फ़ोन गैलरी',
  'gallery.close': 'गैलरी बंद करें',
  'gallery.viewDcim': 'DCIM',
  'gallery.viewScreenshots': 'स्क्रीनशॉट',
  'gallery.viewFolders': 'फ़ोल्डर',
  'gallery.viewAll': 'सभी',
  'gallery.sizeSmall': 'छोटे थंबनेल',
  'gallery.sizeLarge': 'बड़े थंबनेल',
  'gallery.toggleHidden': 'छिपी फ़ाइलें टॉगल करें',
  'gallery.scanning': 'फ़ोन गैलरी स्कैन हो रही है...',
  'gallery.retry': 'पुनः प्रयास',
  'gallery.empty': 'कोई मीडिया नहीं मिला',
  'gallery.noFolders': 'कोई फ़ोल्डर नहीं मिला',

  // Notification
  'notification.newMessage': 'नया संदेश प्राप्त हुआ',

  // Time formatting
  'time.today': 'आज',
  'time.yesterday': 'कल',
}

export default hi
