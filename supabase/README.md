# Supabase 설정 안내

## 마이그레이션 적용 순서

아래 파일을 파일명 순서대로 적용합니다.

1. `supabase/migrations/20260324_0001_pd_ops_core.sql`
2. `supabase/migrations/20260406_0002_webtoon_work_model.sql`
3. `supabase/migrations/20260409_0004_org_team_workspace_access.sql`
4. `supabase/migrations/20260409_0005_first_owner_autoprovision.sql`
5. `supabase/migrations/20260409_0006_single_org_autoconfirm.sql`
6. `supabase/migrations/20260409_0007_rls_recursion_fix.sql`
7. `supabase/migrations/20260409_0008_role_model_cleanup.sql`
8. `supabase/migrations/20260410_0009_workspace_efficiency_upgrade.sql`
9. `supabase/migrations/20260410_0010_workspace_task_source_cutover.sql`
10. `supabase/migrations/20260410_0011_project_pd_access_control.sql`
11. `supabase/migrations/20260413_0003_participant_contract_fields.sql`
12. `supabase/migrations/20260413_0012_soft_delete_retention.sql`
13. `supabase/migrations/20260413_0013_project_management_roles.sql`
14. `supabase/migrations/20260413_0014_team_management_rls_alignment.sql`
15. `supabase/migrations/20260413_0015_project_stage_seed_security_definer.sql`
16. `supabase/migrations/20260414_0016_project_creation_rls_alignment.sql`
17. `supabase/migrations/20260420_0017_weekly_report_work_fields.sql`
18. `supabase/migrations/20260420_0018_stage_assignment_parallel_cleanup.sql`
19. `supabase/migrations/20260420_0019_project_detail_meta.sql`

필요한 경우 데모 데이터는 `supabase/seed/20260324_pd_ops_seed.sql`을 검토한 뒤 적용합니다.

## 검증 SQL

- `supabase/verification/remote_snapshot_checks.sql`: 기본 조직/팀 모델 확인
- `supabase/verification/bootstrap_org_admin.sql`: 최초 관리자 부트스트랩 보조

## 중요 계약

- Supabase Auth가 활성화되어 있어야 합니다.
- `profiles.id`는 `auth.users.id`를 참조합니다.
- RLS 정책은 조직과 팀 범위를 기준으로 동작합니다.
- 프론트엔드는 publishable key만 사용합니다.
- `service_role` 또는 secret key는 클라이언트 코드와 `.env.local`의 `VITE_` 변수에 넣지 않습니다.

## 주요 스키마 영역

- 조직, 팀, 멤버십, 승인 흐름
- 프로젝트와 담당 PD 권한
- 워크스페이스 작업과 일정 변경 기록
- 프로젝트 단계 정의와 작가 배정
- RS 계약, 제출/피드백 사이클, 제작 비용
- Weekly Review
- Production DB 상세 메타
