-- Legacy filename kept for compatibility with existing references.
-- Verification script for the normalized org/team workspace model.
-- Run after applying:
-- 1) 20260324_0001_pd_ops_core.sql
-- 2) 20260406_0002_webtoon_work_model.sql
-- 3) 20260409_0004_org_team_workspace_access.sql

begin;

-- 1. Create an organization bootstrap row if needed.
insert into public.organizations (code, name)
values ('kenaz', 'Kenaz Studio')
on conflict (code) do nothing;

-- 2. Confirm active organization lookup works for registration.
select id, code, name, status
from public.organizations
where code = 'kenaz';

-- 3. Create a sample team.
with org as (
  select id
  from public.organizations
  where code = 'kenaz'
)
insert into public.teams (organization_id, team_number, team_name, status)
select id, 1, 'Team 1', 'active'
from org
where not exists (
  select 1
  from public.teams t
  where t.organization_id = org.id
    and t.team_number = 1
);

-- 4. Inspect organization / team rows.
select id, code, name, status
from public.organizations
where code = 'kenaz';

select id, team_number, team_name, status
from public.teams
order by team_number;

-- 5. Example read checks for normalized tables.
-- These queries should succeed only when executed as an authorized organization member.
-- Replace placeholders with real IDs from your project as needed.

-- select * from public.projects order by created_at desc limit 10;
-- select * from public.writers order by created_at desc limit 10;
-- select * from public.tasks order by created_at desc limit 10;
-- select * from public.weekly_reports order by created_at desc limit 10;
-- select * from public.service_platforms order by created_at desc limit 10;
-- select * from public.derivative_plannings order by created_at desc limit 10;
-- select * from public.writer_evaluations order by created_at desc limit 10;
-- select * from public.pd_evaluations order by created_at desc limit 10;

rollback;
