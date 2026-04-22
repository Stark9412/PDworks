create schema if not exists private;

create or replace function private.seed_default_project_stage_defs(p_project_id uuid)
returns void
language plpgsql
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

create or replace function private.ensure_project_stage_defs_on_project_insert()
returns trigger
language plpgsql
as $$
begin
  perform private.seed_default_project_stage_defs(new.id);
  return new;
end;
$$;

do $$
declare
  project_row record;
begin
  for project_row in
    select id
    from public.projects
    where deleted_at is null
  loop
    perform private.seed_default_project_stage_defs(project_row.id);
  end loop;
end;
$$;

update public.project_stage_defs stage_def
set organization_id = project.organization_id,
    team_id = project.team_id,
    updated_at = now(),
    updated_by = coalesce(public.current_uid(), stage_def.updated_by)
from public.projects project
where project.id = stage_def.project_id
  and stage_def.deleted_at is null
  and (
    stage_def.organization_id is distinct from project.organization_id
    or stage_def.team_id is distinct from project.team_id
  );

update public.project_stage_assignments assignment
set stage_def_id = stage_def.id,
    organization_id = participant.organization_id,
    project_id = participant.project_id,
    writer_id = participant.writer_id,
    team_id = participant.team_id,
    updated_at = now(),
    updated_by = coalesce(public.current_uid(), assignment.updated_by)
from public.project_participants participant
join public.project_stage_defs stage_def
  on stage_def.project_id = participant.project_id
 and stage_def.deleted_at is null
 and (
   stage_def.stage_name = participant.role
   or stage_def.stage_code = case participant.role
     when '글' then 'story'
     when '콘티' then 'conti'
     when '선화' then 'line'
     when '밑색' then 'flat'
     when '명암' then 'shade'
     when '배경' then 'bg'
     when '후보정' then 'retouch'
     when '편집' then 'edit'
     else stage_def.stage_code
   end
 )
where assignment.participant_id = participant.id
  and assignment.deleted_at is null
  and (
    assignment.stage_def_id is null
    or not exists (
      select 1
      from public.project_stage_defs existing_stage
      where existing_stage.id = assignment.stage_def_id
        and existing_stage.deleted_at is null
    )
    or assignment.organization_id is distinct from participant.organization_id
    or assignment.project_id is distinct from participant.project_id
    or assignment.writer_id is distinct from participant.writer_id
    or assignment.team_id is distinct from participant.team_id
  );

update public.rs_contract_terms term
set stage_def_id = assignment.stage_def_id,
    organization_id = assignment.organization_id,
    project_id = assignment.project_id,
    writer_id = assignment.writer_id,
    team_id = assignment.team_id,
    updated_at = now(),
    updated_by = coalesce(public.current_uid(), term.updated_by)
from public.project_stage_assignments assignment
where assignment.id = term.assignment_id
  and assignment.deleted_at is null
  and term.deleted_at is null
  and (
    term.stage_def_id is null
    or not exists (
      select 1
      from public.project_stage_defs existing_stage
      where existing_stage.id = term.stage_def_id
        and existing_stage.deleted_at is null
    )
    or term.organization_id is distinct from assignment.organization_id
    or term.project_id is distinct from assignment.project_id
    or term.writer_id is distinct from assignment.writer_id
    or term.team_id is distinct from assignment.team_id
  );

update public.tasks task
set stage_def_id = assignment.stage_def_id,
    organization_id = participant.organization_id,
    project_id = participant.project_id,
    writer_id = participant.writer_id,
    team_id = participant.team_id,
    updated_at = now(),
    updated_by = coalesce(public.current_uid(), task.updated_by)
from public.project_participants participant
left join public.project_stage_assignments assignment
  on assignment.participant_id = participant.id
 and assignment.writer_id = participant.writer_id
 and assignment.project_id = participant.project_id
 and assignment.status = 'active'
 and assignment.deleted_at is null
where participant.id = task.participant_id
  and participant.deleted_at is null
  and task.deleted_at is null
  and (
    task.stage_def_id is null
    or not exists (
      select 1
      from public.project_stage_defs existing_stage
      where existing_stage.id = task.stage_def_id
        and existing_stage.deleted_at is null
    )
    or task.organization_id is distinct from participant.organization_id
    or task.project_id is distinct from participant.project_id
    or task.writer_id is distinct from participant.writer_id
    or task.team_id is distinct from participant.team_id
  );

drop trigger if exists trg_projects_seed_default_stage_defs on public.projects;
create trigger trg_projects_seed_default_stage_defs
after insert on public.projects
for each row execute function private.ensure_project_stage_defs_on_project_insert();
