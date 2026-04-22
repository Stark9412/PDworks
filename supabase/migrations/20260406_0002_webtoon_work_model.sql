-- Webtoon operating model expansion
-- Adds project stages, stage assignments, RS contract history, work batches,
-- submission cycles, production cost ledger, and writer latest RS view.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'project_stage_assignment_status') then
    create type project_stage_assignment_status as enum ('active', 'ended', 'replaced');
  end if;
  if not exists (select 1 from pg_type where typname = 'rs_amount_basis') then
    create type rs_amount_basis as enum ('scope_batch', 'per_episode', 'flat_fee');
  end if;
  if not exists (select 1 from pg_type where typname = 'work_status_v2') then
    create type work_status_v2 as enum ('planned', 'in_progress', 'submitted', 'feedback_requested', 'completed');
  end if;
end $$;

create table if not exists public.project_stage_defs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_code text not null,
  stage_name text not null,
  sort_order int not null,
  is_active boolean not null default true,
  allow_parallel_workers boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (project_id, stage_code),
  unique (project_id, sort_order)
);

create table if not exists public.project_stage_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_def_id uuid not null references public.project_stage_defs(id) on delete cascade,
  participant_id uuid references public.project_participants(id) on delete set null,
  writer_id uuid not null references public.writers(id) on delete cascade,
  status project_stage_assignment_status not null default 'active',
  started_at date not null default current_date,
  ended_at date,
  replacement_reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create table if not exists public.rs_contract_terms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_def_id uuid not null references public.project_stage_defs(id) on delete cascade,
  assignment_id uuid references public.project_stage_assignments(id) on delete set null,
  writer_id uuid not null references public.writers(id) on delete cascade,
  effective_start_date date not null,
  effective_end_date date,
  amount_basis rs_amount_basis not null default 'scope_batch',
  unit_amount numeric(14,2) not null,
  currency_code text not null default 'KRW',
  scope_note text,
  change_reason text,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint chk_rs_contract_terms_date_order check (
    effective_end_date is null or effective_start_date <= effective_end_date
  )
);

create table if not exists public.work_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_def_id uuid not null references public.project_stage_defs(id) on delete cascade,
  assignment_id uuid not null references public.project_stage_assignments(id) on delete cascade,
  writer_id uuid not null references public.writers(id) on delete cascade,
  legacy_task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  scope_label text not null,
  episode_start int,
  episode_end int,
  planned_note text,
  status work_status_v2 not null default 'planned',
  planned_start_date date,
  planned_end_date date,
  current_start_date date,
  current_end_date date,
  rs_contract_term_id uuid references public.rs_contract_terms(id) on delete set null,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  constraint chk_work_batches_episode_order check (
    episode_start is null or episode_end is null or episode_start <= episode_end
  ),
  constraint chk_work_batches_date_order check (
    (planned_start_date is null or planned_end_date is null or planned_start_date <= planned_end_date)
    and (current_start_date is null or current_end_date is null or current_start_date <= current_end_date)
  )
);

create table if not exists public.work_submission_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_batch_id uuid not null references public.work_batches(id) on delete cascade,
  cycle_no int not null,
  submitted_at timestamptz,
  submission_note text,
  pd_checked_at timestamptz,
  feedback_note text,
  revision_due_at timestamptz,
  resubmitted_at timestamptz,
  is_approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (work_batch_id, cycle_no)
);

create table if not exists public.production_cost_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  stage_def_id uuid not null references public.project_stage_defs(id) on delete cascade,
  assignment_id uuid references public.project_stage_assignments(id) on delete set null,
  writer_id uuid not null references public.writers(id) on delete cascade,
  work_batch_id uuid not null unique references public.work_batches(id) on delete cascade,
  rs_contract_term_id uuid references public.rs_contract_terms(id) on delete set null,
  amount_basis rs_amount_basis not null,
  unit_amount_snapshot numeric(14,2) not null,
  currency_code text not null default 'KRW',
  scope_label text not null,
  amount_total numeric(14,2) not null,
  approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

