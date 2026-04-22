-- PD Ops Workspace core schema (MVP + near-term expansion)
-- PostgreSQL / Supabase compatible

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;
create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type member_role as enum ('owner', 'admin', 'pd_manager', 'pd_editor', 'executive_viewer', 'auditor');
  end if;
  if not exists (select 1 from pg_type where typname = 'participant_status') then
    create type participant_status as enum ('active', 'ended', 'replaced');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type task_status as enum ('planned', 'in_progress', 'done', 'hold');
  end if;
  if not exists (select 1 from pg_type where typname = 'report_recommendation') then
    create type report_recommendation as enum ('maintain', 'priority', 'caution', 'hold');
  end if;
end $$;

create or replace function public.current_uid()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce(public.current_uid(), new.updated_by);
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email citext,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.org_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null,
  is_active boolean not null default true,
  invited_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (organization_id, user_id, role)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  genre text,
  start_date date,
  end_date date,
  pd_user_id uuid references public.profiles(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (organization_id, code)
);

create table if not exists public.writers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_name text not null,
  primary_pen_name text,
  employment_type text,
  overall_grade text,
  work_grade text,
  deadline_grade text,
  communication_grade text,
  recommendation report_recommendation,
  academy_batch text,
  academy_completed boolean not null default false,
  academy_priority boolean not null default false,
  legacy_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.writer_aliases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  writer_id uuid not null references public.writers(id) on delete cascade,
  alias_name text not null,
  is_primary boolean not null default false,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (organization_id, writer_id, alias_name)
);

create table if not exists public.writer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  writer_id uuid not null references public.writers(id) on delete cascade,
  contact_type text not null check (contact_type in ('phone', 'email', 'messenger')),
  contact_value citext not null,
  normalized_value citext generated always as (
    case
      when contact_type = 'phone' then regexp_replace(contact_value::text, '[^0-9]', '', 'g')::citext
      else lower(contact_value::text)::citext
    end
  ) stored,
  is_primary boolean not null default false,
  valid_from date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create unique index if not exists ux_writer_contacts_org_type_normalized
  on public.writer_contacts(organization_id, contact_type, normalized_value)
  where deleted_at is null;

create table if not exists public.project_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  writer_id uuid not null references public.writers(id) on delete cascade,
  role text not null,
  status participant_status not null default 'active',
  started_at date not null default current_date,
  ended_at date,
  end_reason text,
  replacement_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  participant_id uuid not null references public.project_participants(id) on delete cascade,
  writer_id uuid not null references public.writers(id) on delete cascade,
  episode_no int check (episode_no is null or episode_no > 0),
  task_type text not null,
  title text not null,
  planned_start_date date not null,
  planned_end_date date not null,
  current_start_date date not null,
  current_end_date date not null,
  status task_status not null default 'planned',
  feedback_done boolean not null default false,
  feedback_done_at timestamptz,
  feedback_done_by uuid references public.profiles(id),
  detail_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint chk_tasks_date_order check (planned_start_date <= planned_end_date and current_start_date <= current_end_date)
);

create table if not exists public.task_schedule_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  writer_id uuid not null references public.writers(id) on delete cascade,
  old_start_date date not null,
  old_end_date date not null,
  new_start_date date not null,
  new_end_date date not null,
  delay_days int not null default 0,
  source text not null default 'manual',
  reason_code text not null default 'schedule_adjustment',
  reason_detail text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  report_scope text not null default 'all',
  writer_id uuid not null references public.writers(id) on delete cascade,
  recommendation report_recommendation not null default 'maintain',
  score smallint not null default 3 check (score between 1 and 5),
  weekly_note text,
  strengths text,
  risks text,
  response_notes text,
  manager_note text,
  submitted_at timestamptz,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (organization_id, week_start, report_scope, writer_id)
);

