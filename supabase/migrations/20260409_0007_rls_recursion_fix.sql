create schema if not exists private;

grant usage on schema private to anon, authenticated, service_role;

create or replace function private.is_active_org_member(p_org_id uuid)
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
      and m.user_id = auth.uid()
      and m.is_active = true
      and m.deleted_at is null
      and p.status = 'active'
      and p.deleted_at is null
  );
$$;

create or replace function private.has_active_org_role(p_org_id uuid, p_roles public.member_role[])
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
      and m.user_id = auth.uid()
      and m.is_active = true
      and m.deleted_at is null
      and p.status = 'active'
      and p.deleted_at is null
      and m.role = any (p_roles)
  );
$$;

create or replace function private.is_active_team_member(p_org_id uuid, p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_memberships tm
    join public.profiles p
      on p.id = tm.user_id
    where tm.organization_id = p_org_id
      and tm.team_id = p_team_id
      and tm.user_id = auth.uid()
      and tm.is_active = true
      and tm.deleted_at is null
      and p.status = 'active'
      and p.deleted_at is null
  );
$$;

create or replace function private.can_read_team_scoped(p_org_id uuid, p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_active_org_member(p_org_id)
    and (
      p_team_id is null
      or private.has_active_org_role(
        p_org_id,
        array['owner'::public.member_role, 'admin'::public.member_role, 'pd_manager'::public.member_role, 'executive_viewer'::public.member_role, 'auditor'::public.member_role]
      )
      or private.is_active_team_member(p_org_id, p_team_id)
    );
$$;

create or replace function private.can_write_team_scoped(p_org_id uuid, p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_active_org_role(p_org_id, array['owner'::public.member_role, 'admin'::public.member_role, 'pd_manager'::public.member_role])
    or (
      private.has_active_org_role(p_org_id, array['pd_editor'::public.member_role])
      and p_team_id is not null
      and private.is_active_team_member(p_org_id, p_team_id)
    );
$$;

create or replace function private.can_read_profile(p_profile_id uuid)
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
      from public.org_memberships self_member
      join public.org_memberships target_member
        on target_member.organization_id = self_member.organization_id
      where self_member.user_id = auth.uid()
        and self_member.is_active = true
        and self_member.deleted_at is null
        and target_member.user_id = p_profile_id
        and target_member.deleted_at is null
    );
$$;

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
      from public.org_memberships m
      where m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
        and m.is_active = true
        and m.deleted_at is null
        and m.organization_id in (
          select target.organization_id
          from public.org_memberships target
          where target.user_id = p_profile_id
            and target.deleted_at is null
        )
    );
$$;

grant execute on function private.is_active_org_member(uuid) to anon, authenticated, service_role;
grant execute on function private.has_active_org_role(uuid, public.member_role[]) to anon, authenticated, service_role;
grant execute on function private.is_active_team_member(uuid, uuid) to anon, authenticated, service_role;
grant execute on function private.can_read_team_scoped(uuid, uuid) to anon, authenticated, service_role;
grant execute on function private.can_write_team_scoped(uuid, uuid) to anon, authenticated, service_role;
grant execute on function private.can_read_profile(uuid) to anon, authenticated, service_role;
grant execute on function private.can_update_profile(uuid) to anon, authenticated, service_role;

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select private.is_active_org_member(p_org_id);
$$;

create or replace function public.has_org_role(p_org_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
as $$
  select private.has_active_org_role(p_org_id, p_roles);
$$;

create or replace function public.is_active_org_member(p_org_id uuid)
returns boolean
language sql
stable
as $$
  select private.is_active_org_member(p_org_id);
$$;

create or replace function public.has_active_org_role(p_org_id uuid, p_roles public.member_role[])
returns boolean
language sql
stable
as $$
  select private.has_active_org_role(p_org_id, p_roles);
$$;

create or replace function public.is_active_team_member(p_org_id uuid, p_team_id uuid)
returns boolean
language sql
stable
as $$
  select private.is_active_team_member(p_org_id, p_team_id);
$$;

create or replace function public.can_read_team_scoped(p_org_id uuid, p_team_id uuid)
returns boolean
language sql
stable
as $$
  select private.can_read_team_scoped(p_org_id, p_team_id);
$$;

create or replace function public.can_write_team_scoped(p_org_id uuid, p_team_id uuid)
returns boolean
language sql
stable
as $$
  select private.can_write_team_scoped(p_org_id, p_team_id);
$$;

drop policy if exists p_profiles_org_read on public.profiles;
create policy p_profiles_org_read on public.profiles
for select using (private.can_read_profile(id));

drop policy if exists p_profiles_self_or_admin_update on public.profiles;
create policy p_profiles_self_or_admin_update on public.profiles
for update using (private.can_update_profile(id)) with check (true);

drop policy if exists p_org_memberships_self_read on public.org_memberships;
create policy p_org_memberships_self_read on public.org_memberships
for select using (user_id = auth.uid() or private.is_active_org_member(organization_id));

drop policy if exists p_org_memberships_admin_manage on public.org_memberships;
create policy p_org_memberships_admin_manage on public.org_memberships
for all using (private.has_active_org_role(organization_id, array['owner'::public.member_role, 'admin'::public.member_role]))
with check (private.has_active_org_role(organization_id, array['owner'::public.member_role, 'admin'::public.member_role]));

drop policy if exists p_teams_org_read on public.teams;
create policy p_teams_org_read on public.teams
for select using (private.is_active_org_member(organization_id));

drop policy if exists p_teams_admin_write on public.teams;
create policy p_teams_admin_write on public.teams
for all using (private.has_active_org_role(organization_id, array['owner'::public.member_role, 'admin'::public.member_role]))
with check (private.has_active_org_role(organization_id, array['owner'::public.member_role, 'admin'::public.member_role]));

drop policy if exists p_team_memberships_org_read on public.team_memberships;
create policy p_team_memberships_org_read on public.team_memberships
for select using (private.is_active_org_member(organization_id));

drop policy if exists p_team_memberships_admin_write on public.team_memberships;
create policy p_team_memberships_admin_write on public.team_memberships
for all using (private.has_active_org_role(organization_id, array['owner'::public.member_role, 'admin'::public.member_role]))
with check (private.has_active_org_role(organization_id, array['owner'::public.member_role, 'admin'::public.member_role]));
