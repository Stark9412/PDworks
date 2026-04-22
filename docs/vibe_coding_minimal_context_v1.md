# 개발 최소 컨텍스트

## 목적

새 개발자가 많은 과거 문서를 읽지 않고도 현재 코드의 기준점을 잡을 수 있게 하는 최소 컨텍스트입니다.

## 제품 범위

- PD 운영용 작품 일정 및 실행 관리
- 핵심 워크스페이스 뷰:
  - Timeline
  - Month
  - Kanban
  - Episode Tracking
- 보조 화면:
  - 작업 상세/생성 모달
  - 참여 작가 관리
  - Writer DB
  - Weekly Review
  - Production DB
  - Team Management

## 현재 기준

- 현재 실행 소스는 `src/`입니다.
- 작업 상태 enum은 `not_started`, `in_progress`, `hold`, `done`입니다.
- planned schedule은 `ps`/`pe`이며 실행 상태가 아닙니다.
- 실제 일정은 `cs`/`ce`입니다.
- Timeline, Month, Kanban, Episode Tracking은 같은 작업 데이터를 공유합니다.
- 한 화면에서 저장한 변경은 다른 화면에도 동일하게 반영되어야 합니다.

## 주요 진입점

- `src/App.jsx`: 앱 셸, 인증 이후 전체 화면 연결
- `src/components/app/WorkspaceRouteRenderer.jsx`: 라우트별 화면 매핑
- `src/hooks/useWorkspaceDb.js`: Supabase 동기화와 데이터 write entry
- `src/features/workspace/hooks/useWorkspaceController.js`: 라우트, 선택 프로젝트, 뷰 상태
- `src/features/workspace/mutations/taskMutations.js`: 작업 생성/수정/삭제 규칙
- `src/features/workspace/mutations/entityMutations.js`: 프로젝트, 참여자, 작가 mutation 규칙
- `src/components/workspace/ProjectDirectoryPage.jsx`: 프로젝트 목록과 선택
- `src/components/production-db/ProductionDbPage.jsx`: Production DB 화면 진입점

## 보존해야 할 계약

- `useWorkspaceDb` 반환 형태
- 작업 mutation 후 cross-view 데이터 일관성
- Supabase 조직/팀/RLS 기반 권한 모델
- 가입 요청, 승인 대기, 관리자 승인 흐름
- 기존 migration 순서

## 기본 검증

작업 후 아래 명령을 실행합니다.

```bash
npm run build
npm run qa:smoke
npm run qa:supabase
```
