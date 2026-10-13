앤의 행복 정원 - GitHub 업로드 방법

[최종 폴더 구조]
저장소 루트/
  index.html
  images/
    backgrounds/
    characters/
    decor/
    growth/
    objects/
    pets/
    plants/
    ui/

1. GitHub에서 앤의 행복 정원 저장소를 엽니다.
2. 기존 index.html이 있다면 이번 index.html로 교체합니다.
3. images 폴더를 통째로 저장소 루트에 올립니다.
   - images/backgrounds/... 가 되어야 합니다.
   - images/images/backgrounds 처럼 images가 두 번 겹치면 안 됩니다.
4. Commit changes를 누릅니다.
5. GitHub Pages를 사용한다면 Settings > Pages에서 배포 소스가 main / root인지 확인합니다.
6. 배포 뒤 Ctrl+F5(모바일은 새로고침)로 캐시를 갱신합니다.

[중요]
- index.html과 images 폴더는 같은 위치(저장소 루트)에 있어야 합니다.
- 파일명은 대소문자까지 그대로 유지합니다.
- 기존 브라우저에 저장된 일기/씨앗/별 데이터는 localStorage 키를 유지했기 때문에 이어집니다.
- 웹 기록은 브라우저 로컬 저장입니다. '나의 그림책 > 내 기록 백업하기'로 JSON 백업이 가능합니다.

[이번 index에서 실제 사용하는 폴더]
backgrounds: 메인 정원, 숲길/밤길/바다/글방 배경
characters: 앤의 감정/행동별 캐릭터
pets: 강아지 캐릭터
plants: 정원에서 선택하고 심는 꽃
objects: 우체통, 벤치, 책장, 엽서 등 집 꾸미기
ui: 버튼/책/지도/물뿌리개 등 인터페이스
 growth: 성장 단계
 decor: 꽃 가랜드/장식
