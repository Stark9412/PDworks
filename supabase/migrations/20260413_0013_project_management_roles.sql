create or replace function public.can_edit_project_scoped(p_org_id uuid, p_pd_user_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_active_org_member(p_org_id)
    and (
      public.has_active_org_role(
        p_org_id,
        array[
          'owner'::public.member_role,
          'admin'::public.member_role,
          'pd_manager'::public.member_role,
          'executive_viewer'::public.member_role
        ]
      )
      or auth.uid() = p_pd_user_id
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

drop policy if exists p_projects_project_write on public.projects;
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
    execute format('drop policy if exists %I on public.%I', 'p_'||t||'_project_write', t);
    execute format(
      'create policy %I on public.%I for all using (public.can_edit_project_ref(organization_id, project_id)) with check (public.can_edit_project_ref(organization_id, project_id))',
      'p_'||t||'_project_write',
      t
    );
  end loop;
end;
$policy$;
