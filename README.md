# Special Lecture Generator

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
