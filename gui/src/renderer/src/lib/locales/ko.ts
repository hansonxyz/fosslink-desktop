/**
 * Korean (한국어) translations.
 * All keys must match en.ts exactly.
 */
export const ko: Record<string, string> = {
  // App chrome
  'app.title': 'FossLink',
  'app.about': 'FossLink 정보',
  'app.newMessage': '새 메시지',
  'app.findPhone': '내 폰 찾기',
  'app.syncMessages': '메시지 동기화',
  'app.settings': '설정',
  'app.sidebarPlaceholder': '대화를 보려면 기기를 연결하세요',
  'app.sidebarPlaceholderAlt': '대화가 여기에 표시됩니다',
  'app.emptyState': '대화를 선택하여 메시지를 시작하세요',

  // Status indicator
  'status.noDaemon': '데몬이 실행 중이 아닙니다',
  'status.disconnected': '연결된 기기 없음',
  'status.discovering': '기기 검색 중...',
  'status.pairing': '페어링 중...',
  'status.connected': '기기 연결됨',
  'status.syncing': '동기화 중...',
  'status.ready': '준비 완료',
  'status.error': '오류',

  // Pairing page
  'pairing.starting': '시작 중...',
  'pairing.initializing': 'FossLink 초기화 중',
  'pairing.incomingRequest': '수신 페어링 요청',
  'pairing.wantsToPair': '{device}에서 페어링을 요청합니다',
  'pairing.verifyHint': '수락하기 전에 휴대폰의 코드가 일치하는지 확인하세요',
  'pairing.accept': '수락',
  'pairing.reject': '거절',
  'pairing.title': '페어링',
  'pairing.confirmCode': '이 코드가 휴대폰과 일치하는지 확인하세요',
  'pairing.connectionError': '연결 오류',
  'pairing.unexpectedError': '예기치 않은 오류가 발생했습니다',
  'pairing.autoRecover': '데몬이 자동으로 복구를 시도합니다',
  'pairing.connectTitle': '휴대폰에 연결',
  'pairing.searching': '기기 검색 중...',
  'pairing.dontSeePhone': '휴대폰이 보이지 않나요?',
  'pairing.installApp': '',
  'pairing.companionApp': 'FossLink 동반 앱',
  'pairing.sameWifi': '을 설치하고 같은 Wi-Fi 네트워크에 연결하세요.',
  'pairing.getStarted': 'FossLink 시작하기',
  'pairing.installDescription': 'Android 휴대폰에 FossLink 동반 앱을 설치하여 메시지, 연락처, 알림을 컴퓨터와 동기화하세요.',
  'pairing.qrAlt': 'FossLink 동반 앱을 다운로드하는 QR 코드',
  'pairing.downloadApp': '동반 앱 다운로드',
  'pairing.step1': '휴대폰에 FossLink 앱 설치',
  'pairing.step2': '앱을 열고 같은 Wi-Fi 네트워크에 연결되어 있는지 확인',
  'pairing.step3': '휴대폰이 자동으로 여기에 표시됩니다',
  'pairing.dismiss': '닫기',

  // Device list
  'devices.pairedDevices': '페어링된 기기',
  'devices.offline': '오프라인',
  'devices.unpair': '페어링 해제',
  'devices.nearbyDevices': '주변 기기',
  'devices.pair': '페어링',
  'devices.noDevices': '주변에서 기기를 찾을 수 없습니다',

  // Conversations
  'conversations.loading': '대화 로딩 중...',
  'conversations.noMatch': '검색과 일치하는 대화가 없습니다',
  'conversations.empty': '대화가 아직 없습니다',

  // Search bar
  'search.placeholder': '대화 검색...',
  'search.clear': '검색 지우기',
  'search.showUnread': '읽지 않은 항목만 표시',
  'search.showAll': '모든 대화 표시',
  'search.filterSpam': '스팸/모르는 번호 필터',

  // Message thread
  'messages.loading': '메시지 로딩 중...',
  'messages.empty': '이 대화에 메시지가 없습니다',
  'messages.sending': '전송 중...',
  'messages.sent': '전송됨',
  'messages.failed': '전송 실패',
  'messages.retry': '재시도',
  'messages.cancel': '취소',
  'messages.compose': '메시지를 입력하세요...',
  'messages.send': '메시지 보내기',
  'messages.emoji': '이모지',

  // Export
  'export.tooltip': '대화 내보내기',
  'export.txt': 'TXT로 내보내기',
  'export.csv': 'CSV로 내보내기',
  'export.csvHeader': '날짜,보낸사람,내용',
  'export.me': '나',

  // Message bubble
  'bubble.saveAttachment': '첨부 파일 저장',
  'bubble.mmsAlt': 'MMS 첨부 파일',
  'bubble.videoAlt': '동영상',
  'bubble.failedToLoad': '로드 실패',
  'bubble.copyCode': '{code} 복사',
  'bubble.codeCopied': '{code}이(가) 클립보드에 복사되었습니다',

  // New conversation
  'newMessage.to': '받는 사람:',
  'newMessage.changeRecipient': '수신자 변경',
  'newMessage.startNew': '새 대화 시작',
  'newMessage.enterContact': '위에 연락처 이름이나 전화번호를 입력하세요',

  // Contact autocomplete
  'contacts.placeholder': '이름 또는 전화번호를 입력...',

  // Settings panel
  'settings.title': '설정',
  'settings.close': '설정 닫기',
  'settings.connection': '연결',
  'settings.status': '상태',
  'settings.device': '기기',
  'settings.waitingDevice': '기기 대기 중...',
  'settings.ipAddress': 'IP 주소',
  'settings.type': '유형',
  'settings.statusConnected': '연결됨',
  'settings.statusReconnecting': '재연결 중',
  'settings.statusDisconnected': '연결 안 됨',
  'settings.notifications': '알림',
  'settings.desktopNotifications': '데스크톱 알림',
  'settings.flashTaskbar': '새 메시지 시 작업 표시줄 깜빡임',
  'settings.flashTaskbarHint': '(Windows)',
  'settings.language': '언어',
  'settings.languageAuto': '자동 (시스템에서 감지)',

  // Updates
  'updates.title': '업데이트',
  'updates.version': '버전',
  'updates.checkAuto': '자동으로 확인',
  'updates.checking': '업데이트 확인 중...',
  'updates.available': '버전 {version} 사용 가능',
  'updates.upToDate': '최신 버전입니다',
  'updates.downloading': '다운로드 중... {percent}%',
  'updates.ready': '버전 {version} 설치 준비 완료',
  'updates.error': '업데이트 오류: {message}',
  'updates.checkBtn': '업데이트 확인',
  'updates.checkingBtn': '확인 중...',
  'updates.viewOnGithub': 'GitHub에서 업데이트 보기',
  'updates.restartBtn': '재시작하여 업데이트',

  // Update banner
  'banner.ready': '버전 {version} 설치 준비가 되었습니다.',
  'banner.restart': '재시작하여 업데이트',
  'banner.later': '나중에',

  // Device settings section
  'settings.deviceSection': '기기',
  'settings.unpairConfirm': '{device}의 페어링을 해제하시겠습니까? FossLink를 사용하려면 다시 페어링해야 합니다.',
  'settings.unpairBtn': '페어링 해제',
  'settings.unpairing': '페어링 해제 중...',
  'settings.cancelBtn': '취소',
  'settings.unpairDevice': '기기 페어링 해제',
  'settings.aboutBtn': 'FossLink 정보',

  // Find my phone
  'findPhone.close': '닫기',
  'findPhone.title': '내 폰 찾기',
  'findPhone.description': '무음 모드에서도 휴대폰이 최대 볼륨으로 울립니다.',
  'findPhone.ring': '휴대폰 울리기',
  'findPhone.ringing': '울리는 중...',
  'findPhone.ringingDesc': '휴대폰이 지금 울리고 있을 것입니다.',
  'findPhone.ringAgain': '다시 울리기',
  'findPhone.errorTitle': '휴대폰을 울릴 수 없습니다',
  'findPhone.tryAgain': '다시 시도',

  // About dialog
  'about.close': '닫기',
  'about.name': 'FossLink',
  'about.version': '버전 0.1',
  'about.credit': '2026 Brian Hanson',
  'about.releasedUnder': '라이선스:',
  'about.mitLicense': 'MIT 라이선스',
  'about.acknowledgments': '감사의 말',
  'about.ffmpegDesc': '비디오 트랜스코딩 및 썸네일 생성',
  'about.electronDesc': '크로스 플랫폼 데스크톱 프레임워크',
  'about.svelteDesc': '리액티브 UI 프레임워크',
  'about.sourceAvailable': '전체 라이선스 및 소스 코드:',
  'about.tagline': '이 소프트웨어는 오픈 소스 정신으로 제공되며, 여러분의 삶을 조금이나마 편하게 만들어 드리기를 바랍니다.',

  // Notification
  'notification.newMessage': '새 메시지를 수신했습니다',

  // Time formatting
  'time.today': '오늘',
  'time.yesterday': '어제',
}

export default ko