create index if not exists ix_stage_defs_project_order
  on public.project_stage_defs(project_id, sort_order)
  where deleted_at is null;

create index if not exists ix_stage_assignments_stage_status
  on public.project_stage_assignments(project_id, stage_def_id, status, started_at)
  where deleted_at is null;

create index if not exists ix_rs_contract_terms_writer_stage
  on public.rs_contract_terms(organization_id, writer_id, stage_def_id, effective_start_date desc)
  where deleted_at is null;

create index if not exists ix_work_batches_project_stage
  on public.work_batches(project_id, stage_def_id, status, current_end_date)
  where deleted_at is null;

create index if not exists ix_submission_cycles_batch
  on public.work_submission_cycles(work_batch_id, cycle_no desc)
  where deleted_at is null;

create index if not exists ix_production_cost_entries_project
  on public.production_cost_entries(project_id, approved_at desc)
  where deleted_at is null;

create or replace function public.ensure_stage_assignment_parallel_rule()
returns trigger
language plpgsql
as $$
declare
  allow_parallel boolean;
  overlap_count int;
begin
  select coalesce(psd.allow_parallel_workers, false)
    into allow_parallel
  from public.project_stage_defs psd
  where psd.id = new.stage_def_id;

  if allow_parallel then
    return new;
  end if;

  select count(*)
    into overlap_count
  from public.project_stage_assignments existing
  where existing.stage_def_id = new.stage_def_id
    and existing.id <> coalesce(new.id, gen_random_uuid())
    and existing.deleted_at is null
    and existing.status = 'active'
    and daterange(existing.started_at, coalesce(existing.ended_at, 'infinity'::date), '[]')
        && daterange(new.started_at, coalesce(new.ended_at, 'infinity'::date), '[]');

  if overlap_count > 0 then
    raise exception 'parallel stage assignment is disabled for stage %', new.stage_def_id;
  end if;

  return new;
end;
$$;

create or replace function public.set_current_rs_contract_term()
returns trigger
language plpgsql
as $$
begin
  if new.is_current then
    update public.rs_contract_terms
       set is_current = false,
           updated_at = now(),
           updated_by = coalesce(public.current_uid(), updated_by)
     where organization_id = new.organization_id
       and writer_id = new.writer_id
       and project_id = new.project_id
       and stage_def_id = new.stage_def_id
       and id <> new.id
       and deleted_at is null;
  end if;
  return new;
end;
$$;

create or replace function public.sync_production_cost_entry()
returns trigger
language plpgsql
as $$
declare
  contract_row public.rs_contract_terms%rowtype;
begin
  if new.status <> 'completed' or new.approved_at is null or new.deleted_at is not null then
    return new;
  end if;

  if exists (
    select 1
    from public.production_cost_entries pce
    where pce.work_batch_id = new.id
      and pce.deleted_at is null
  ) then
    return new;
  end if;

  if new.rs_contract_term_id is not null then
    select *
      into contract_row
    from public.rs_contract_terms rct
    where rct.id = new.rs_contract_term_id;
  end if;

  insert into public.production_cost_entries (
    organization_id,
    project_id,
    stage_def_id,
    assignment_id,
    writer_id,
    work_batch_id,
    rs_contract_term_id,
    amount_basis,
    unit_amount_snapshot,
    currency_code,
    scope_label,
    amount_total,
    approved_at,
    created_by,
    updated_by
  ) values (
    new.organization_id,
    new.project_id,
    new.stage_def_id,
    new.assignment_id,
    new.writer_id,
    new.id,
    new.rs_contract_term_id,
    coalesce(contract_row.amount_basis, 'scope_batch'::rs_amount_basis),
    coalesce(contract_row.unit_amount, 0),
    coalesce(contract_row.currency_code, 'KRW'),
    new.scope_label,
    coalesce(contract_row.unit_amount, 0),
    new.approved_at,
    public.current_uid(),
    public.current_uid()
  );

  return new;
end;
$$;

