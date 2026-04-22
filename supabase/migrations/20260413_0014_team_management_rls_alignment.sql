-- Align team management RLS with current product behavior:
-- owner/admin/pd_manager can approve join requests and manage team placement
-- inside the same organization.

drop policy if exists p_org_memberships_admin_manage on public.org_memberships;
create policy p_org_memberships_admin_manage on public.org_memberships
for all using (
  private.has_active_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'pd_manager'::public.member_role
    ]
  )
)
with check (
  private.has_active_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'pd_manager'::public.member_role
    ]
  )
);

drop policy if exists p_team_memberships_admin_write on public.team_memberships;
create policy p_team_memberships_admin_write on public.team_memberships
for all using (
  private.has_active_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'pd_manager'::public.member_role
    ]
  )
)
with check (
  private.has_active_org_role(
    organization_id,
    array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'pd_manager'::public.member_role
    ]
  )
);

create or replace function private.can_update_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_profile_id = auth.uid()
    or exists (
      select 1
      from public.org_memberships actor_membership
      join public.org_memberships target_membership
        on target_membership.organization_id = actor_membership.organization_id
      where actor_membership.user_id = auth.uid()
        and actor_membership.role in ('owner', 'admin', 'pd_manager')
        and actor_membership.is_active = true
        and actor_membership.deleted_at is null
        and target_membership.user_id = p_profile_id
        and target_membership.deleted_at is null
    );
$$;

grant execute on function private.can_update_profile(uuid) to anon, authenticated, service_role;