create table if not exists public.weekly_report_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  weekly_report_id uuid not null references public.weekly_reports(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  writer_id uuid not null references public.writers(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  completion_ratio numeric(5,2),
  delay_count int not null default 0,
  hold_count int not null default 0,
  feedback_pending_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.writer_evidence_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  writer_id uuid not null references public.writers(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  week_start date,
  polarity text not null check (polarity in ('strength', 'weakness', 'neutral')),
  tag text,
  context_text text,
  action_text text,
  impact_text text,
  raw_note_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create index if not exists ix_projects_org_pd on public.projects (organization_id, pd_user_id) where deleted_at is null;
create index if not exists ix_participants_org_project_status on public.project_participants (organization_id, project_id, status) where deleted_at is null;
create index if not exists ix_tasks_org_project_start on public.tasks (organization_id, project_id, current_start_date) where deleted_at is null;
create index if not exists ix_tasks_org_project_end on public.tasks (organization_id, project_id, current_end_date) where deleted_at is null;
create index if not exists ix_tasks_org_participant_end on public.tasks (organization_id, participant_id, current_end_date) where deleted_at is null;
create index if not exists ix_tasks_org_writer on public.tasks (organization_id, writer_id) where deleted_at is null;
create index if not exists ix_schedule_changes_org_task on public.task_schedule_changes (organization_id, task_id, created_at desc);
create index if not exists ix_weekly_reports_org_week on public.weekly_reports (organization_id, week_start);
create index if not exists ix_weekly_reports_org_writer on public.weekly_reports (organization_id, writer_id, week_start desc);
create index if not exists ix_weekly_items_org_report on public.weekly_report_items (organization_id, weekly_report_id);
create index if not exists ix_evidence_org_writer on public.writer_evidence_notes (organization_id, writer_id, created_at desc);

create index if not exists ix_writers_name_trgm
  on public.writers using gin ((coalesce(legal_name,'') || ' ' || coalesce(primary_pen_name,'')) gin_trgm_ops);
create index if not exists ix_aliases_alias_trgm
  on public.writer_aliases using gin (alias_name gin_trgm_ops);

create or replace function public.log_task_schedule_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and (old.current_start_date is distinct from new.current_start_date
          or old.current_end_date is distinct from new.current_end_date) then
    insert into public.task_schedule_changes (
      organization_id,
      task_id,
      project_id,
      writer_id,
      old_start_date,
      old_end_date,
      new_start_date,
      new_end_date,
      delay_days,
      source,
      changed_by
    ) values (
      new.organization_id,
      new.id,
      new.project_id,
      new.writer_id,
      old.current_start_date,
      old.current_end_date,
      new.current_start_date,
      new.current_end_date,
      (new.current_end_date - old.current_end_date),
      'task_update_trigger',
      public.current_uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tasks_schedule_change on public.tasks;
create trigger trg_tasks_schedule_change
after update on public.tasks
for each row execute function public.log_task_schedule_change();

drop trigger if exists trg_org_memberships_touch on public.org_memberships;
create trigger trg_org_memberships_touch before update on public.org_memberships
for each row execute function public.touch_updated_at();

drop trigger if exists trg_projects_touch on public.projects;
create trigger trg_projects_touch before update on public.projects
for each row execute function public.touch_updated_at();

drop trigger if exists trg_writers_touch on public.writers;
create trigger trg_writers_touch before update on public.writers
for each row execute function public.touch_updated_at();

drop trigger if exists trg_writer_aliases_touch on public.writer_aliases;
create trigger trg_writer_aliases_touch before update on public.writer_aliases
for each row execute function public.touch_updated_at();

drop trigger if exists trg_writer_contacts_touch on public.writer_contacts;
create trigger trg_writer_contacts_touch before update on public.writer_contacts
for each row execute function public.touch_updated_at();

drop trigger if exists trg_project_participants_touch on public.project_participants;
create trigger trg_project_participants_touch before update on public.project_participants
for each row execute function public.touch_updated_at();

drop trigger if exists trg_tasks_touch on public.tasks;
create trigger trg_tasks_touch before update on public.tasks
for each row execute function public.touch_updated_at();

drop trigger if exists trg_weekly_reports_touch on public.weekly_reports;
create trigger trg_weekly_reports_touch before update on public.weekly_reports
for each row execute function public.touch_updated_at();

drop trigger if exists trg_weekly_report_items_touch on public.weekly_report_items;
create trigger trg_weekly_report_items_touch before update on public.weekly_report_items
for each row execute function public.touch_updated_at();

drop trigger if exists trg_writer_evidence_notes_touch on public.writer_evidence_notes;
create trigger trg_writer_evidence_notes_touch before update on public.writer_evidence_notes
for each row execute function public.touch_updated_at();

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_memberships m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.is_active = true
      and m.deleted_at is null
  );
$$;

create or replace function public.has_org_role(p_org_id uuid, p_roles member_role[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.org_memberships m
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.is_active = true
      and m.deleted_at is null
      and m.role = any (p_roles)
  );
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.org_memberships enable row level security;
alter table public.projects enable row level security;
alter table public.writers enable row level security;
alter table public.writer_aliases enable row level security;
alter table public.writer_contacts enable row level security;
alter table public.project_participants enable row level security;
alter table public.tasks enable row level security;
alter table public.task_schedule_changes enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.weekly_report_items enable row level security;
alter table public.writer_evidence_notes enable row level security;

drop policy if exists p_profiles_self_read on public.profiles;
create policy p_profiles_self_read on public.profiles
for select using (id = auth.uid());

drop policy if exists p_profiles_self_update on public.profiles;
create policy p_profiles_self_update on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

do $policy$
declare
  t text;
begin
  foreach t in array array[
    'projects',
    'writers',
    'writer_aliases',
    'writer_contacts',
    'project_participants',
    'tasks',
    'task_schedule_changes',
    'weekly_reports',
    'weekly_report_items',
    'writer_evidence_notes',
    'org_memberships'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'p_'||t||'_org_read', t);
    execute format('create policy %I on public.%I for select using (public.is_org_member(organization_id))', 'p_'||t||'_org_read', t);

    execute format('drop policy if exists %I on public.%I', 'p_'||t||'_org_write', t);
    execute format(
      'create policy %I on public.%I for all using (public.has_org_role(organization_id, array[''owner''::member_role,''admin''::member_role,''pd_manager''::member_role,''pd_editor''::member_role])) with check (public.has_org_role(organization_id, array[''owner''::member_role,''admin''::member_role,''pd_manager''::member_role,''pd_editor''::member_role]))',
      'p_'||t||'_org_write', t
    );
  end loop;
end;
$policy$;

drop policy if exists p_org_memberships_owner_admin_manage on public.org_memberships;
create policy p_org_memberships_owner_admin_manage on public.org_memberships
for all
using (public.has_org_role(organization_id, array['owner'::member_role, 'admin'::member_role]))
with check (public.has_org_role(organization_id, array['owner'::member_role, 'admin'::member_role]));

drop policy if exists p_weekly_reports_exec_read on public.weekly_reports;
create policy p_weekly_reports_exec_read on public.weekly_reports
for select
using (public.has_org_role(organization_id, array['owner'::member_role, 'admin'::member_role, 'pd_manager'::member_role, 'executive_viewer'::member_role, 'auditor'::member_role]));

create or replace view public.v_exec_weekly_pd_summary as
select
  p.organization_id,
  wr.week_start,
  p.pd_user_id,
  coalesce(pr.full_name, 'Unassigned PD') as pd_name,
  count(distinct wr.writer_id) as writer_count,
  count(*) filter (where wr.submitted_at is not null) as submitted_count,
  round((count(*) filter (where wr.submitted_at is not null)::numeric / nullif(count(*), 0)::numeric) * 100, 0) as submission_rate,
  count(*) filter (where wr.recommendation = 'hold') as hold_recommendation_count,
  avg(wr.score)::numeric(4,2) as avg_score
from public.weekly_reports wr
left join public.projects p
  on p.organization_id = wr.organization_id
 and (wr.report_scope = 'all' or p.id::text = wr.report_scope)
left join public.profiles pr
  on pr.id = p.pd_user_id
where wr.deleted_at is null
group by p.organization_id, wr.week_start, p.pd_user_id, coalesce(pr.full_name, 'Unassigned PD');

