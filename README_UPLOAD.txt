앤의 행복 정원 · 업로드와 실행

필수 구조:
  index.html
  assets/ (app.js, content.js, garden.css, fonts.css, fonts/)
  images/

세 경로를 같은 저장소 루트에 올려주세요. 파일명은 대소문자까지 유지합니다.
앱은 별도 빌드 없이 실행되며, 로컬에서는 python3 -m http.server 8000 으로 확인합니다.
GitHub Pages는 기존 main / root 배포 설정을 사용합니다.

화면은 홈 / 감정일기 / 행복정원 / 마음우체통 / 영어한입의 다섯 가지입니다.
기록은 브라우저 localStorage에 보관합니다. 앱 하단의 ‘내 기록 백업하기’로 전체 기록을 JSON으로 받을 수 있습니다.
자세한 구조와 테스트 방법은 DEVELOPMENT.md에 있습니다.
