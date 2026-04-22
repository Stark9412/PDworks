## 현재 기능

- 로그인, 가입 요청, 승인 대기 흐름
- 홈 대시보드
- 프로젝트 디렉터리와 프로젝트 선택
- 워크스페이스 4개 뷰: Timeline, Month, Kanban, Episode Tracking
- 작업 생성, 수정, 삭제
- 참여 작가 등록, 종료, 교체
- Writer DB와 작가 상세
- Weekly Review
- Production DB
- Team Management
- Settings
- Supabase 동기화와 RLS 기반 권한 모델

## 설치와 실행

1. Node.js 환경을 준비합니다.
2. 의존성을 설치합니다.

```bash
npm install
```

3. 환경변수 파일을 준비합니다.

```bash
cp .env.example .env.local
```

4. `.env.local`에 아래 값을 입력합니다.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
```

5. 개발 서버를 실행합니다.

```bash
npm run dev
```

## Windows 빠른 실행 파일

PowerShell에서 `npm`이 바로 잡히지 않거나 더블클릭으로 실행하고 싶으면 아래 파일을 사용합니다.

- `run-dev.bat`: 의존성이 없으면 설치한 뒤 `http://127.0.0.1:5173` 개발 서버를 실행합니다.
- `run-build.bat`: 프로덕션 빌드를 실행합니다.
- `run-smoke.bat`: workspace smoke와 Supabase smoke를 순서대로 실행합니다.

## 검증 명령

전달본 안정성 기준은 아래 세 명령이 통과하는 것입니다.

```bash
npm run build
npm run qa:smoke
npm run qa:supabase
```

## 주요 폴더

- `src/`: React 앱 전체 소스
- `scripts/`: 로컬 스모크 테스트와 보조 스크립트
- `supabase/`: 마이그레이션, seed, 검증 SQL
- `docs/`: 개발자가 읽을 최소 문서

## 제외된 항목

아래 항목은 개발 전달본에서 제외했습니다.

- `.git/`, `.vercel/`, `.claude/`
- `node_modules/`, `dist/`
- `tools/`, `deliverables/`, `legacy/`, `shared/`, `skills/`, `src_new/`, `webtoon_make_source/`
- 과거 기획, 검토, 실험용 Markdown 문서

## 개발 주의사항

- `src/hooks/useWorkspaceDb.js`의 반환 형태는 화면 전반이 의존하므로 변경 시 영향 범위를 먼저 확인해야 합니다.
- 작업 상태 enum은 `not_started`, `in_progress`, `hold`, `done`을 유지합니다.
- Timeline의 planned lane과 execution status는 분리된 개념입니다.
- Timeline, Month, Kanban, Episode Tracking은 같은 작업 데이터를 다른 방식으로 보여주는 뷰입니다. 한 뷰의 수정이 다른 뷰와 어긋나지 않아야 합니다.
- Supabase RLS, 조직, 팀, 권한, 승인 흐름은 현재 계약을 유지한 상태에서 확장해야 합니다.

## 먼저 읽을 문서

1. `HANDOFF.md`
2. `docs/README.md`
3. `docs/vibe_coding_minimal_context_v1.md`
4. Supabase 작업 시 `docs/supabase_go_live_checklist.md`와 `supabase/README.md`
