create or replace function private.can_assign_project_pd_scoped(p_org_id uuid, p_pd_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.org_memberships m
    join public.profiles p
      on p.id = m.user_id
    where m.organization_id = p_org_id
      and m.user_id = p_pd_user_id
      and m.is_active = true
      and m.deleted_at is null
      and p.status = 'active'
      and p.deleted_at is null
  );
$$;

grant execute on function private.can_assign_project_pd_scoped(uuid, uuid) to anon, authenticated, service_role;

create or replace function public.can_create_project_scoped(p_org_id uuid, p_pd_user_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_active_org_member(p_org_id)
    and private.can_assign_project_pd_scoped(p_org_id, coalesce(p_pd_user_id, auth.uid()));
$$;

drop policy if exists p_projects_project_write on public.projects;
drop policy if exists p_projects_team_write on public.projects;
drop policy if exists p_projects_project_insert on public.projects;
drop policy if exists p_projects_project_update on public.projects;
drop policy if exists p_projects_project_delete on public.projects;

create policy p_projects_project_insert on public.projects
for insert
with check (public.can_create_project_scoped(organization_id, pd_user_id));

create policy p_projects_project_update on public.projects
for update
using (public.can_edit_project_scoped(organization_id, pd_user_id))
with check (public.can_edit_project_scoped(organization_id, pd_user_id));

create policy p_projects_project_delete on public.projects
for delete
using (public.can_edit_project_scoped(organization_id, pd_user_id));
