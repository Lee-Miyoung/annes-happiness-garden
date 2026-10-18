앤의 행복 정원 · 업로드와 실행

같은 루트에 index.html, assets/ 전체, images/ 전체를 두세요.
앱에는 빌드나 API 키가 필요하지 않습니다.
로컬 실행: python3 -m http.server 8000
배포: 기존 GitHub Pages main / root 자동 배포

화면: 홈 / 감정일기 / 영어한입 / 마음우체통 / 행복정원
행복정원은 꽃을 심는 게임이 아니라 기록과 활동으로 장면이 열리는 감성 갤러리입니다.
기록은 기존 브라우저 localStorage 키를 유지하고, 예전 기록도 앱 하단 ‘내 기록 백업하기’로 받을 수 있습니다.
구조·장면 조건·검증 방법은 DEVELOPMENT.md에 있습니다.
