create schema if not exists private;

create or replace function private.sync_project_participant_scope()
returns trigger
language plpgsql
as $$
declare
  project_row public.projects%rowtype;
begin
  select *
    into project_row
  from public.projects
  where id = new.project_id
    and deleted_at is null;

  if project_row.id is null then
    raise exception 'project % not found for participant scope sync', new.project_id;
  end if;

  new.organization_id := project_row.organization_id;
  new.team_id := project_row.team_id;
  return new;
end;
$$;

create or replace function private.guard_active_participant_uniqueness()
returns trigger
language plpgsql
as $$
begin
  if new.deleted_at is not null or new.status <> 'active' then
    return new;
  end if;

  if exists (
    select 1
    from public.project_participants existing
    where existing.project_id = new.project_id
      and existing.writer_id = new.writer_id
      and existing.role = new.role
      and existing.status = 'active'
      and existing.deleted_at is null
      and (new.id is null or existing.id <> new.id)
  ) then
    raise exception 'duplicate active participant for project %, writer %, role %', new.project_id, new.writer_id, new.role
      using errcode = '23505';
  end if;

  return new;
end;
$$;

create or replace function private.sync_task_scope_from_participant()
returns trigger
language plpgsql
as $$
declare
  participant_row public.project_participants%rowtype;
begin
  select *
    into participant_row
  from public.project_participants
  where id = new.participant_id
    and deleted_at is null;

  if participant_row.id is null then
    raise exception 'participant % not found for task scope sync', new.participant_id;
  end if;

  new.organization_id := participant_row.organization_id;
  new.project_id := participant_row.project_id;
  new.writer_id := participant_row.writer_id;
  new.team_id := participant_row.team_id;
  return new;
end;
$$;

create or replace function private.sync_schedule_change_scope_from_task()
returns trigger
language plpgsql
as $$
declare
  task_row public.tasks%rowtype;
begin
  select *
    into task_row
  from public.tasks
  where id = new.task_id
    and deleted_at is null;

  if task_row.id is null then
    raise exception 'task % not found for schedule change scope sync', new.task_id;
  end if;

  new.organization_id := task_row.organization_id;
  new.project_id := task_row.project_id;
  new.writer_id := task_row.writer_id;
  new.team_id := task_row.team_id;
  return new;
end;
$$;

update public.project_participants participant
set organization_id = project.organization_id,
    team_id = project.team_id,
    updated_at = now(),
    updated_by = coalesce(public.current_uid(), participant.updated_by)
from public.projects project
where project.id = participant.project_id
  and participant.deleted_at is null
  and (
    participant.organization_id is distinct from project.organization_id
    or participant.team_id is distinct from project.team_id
  );

update public.tasks task
set organization_id = participant.organization_id,
    project_id = participant.project_id,
    writer_id = participant.writer_id,
    team_id = participant.team_id,
    updated_at = now(),
    updated_by = coalesce(public.current_uid(), task.updated_by)
from public.project_participants participant
where participant.id = task.participant_id
  and task.deleted_at is null
  and participant.deleted_at is null
  and (
    task.organization_id is distinct from participant.organization_id
    or task.project_id is distinct from participant.project_id
    or task.writer_id is distinct from participant.writer_id
    or task.team_id is distinct from participant.team_id
  );

update public.task_schedule_changes change_log
set organization_id = task.organization_id,
    project_id = task.project_id,
    writer_id = task.writer_id,
    team_id = task.team_id
from public.tasks task
where task.id = change_log.task_id
  and (
    change_log.organization_id is distinct from task.organization_id
    or change_log.project_id is distinct from task.project_id
    or change_log.writer_id is distinct from task.writer_id
    or change_log.team_id is distinct from task.team_id
  );

drop trigger if exists trg_project_participants_scope_sync on public.project_participants;
create trigger trg_project_participants_scope_sync
before insert or update of project_id on public.project_participants
for each row execute function private.sync_project_participant_scope();

drop trigger if exists trg_project_participants_guard_unique_active on public.project_participants;
create trigger trg_project_participants_guard_unique_active
before insert or update of project_id, writer_id, role, status, deleted_at on public.project_participants
for each row execute function private.guard_active_participant_uniqueness();

drop trigger if exists trg_tasks_scope_sync on public.tasks;
create trigger trg_tasks_scope_sync
before insert or update of participant_id on public.tasks
for each row execute function private.sync_task_scope_from_participant();

drop trigger if exists trg_task_schedule_changes_scope_sync on public.task_schedule_changes;
create trigger trg_task_schedule_changes_scope_sync
before insert or update of task_id on public.task_schedule_changes
for each row execute function private.sync_schedule_change_scope_from_task();

create index if not exists ix_project_participants_team_project_status_order
  on public.project_participants(organization_id, team_id, project_id, status, sort_order)
  where deleted_at is null;

create index if not exists ix_tasks_team_project_window_active
  on public.tasks(organization_id, team_id, project_id, current_start_date, current_end_date)
  where deleted_at is null and is_archived = false;

create index if not exists ix_tasks_team_participant_status_end_active
  on public.tasks(organization_id, team_id, participant_id, status, current_end_date desc)
  where deleted_at is null and is_archived = false;

create index if not exists ix_tasks_team_project_episode_type
  on public.tasks(organization_id, team_id, project_id, episode_no, task_type)
  where deleted_at is null;

create index if not exists ix_task_schedule_changes_team_project_created
  on public.task_schedule_changes(organization_id, team_id, project_id, created_at desc)
  where deleted_at is null;

