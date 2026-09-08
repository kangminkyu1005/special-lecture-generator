# PLAYWELL 안내문 스튜디오

분기 안내문: https://special-lecture-generator.rotmxm.chatgpt.site/quarterly-notice.html

기존 대회·특강 생성기는 그대로 유지되며 상단 링크로 두 생성기를 이동할 수 있습니다.

## 분기 안내문

- 연도·분기·첫 수업일·수업 주 수(기본 12주)·수업 요일(기본 화~토)을 입력합니다.
- 첫 수업일부터 7일씩 수업 주를 묶습니다. 지정한 휴원 기간이 수업일과 겹치면 해당 주 전체를 건너뜁니다. 공휴일 자체는 수업을 제외하지 않습니다.
- 1~4주차 색상은 월 경계와 무관하게 이어집니다. 달력은 해당 분기 3개월만 표시하며, 기간 문구는 실제 마지막 수업일까지 표시합니다.
- ‘다음 분기 생성’은 현재 분기를 보관하고 마지막 수업일 다음의 수업 요일부터 시작합니다. 이전 분기의 월 경계 수업일과 색상을 이어받습니다. 다음 분기의 휴원 기간과 행사는 다시 확인합니다.
- 보강은 기본 2·4주차 토요일 오후 4시이며, 각 4주 묶음에서 한 번씩 총 3회입니다. 휴원이나 일정 충돌은 날짜 버튼의 달력에서 직접 지정합니다. 분기 밖 날짜도 가능합니다. 12주 미만이면 부족한 보강일은 미정으로 표시합니다.
- PNG(약 2807×1985), A4 가로 PDF(1페이지), 인쇄, 완성 안내문 HTML을 저장할 수 있습니다. 내용이 한 장을 넘으면 경고하고 PNG·PDF 저장을 막습니다. ‘일정·디자인 → 글자 크기’를 조정하거나 문구를 줄여 주세요.
- 입력은 현재 브라우저에 자동 저장됩니다. ‘현재 분기 보관’으로 최대 40개를 보관하고, 설정 JSON 파일을 저장·열어 다른 기기로 옮길 수 있습니다. 브라우저 데이터 삭제 시 로컬 저장본은 사라집니다. 설정 내용은 서버로 전송하지 않습니다.

분기 생성기는 JavaScript 모듈을 사용하므로 파일을 더블클릭하는 대신 위 사이트 또는 로컬 웹서버에서 실행하세요. 완성 안내문 HTML은 별도로 열 수 있습니다. PDF는 고해상도 이미지 기반이므로 텍스트 검색은 지원하지 않습니다.

### 개발 및 검증

Node.js 22 이상, pnpm 사용: `pnpm install`, `pnpm test`, `pnpm dev`, `pnpm build`.
편집 원본은 `outputs/quarterly-*`이며 `build/prepare-assets.mjs`가 다운로드 라이브러리를 묶고 `outputs/` 파일을 `public/`으로 복사합니다. 생성 파일을 직접 수정하지 마세요.

계산 테스트는 2026년 4분기(10/6~12/26), 제공된 3분기 휴원 예시(6/30~10/3), 다음 분기 이월, 부분·중복 휴원, 비연속 요일, 윤년, 수동 보강일을 포함합니다. 브라우저에서 주차 이월·날짜 선택·저장 복원·PNG/PDF 다운로드를 검수했습니다.

### 공휴일 후보와 라이선스

2020~2045년 후보는 [python-holidays](https://holidays.readthedocs.io/en/dev/auto_gen_docs/south_korea/) 0.94(MIT)에서 생성한 정적 데이터입니다. 법정 날짜의 최종 보증 자료가 아니므로 신규 임시공휴일·변경 사항은 직접 추가/수정합니다. 기준 자료: [우주항공청 2026년 월력요항](https://www.kasa.go.kr/prog/bbsArticle/BBSMSTR_000000000010/view.do?bbsId=BBSMSTR_000000000010&nttId=B000000001860Pe2zT3).
데이터 갱신: `build/requirements-holidays.txt`의 버전을 검토하고 Python 의존성을 설치한 뒤 `python build/generate-holidays.py`, `pnpm build`를 실행합니다.
이미지/PDF 생성은 html2canvas 1.4.1(MIT), jsPDF 3.0.3(MIT)를 사용하며 번들에 원래 라이선스 주석을 유지합니다. 글꼴은 Google Fonts의 Noto Sans KR(SIL OFL), 불러오지 못하면 기기 기본 한글 글꼴로 대체됩니다.

## 기존 대회·특강 생성기

대회 및 특강 안내문을 브라우저에서 작성하고 미리 볼 수 있는 단일 HTML 도구와 관련 디자인 자산을 보관합니다.

## 사용 방법

1. `outputs/special-lecture-generator.html`을 웹 브라우저로 엽니다.
2. `대회 정보` 탭에 대회 관련 내용을 입력합니다.
3. `특강 및 신청 정보` 탭에 특강 일정과 신청 내용을 함께 입력합니다.
4. 오른쪽 미리보기에서 통합된 안내문을 확인합니다.

별도의 설치나 빌드 과정은 필요하지 않습니다. Google Fonts를 불러오기 위해 처음 열 때 인터넷 연결이 사용될 수 있습니다.

ChatGPT Sites 배포용 소스가 함께 구성되어 있으며, 사이트 루트 주소는 최종 생성기 HTML로 연결됩니다.

## 파일 구성

- `outputs/special-lecture-generator.html`: 최종 특강 안내문 생성기
- `outputs/playwell-official-logo-main.png`: 플레이웰 공식 로고
- `outputs/playwell-korea-logo.png`: 플레이웰 코리아 로고
- `outputs/contest-logo-default.png`: 이전 디자인용 기본 대회 로고 보관본
- `outputs/special-lecture-template.svg`: 안내문 원본 벡터 템플릿
- `outputs/special-lecture-template.png`: 안내문 미리보기 이미지
- `work/special-lecture-generator-check.js`: 작업 과정에서 생성된 보조 스크립트 보관본
- `app/`, `package.json`: ChatGPT Sites용 최소 Next.js 진입점
- `public/`: ChatGPT Sites에서 제공되는 생성기와 이미지 자산
- `.openai/hosting.json`: ChatGPT Sites 프로젝트 연결 정보

## 참고

`work/`의 스크립트에는 과거 작업 과정에서 발생한 문자 인코딩 손상이 남아 있습니다. 실제 사용본은 `outputs/special-lecture-generator.html`입니다.