drop trigger if exists trg_project_stage_defs_touch on public.project_stage_defs;
create trigger trg_project_stage_defs_touch before update on public.project_stage_defs
for each row execute function public.touch_updated_at();

drop trigger if exists trg_project_stage_assignments_touch on public.project_stage_assignments;
create trigger trg_project_stage_assignments_touch before update on public.project_stage_assignments
for each row execute function public.touch_updated_at();

drop trigger if exists trg_rs_contract_terms_touch on public.rs_contract_terms;
create trigger trg_rs_contract_terms_touch before update on public.rs_contract_terms
for each row execute function public.touch_updated_at();

drop trigger if exists trg_work_batches_touch on public.work_batches;
create trigger trg_work_batches_touch before update on public.work_batches
for each row execute function public.touch_updated_at();

drop trigger if exists trg_work_submission_cycles_touch on public.work_submission_cycles;
create trigger trg_work_submission_cycles_touch before update on public.work_submission_cycles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_production_cost_entries_touch on public.production_cost_entries;
create trigger trg_production_cost_entries_touch before update on public.production_cost_entries
for each row execute function public.touch_updated_at();

drop trigger if exists trg_stage_assignment_parallel_rule on public.project_stage_assignments;
create trigger trg_stage_assignment_parallel_rule
before insert or update on public.project_stage_assignments
for each row execute function public.ensure_stage_assignment_parallel_rule();

drop trigger if exists trg_rs_contract_terms_current on public.rs_contract_terms;
create trigger trg_rs_contract_terms_current
before insert or update on public.rs_contract_terms
for each row execute function public.set_current_rs_contract_term();

drop trigger if exists trg_work_batches_cost_sync on public.work_batches;
create trigger trg_work_batches_cost_sync
after insert or update on public.work_batches
for each row execute function public.sync_production_cost_entry();

alter table public.project_stage_defs enable row level security;
alter table public.project_stage_assignments enable row level security;
alter table public.rs_contract_terms enable row level security;
alter table public.work_batches enable row level security;
alter table public.work_submission_cycles enable row level security;
alter table public.production_cost_entries enable row level security;

do $policy$
declare
  t text;
begin
  foreach t in array array[
    'project_stage_defs',
    'project_stage_assignments',
    'rs_contract_terms',
    'work_batches',
    'work_submission_cycles',
    'production_cost_entries'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'p_'||t||'_org_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_org_member(organization_id))',
      'p_'||t||'_org_read',
      t
    );

    execute format('drop policy if exists %I on public.%I', 'p_'||t||'_org_write', t);
    execute format(
      'create policy %I on public.%I for all using (public.has_org_role(organization_id, array[''owner''::member_role,''admin''::member_role,''pd_manager''::member_role,''pd_editor''::member_role])) with check (public.has_org_role(organization_id, array[''owner''::member_role,''admin''::member_role,''pd_manager''::member_role,''pd_editor''::member_role]))',
      'p_'||t||'_org_write',
      t
    );
  end loop;
end;
$policy$;

create or replace view public.writer_latest_rs_view as
select distinct on (rct.organization_id, rct.writer_id, rct.stage_def_id)
  rct.organization_id,
  rct.writer_id,
  rct.stage_def_id,
  psd.stage_name,
  rct.project_id,
  p.title as project_title,
  rct.id as rs_contract_term_id,
  rct.amount_basis,
  rct.unit_amount,
  rct.currency_code,
  rct.effective_start_date,
  rct.effective_end_date,
  rct.scope_note,
  (
    select max(pce.approved_at)
    from public.production_cost_entries pce
    where pce.writer_id = rct.writer_id
      and pce.stage_def_id = rct.stage_def_id
      and pce.deleted_at is null
  ) as latest_completed_at
from public.rs_contract_terms rct
join public.project_stage_defs psd
  on psd.id = rct.stage_def_id
join public.projects p
  on p.id = rct.project_id
where rct.deleted_at is null
  and rct.is_current = true
order by rct.organization_id, rct.writer_id, rct.stage_def_id, rct.effective_start_date desc, rct.created_at desc;
