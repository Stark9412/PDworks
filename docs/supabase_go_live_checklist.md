# Supabase Go-Live 체크리스트

## 1. 환경변수

로컬 `.env.local`과 배포 환경에 아래 값을 설정합니다.

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
```

프론트엔드에는 `service_role` 키나 비공개 키를 넣지 않습니다.

## 2. 마이그레이션

`supabase/migrations/`의 SQL 파일을 파일명 순서대로 적용합니다. 적용 순서는 `supabase/README.md`를 기준으로 확인합니다.

## 3. 초기 조직과 관리자

- 첫 실제 사용자가 가입 요청을 완료해야 합니다.
- `supabase/verification/bootstrap_org_admin.sql`을 운영 정책에 맞게 검토한 뒤 최초 관리자 계정을 부트스트랩합니다.
- 관리자 승인 후 팀 배정과 역할 부여가 정상 동작하는지 확인합니다.

## 4. 권한 검증

- 승인 전 사용자는 업무 화면에 접근할 수 없어야 합니다.
- 승인된 사용자는 본인 조직 데이터만 읽어야 합니다.
- `pd_editor`는 담당 팀 범위의 row만 수정해야 합니다.
- `executive_viewer`, `auditor`는 읽기 중심 권한이어야 합니다.
- 다른 조직의 프로젝트, 작가, 작업 row가 조회되지 않아야 합니다.

## 5. 화면별 검증

- 로그인과 가입 요청
- 관리자 승인과 팀 배정
- 홈 대시보드
- 프로젝트 생성과 선택
- Timeline, Month, Kanban, Episode Tracking
- 작업 생성, 일정 변경, 삭제
- 참여 작가 등록, 종료, 교체
- Writer DB 작가 생성과 상세 저장
- Weekly Review 작성과 조회
- Production DB 저장
- Team Management에서 팀과 사용자 상태 변경

## 6. 배포 전 통과 기준

아래가 모두 완료되어야 배포 준비 상태로 봅니다.

- 모든 migration 적용
- 로컬과 배포 환경변수 설정
- 최초 조직과 관리자 준비
- 가입 요청에서 승인 후 로그인까지 실제 흐름 성공
- 작업 생성 후 Supabase 저장과 화면 재조회 성공
- `npm run build`, `npm run qa:smoke`, `npm run qa:supabase` 통과
