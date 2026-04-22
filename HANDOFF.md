## 현재 상태

- React/Vite 앱입니다.
- Supabase Auth, 조직, 팀, RLS, workspace sync 흐름을 사용합니다.
- 핵심 검증 명령은 `npm run build`, `npm run qa:smoke`, `npm run qa:supabase`입니다.
- 문서는 한국어 Markdown으로 정리했습니다.
- 주요 UI와 인증 흐름의 깨진 한글 문구를 수정했습니다.
- 2026-04-22 기준 `npm run build`, `npm run qa:smoke`, `npm run qa:supabase`가 통과했습니다.
- 개발 서버는 `http://127.0.0.1:5173`에서 HTTP 200 응답을 확인했습니다.

## 전달 범위

- 앱 소스: `src/`
- 검증 스크립트: `scripts/`
- DB 스키마와 검증 SQL: `supabase/`
- 실행 설정: `package.json`, `package-lock.json`, `index.html`, `vite.config.js`, `.env.example`
- 인계 문서: `README.md`, `docs/`, `supabase/README.md`

## 개발 시작 순서

1. `README.md`를 읽고 로컬 실행 환경을 준비합니다.
2. `.env.example`을 기준으로 `.env.local`을 만듭니다.
3. Supabase 프로젝트에 `supabase/migrations/`의 SQL을 순서대로 적용합니다.
4. `npm run build`, `npm run qa:smoke`, `npm run qa:supabase`를 실행합니다.
5. 로그인, 프로젝트 선택, 워크스페이스 4개 뷰, Writer DB, Weekly Review, Production DB, Team Management를 수동 확인합니다.

## 변경 시 우선순위

1. 현재 기능 안정화
2. 화면별 깨진 문구와 UX 마찰 제거
3. Supabase 권한과 동기화 흐름 검증
4. 상세 기획서 기반 신규 기능 확장

## 하지 말아야 할 일

- `src_new/` 또는 과거 산출물을 기준으로 재구현하지 않습니다.
- 작업 상태 enum을 임의로 추가하지 않습니다.
- Supabase `service_role` 또는 비공개 키를 프론트엔드에 넣지 않습니다.
- RLS 정책을 끄거나 전체 공개 정책으로 우회하지 않습니다.
