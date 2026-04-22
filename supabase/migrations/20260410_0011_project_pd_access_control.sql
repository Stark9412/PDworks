create or replace function public.current_member_role(p_org_id uuid)
returns public.member_role
language sql
stable
as $$
  select m.role
  from public.org_memberships m
  join public.profiles p on p.id = m.user_id
  where m.organization_id = p_org_id
    and m.user_id = auth.uid()
    and m.is_active = true
    and m.deleted_at is null
    and p.status = 'active'
  order by
    case m.role
      when 'owner' then 5
      when 'admin' then 4
      when 'pd_manager' then 3
      when 'executive_viewer' then 2
      when 'auditor' then 2
      when 'pd_editor' then 1
      else 0
    end desc
  limit 1;
$$;

create or replace function public.can_view_project_scoped(p_org_id uuid, p_pd_user_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_active_org_member(p_org_id)
    and (
      public.current_member_role(p_org_id) in (
        'owner'::public.member_role,
        'admin'::public.member_role,
        'pd_manager'::public.member_role,
        'executive_viewer'::public.member_role,
        'auditor'::public.member_role
      )
      or (public.current_member_role(p_org_id) = 'pd_editor'::public.member_role and auth.uid() = p_pd_user_id)
    );
$$;

create or replace function public.can_edit_project_scoped(p_org_id uuid, p_pd_user_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_active_org_member(p_org_id)
    and (
      public.current_member_role(p_org_id) in ('owner'::public.member_role, 'admin'::public.member_role)
      or auth.uid() = p_pd_user_id
    );
$$;

create or replace function public.can_view_project_ref(p_org_id uuid, p_project_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.organization_id = p_org_id
      and p.deleted_at is null
      and public.can_view_project_scoped(p.organization_id, p.pd_user_id)
  );
$$;

create or replace function public.can_edit_project_ref(p_org_id uuid, p_project_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.organization_id = p_org_id
      and p.deleted_at is null
      and public.can_edit_project_scoped(p.organization_id, p.pd_user_id)
  );
$$;

drop policy if exists p_projects_team_read on public.projects;
create policy p_projects_project_read on public.projects
for select using (public.can_view_project_scoped(organization_id, pd_user_id));

drop policy if exists p_projects_team_write on public.projects;
create policy p_projects_project_write on public.projects
for all using (public.can_edit_project_scoped(organization_id, pd_user_id))
with check (public.can_edit_project_scoped(organization_id, pd_user_id));

do $policy$
declare
  t text;
begin
  foreach t in array array[
    'project_participants',
    'tasks',
    'task_schedule_changes',
    'weekly_reports',
    'project_stage_defs',
    'project_stage_assignments',
    'rs_contract_terms',
    'work_batches',
    'work_submission_cycles',
    'production_cost_entries',
    'production_costs',
    'service_platforms',
    'derivative_plannings',
    'change_histories',
    'writer_evaluations',
    'pd_evaluations'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'p_'||t||'_team_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.can_view_project_ref(organization_id, project_id))',
      'p_'||t||'_project_read',
      t
    );
    execute format('drop policy if exists %I on public.%I', 'p_'||t||'_team_write', t);
    execute format(
      'create policy %I on public.%I for all using (public.can_edit_project_ref(organization_id, project_id)) with check (public.can_edit_project_ref(organization_id, project_id))',
      'p_'||t||'_project_write',
      t
    );
  end loop;
end;
$policy$;
