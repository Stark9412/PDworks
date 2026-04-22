-- Ensure automatic default stage seeding on project creation is performed
-- by trusted database code instead of the caller's RLS context.

create or replace function private.seed_default_project_stage_defs(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_row public.projects%rowtype;
  actor_id uuid;
begin
  select *
    into project_row
  from public.projects
  where id = p_project_id
    and deleted_at is null;

  if project_row.id is null then
    return;
  end if;

  actor_id := coalesce(public.current_uid(), project_row.updated_by, project_row.created_by);

  insert into public.project_stage_defs (
    organization_id,
    project_id,
    team_id,
    stage_code,
    stage_name,
    sort_order,
    is_active,
    allow_parallel_workers,
    note,
    created_by,
    updated_by
  )
  values
    (project_row.organization_id, project_row.id, project_row.team_id, 'story', '글', 1, true, false, '', actor_id, actor_id),
    (project_row.organization_id, project_row.id, project_row.team_id, 'conti', '콘티', 2, true, false, '', actor_id, actor_id),
    (project_row.organization_id, project_row.id, project_row.team_id, 'line', '선화', 3, true, false, '', actor_id, actor_id),
    (project_row.organization_id, project_row.id, project_row.team_id, 'flat', '밑색', 4, true, false, '', actor_id, actor_id),
    (project_row.organization_id, project_row.id, project_row.team_id, 'shade', '명암', 5, true, false, '', actor_id, actor_id),
    (project_row.organization_id, project_row.id, project_row.team_id, 'bg', '배경', 6, true, true, '', actor_id, actor_id),
    (project_row.organization_id, project_row.id, project_row.team_id, 'retouch', '후보정', 7, true, false, '', actor_id, actor_id),
    (project_row.organization_id, project_row.id, project_row.team_id, 'edit', '편집', 8, true, false, '', actor_id, actor_id)
  on conflict (project_id, stage_code) do update
  set organization_id = excluded.organization_id,
      team_id = excluded.team_id,
      stage_name = excluded.stage_name,
      sort_order = excluded.sort_order,
      is_active = excluded.is_active,
      allow_parallel_workers = excluded.allow_parallel_workers,
      updated_at = now(),
      updated_by = coalesce(public.current_uid(), public.project_stage_defs.updated_by);
end;
$$;
