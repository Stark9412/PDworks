create schema if not exists private;

alter table public.profiles alter column status set default 'pending';

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_number int not null,
  team_name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (organization_id, team_number)
);

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null default 'pd_editor',
  is_primary boolean not null default false,
  is_active boolean not null default true,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.production_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  cost_category text not null default 'current',
  part text,
  writer_name text,
  unit_price numeric(14,2) not null default 0,
  quantity numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  payment_schedule text,
  scope_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.service_platforms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  region text not null default '국내',
  platform_code text,
  platform_name text,
  launch_date date,
  status text not null default '계획',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.derivative_plannings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  planning_type text,
  title text,
  description text,
  planned_date date,
  status text not null default '계획',
  assigned_to text,
  budget numeric(14,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.change_histories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_date date,
  change_type text,
  old_value text,
  new_value text,
  reason text,
  notes text,
  task_type text,
  task_title text,
  episode_no int,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.writer_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  writer_id uuid not null references public.writers(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  work_ability text,
  deadline_ability text,
  communication_ability text,
  overall_assessment text,
  notes text,
  evaluated_by uuid references public.profiles(id) on delete set null,
  evaluated_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.pd_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  pd_user_id uuid references public.profiles(id) on delete set null,
  positive_assessment text,
  negative_assessment text,
  notes text,
  evaluated_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

alter table public.projects add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.projects add column if not exists pd_display_name text;
alter table public.projects add column if not exists serialization_start_date date;
alter table public.projects add column if not exists serialization_start_episode int not null default 1;
alter table public.projects add column if not exists serialization_weekdays int[] not null default '{}';
alter table public.projects add column if not exists serialization_hiatus_ranges jsonb not null default '[]'::jsonb;
alter table public.projects add column if not exists episode_tracking_types text[] not null default '{}';

alter table public.writers add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.writers add column if not exists profile_link text;
alter table public.writers add column if not exists career_note text;
alter table public.writers add column if not exists primary_genres text[] not null default '{}';
alter table public.writers add column if not exists main_work_types text[] not null default '{}';
alter table public.writers add column if not exists contract_link text;
alter table public.writers add column if not exists fee_label text;
alter table public.writers add column if not exists rs_ratio numeric(6,2);
alter table public.writers add column if not exists fit_genres text[] not null default '{}';
alter table public.writers add column if not exists work_note text;

alter table public.project_participants add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.project_participants add column if not exists sort_order int not null default 0;
alter table public.project_participants add column if not exists hidden_from_ops boolean not null default false;

alter table public.tasks alter column status drop default;
alter table public.tasks alter column status type text using
  case status::text
    when 'done' then 'completed'
    when 'hold' then 'feedback_requested'
    else status::text
  end;
alter table public.tasks alter column status set default 'planned';
alter table public.tasks add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.tasks add column if not exists planned_memo text;
alter table public.tasks add column if not exists scope_label text;
alter table public.tasks add column if not exists serialization_date date;
alter table public.tasks add column if not exists stage_def_id uuid references public.project_stage_defs(id) on delete set null;
alter table public.tasks add column if not exists assignment_id uuid references public.project_stage_assignments(id) on delete set null;
alter table public.tasks add column if not exists rs_contract_term_id uuid references public.rs_contract_terms(id) on delete set null;
alter table public.tasks add column if not exists approved_at timestamptz;
alter table public.tasks add column if not exists is_archived boolean not null default false;

alter table public.task_schedule_changes add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.task_schedule_changes add column if not exists change_type text;
alter table public.task_schedule_changes add column if not exists from_value text;
alter table public.task_schedule_changes add column if not exists to_value text;
alter table public.task_schedule_changes add column if not exists is_typo boolean not null default false;
alter table public.task_schedule_changes add column if not exists typo_marked_at timestamptz;
alter table public.task_schedule_changes add column if not exists deleted_at timestamptz;

alter table public.weekly_reports add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.weekly_reports add column if not exists quality_grade text;
alter table public.weekly_reports add column if not exists deadline_grade text;
alter table public.weekly_reports add column if not exists communication_grade text;
alter table public.weekly_reports add column if not exists quality_note text;
alter table public.weekly_reports add column if not exists deadline_note text;
alter table public.weekly_reports add column if not exists communication_note text;

alter table public.project_stage_defs add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.project_stage_assignments add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.rs_contract_terms add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.work_batches add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.work_submission_cycles add column if not exists team_id uuid references public.teams(id) on delete set null;
alter table public.production_cost_entries add column if not exists team_id uuid references public.teams(id) on delete set null;

create or replace function public.is_active_org_member(p_org_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.org_memberships m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.is_active = true
      and m.deleted_at is null
      and p.status = 'active'
  );
$$;

create or replace function public.has_active_org_role(p_org_id uuid, p_roles member_role[])
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.org_memberships m
    join public.profiles p on p.id = m.user_id
    where m.organization_id = p_org_id
      and m.user_id = auth.uid()
      and m.is_active = true
      and m.deleted_at is null
      and p.status = 'active'
      and m.role = any (p_roles)
  );
$$;

create or replace function public.is_active_team_member(p_org_id uuid, p_team_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.team_memberships tm
    join public.profiles p on p.id = tm.user_id
    where tm.organization_id = p_org_id
      and tm.team_id = p_team_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.deleted_at is null
      and p.status = 'active'
  );
$$;

create or replace function public.can_read_team_scoped(p_org_id uuid, p_team_id uuid)
returns boolean language sql stable as $$
  select
    public.is_active_org_member(p_org_id)
    and (
      p_team_id is null
      or public.has_active_org_role(p_org_id, array['owner'::member_role,'admin'::member_role,'pd_manager'::member_role,'executive_viewer'::member_role,'auditor'::member_role])
      or public.is_active_team_member(p_org_id, p_team_id)
    );
$$;

create or replace function public.can_write_team_scoped(p_org_id uuid, p_team_id uuid)
returns boolean language sql stable as $$
  select
    public.has_active_org_role(p_org_id, array['owner'::member_role,'admin'::member_role,'pd_manager'::member_role])
    or (
      public.has_active_org_role(p_org_id, array['pd_editor'::member_role])
      and p_team_id is not null
      and public.is_active_team_member(p_org_id, p_team_id)
    );
$$;

create or replace function private.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_org public.organizations%rowtype;
begin
  insert into public.profiles (id, full_name, email, status, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'pending',
    now(),
    now()
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      updated_at = now();

  if new.raw_user_meta_data ? 'organization_code' then
    select *
      into requested_org
    from public.organizations
    where code = lower(new.raw_user_meta_data->>'organization_code')
      and status = 'active'
      and deleted_at is null
    limit 1;

    if requested_org.id is not null then
      insert into public.org_memberships (organization_id, user_id, role, is_active, created_at, updated_at)
      values (requested_org.id, new.id, 'pd_editor', false, now(), now())
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_handle_auth_user_created on auth.users;
create trigger trg_handle_auth_user_created
after insert on auth.users
for each row execute function private.handle_auth_user_created();

alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.production_costs enable row level security;
alter table public.service_platforms enable row level security;
alter table public.derivative_plannings enable row level security;
alter table public.change_histories enable row level security;
alter table public.writer_evaluations enable row level security;
alter table public.pd_evaluations enable row level security;

drop policy if exists p_organizations_public_read on public.organizations;
create policy p_organizations_public_read on public.organizations
for select using (status = 'active' and deleted_at is null);

drop policy if exists p_profiles_org_read on public.profiles;
create policy p_profiles_org_read on public.profiles
for select using (
  id = auth.uid()
  or exists (
    select 1
    from public.org_memberships self_member
    join public.org_memberships target_member on target_member.organization_id = self_member.organization_id
    where self_member.user_id = auth.uid()
      and self_member.is_active = true
      and self_member.deleted_at is null
      and target_member.user_id = public.profiles.id
      and target_member.deleted_at is null
  )
);

drop policy if exists p_profiles_self_or_admin_update on public.profiles;
create policy p_profiles_self_or_admin_update on public.profiles
for update using (
  id = auth.uid()
  or exists (
    select 1
    from public.org_memberships m
    where m.user_id = auth.uid()
      and m.organization_id in (
        select organization_id from public.org_memberships target where target.user_id = public.profiles.id and target.deleted_at is null
      )
      and m.role in ('owner', 'admin')
      and m.is_active = true
      and m.deleted_at is null
  )
) with check (true);

drop policy if exists p_org_memberships_self_read on public.org_memberships;
create policy p_org_memberships_self_read on public.org_memberships
for select using (user_id = auth.uid() or public.is_active_org_member(organization_id));

drop policy if exists p_org_memberships_admin_manage on public.org_memberships;
create policy p_org_memberships_admin_manage on public.org_memberships
for all using (public.has_active_org_role(organization_id, array['owner'::member_role,'admin'::member_role]))
with check (public.has_active_org_role(organization_id, array['owner'::member_role,'admin'::member_role]));

drop policy if exists p_teams_org_read on public.teams;
create policy p_teams_org_read on public.teams
for select using (public.is_active_org_member(organization_id));

drop policy if exists p_teams_admin_write on public.teams;
create policy p_teams_admin_write on public.teams
for all using (public.has_active_org_role(organization_id, array['owner'::member_role,'admin'::member_role]))
with check (public.has_active_org_role(organization_id, array['owner'::member_role,'admin'::member_role]));

drop policy if exists p_team_memberships_org_read on public.team_memberships;
create policy p_team_memberships_org_read on public.team_memberships
for select using (public.is_active_org_member(organization_id));

drop policy if exists p_team_memberships_admin_write on public.team_memberships;
create policy p_team_memberships_admin_write on public.team_memberships
for all using (public.has_active_org_role(organization_id, array['owner'::member_role,'admin'::member_role]))
with check (public.has_active_org_role(organization_id, array['owner'::member_role,'admin'::member_role]));

do $policy$
declare
  t text;
begin
  foreach t in array array[
    'projects','writers','project_participants','tasks','task_schedule_changes','weekly_reports',
    'project_stage_defs','project_stage_assignments','rs_contract_terms','work_batches','work_submission_cycles',
    'production_cost_entries','production_costs','service_platforms','derivative_plannings',
    'change_histories','writer_evaluations','pd_evaluations'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'p_'||t||'_team_read', t);
    execute format('create policy %I on public.%I for select using (public.can_read_team_scoped(organization_id, team_id))', 'p_'||t||'_team_read', t);
    execute format('drop policy if exists %I on public.%I', 'p_'||t||'_team_write', t);
    execute format('create policy %I on public.%I for all using (public.can_write_team_scoped(organization_id, team_id)) with check (public.can_write_team_scoped(organization_id, team_id))', 'p_'||t||'_team_write', t);
  end loop;
end;
$policy$;