create index if not exists ix_weekly_reports_team_week_scope
  on public.weekly_reports(organization_id, team_id, week_start desc, report_scope, writer_id)
  where deleted_at is null;

create index if not exists ix_writer_aliases_writer_primary
  on public.writer_aliases(writer_id, is_primary desc, alias_name)
  where deleted_at is null;

create index if not exists ix_writer_contacts_writer_primary_type
  on public.writer_contacts(writer_id, contact_type, is_primary desc)
  where deleted_at is null;

create or replace view public.v_workspace_task_board
with (security_invoker = true)
as
select
  task.id as task_id,
  task.organization_id,
  task.team_id,
  task.project_id,
  project.title as project_title,
  participant.id as participant_id,
  participant.role as participant_role,
  participant.status as participant_status,
  participant.sort_order as participant_sort_order,
  writer.id as writer_id,
  writer.legal_name as writer_name,
  coalesce(alias_primary.alias_name, writer.primary_pen_name) as writer_display_name,
  task.task_type,
  task.title,
  task.episode_no,
  task.status,
  task.planned_start_date,
  task.planned_end_date,
  task.current_start_date,
  task.current_end_date,
  task.serialization_date,
  task.stage_def_id,
  stage_def.stage_name,
  task.feedback_done,
  task.is_archived,
  task.approved_at,
  daterange(task.current_start_date, task.current_end_date, '[]') as current_window,
  daterange(task.planned_start_date, task.planned_end_date, '[]') as planned_window
from public.tasks task
join public.project_participants participant
  on participant.id = task.participant_id
 and participant.deleted_at is null
join public.projects project
  on project.id = task.project_id
 and project.deleted_at is null
join public.writers writer
  on writer.id = task.writer_id
 and writer.deleted_at is null
left join public.project_stage_defs stage_def
  on stage_def.id = task.stage_def_id
 and stage_def.deleted_at is null
left join lateral (
  select alias.alias_name
  from public.writer_aliases alias
  where alias.writer_id = writer.id
    and alias.deleted_at is null
  order by alias.is_primary desc, alias.alias_name asc
  limit 1
) alias_primary on true
where task.deleted_at is null;

create or replace view public.v_writer_directory
with (security_invoker = true)
as
with alias_agg as (
  select
    alias.writer_id,
    array_agg(alias.alias_name order by alias.is_primary desc, alias.alias_name asc) as pen_names
  from public.writer_aliases alias
  where alias.deleted_at is null
  group by alias.writer_id
),
contact_agg as (
  select
    contact.writer_id,
    max(contact.contact_value) filter (
      where contact.contact_type = 'phone' and contact.is_primary
    ) as primary_phone,
    max(contact.contact_value) filter (
      where contact.contact_type = 'phone' and not contact.is_primary
    ) as secondary_phone,
    max(contact.contact_value) filter (
      where contact.contact_type = 'email' and contact.is_primary
    ) as primary_email,
    max(contact.contact_value) filter (
      where contact.contact_type = 'email' and not contact.is_primary
    ) as secondary_email
  from public.writer_contacts contact
  where contact.deleted_at is null
  group by contact.writer_id
),
writer_stats as (
  select
    participant.writer_id,
    count(distinct participant.project_id) filter (
      where participant.status = 'active' and participant.deleted_at is null
    ) as active_project_count,
    count(task.id) filter (
      where task.deleted_at is null and coalesce(task.is_archived, false) = false
    ) as open_task_count,
    max(task.current_end_date) filter (where task.deleted_at is null) as latest_due_date
  from public.project_participants participant
  left join public.tasks task
    on task.participant_id = participant.id
   and task.deleted_at is null
   and coalesce(task.is_archived, false) = false
  where participant.deleted_at is null
  group by participant.writer_id
)
select
  writer.id as writer_id,
  writer.organization_id,
  writer.team_id,
  writer.legal_name,
  coalesce(
    alias_agg.pen_names,
    case
      when writer.primary_pen_name is not null then array[writer.primary_pen_name]
      else array[]::text[]
    end
  ) as pen_names,
  coalesce(contact_agg.primary_phone, contact_agg.secondary_phone) as phone,
  coalesce(contact_agg.primary_email, contact_agg.secondary_email) as email,
  writer.employment_type,
  writer.overall_grade,
  writer.work_grade,
  writer.deadline_grade,
  writer.communication_grade,
  writer.recommendation,
  writer.profile_link,
  writer.career_note,
  writer.primary_genres,
  writer.main_work_types,
  writer.contract_link,
  writer.fee_label,
  writer.rs_ratio,
  writer.fit_genres,
  writer.legacy_note,
  writer.work_note,
  coalesce(writer_stats.active_project_count, 0) as active_project_count,
  coalesce(writer_stats.open_task_count, 0) as open_task_count,
  writer_stats.latest_due_date,
  lower(
    concat_ws(
      ' ',
      writer.legal_name,
      writer.primary_pen_name,
      array_to_string(coalesce(alias_agg.pen_names, array[]::text[]), ' '),
      coalesce(contact_agg.primary_phone, ''),
      coalesce(contact_agg.secondary_phone, ''),
      coalesce(contact_agg.primary_email, ''),
      coalesce(contact_agg.secondary_email, '')
    )
  ) as search_blob
from public.writers writer
left join alias_agg
  on alias_agg.writer_id = writer.id
left join contact_agg
  on contact_agg.writer_id = writer.id
left join writer_stats
  on writer_stats.writer_id = writer.id
where writer.deleted_at is null;
