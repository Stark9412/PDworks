create or replace function private.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_org public.organizations%rowtype;
  requested_org_code text := lower(coalesce(new.raw_user_meta_data->>'organization_code', 'kenaz'));
  active_member_count int := 0;
  default_team_id uuid := null;
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

  select *
    into requested_org
  from public.organizations
  where code = requested_org_code
    and status = 'active'
    and deleted_at is null
  limit 1;

  if requested_org.id is not null then
    select count(*)
      into active_member_count
    from public.org_memberships
    where organization_id = requested_org.id
      and is_active = true
      and deleted_at is null;

    if active_member_count = 0 then
      update public.profiles
      set status = 'active',
          updated_at = now()
      where id = new.id;

      insert into public.org_memberships (
        organization_id,
        user_id,
        role,
        is_active,
        approved_at,
        created_at,
        updated_at
      )
      values (
        requested_org.id,
        new.id,
        'owner',
        true,
        now(),
        now(),
        now()
      )
      on conflict (organization_id, user_id, role) do update
      set is_active = true,
          approved_at = coalesce(public.org_memberships.approved_at, now()),
          updated_at = now();

      select id
        into default_team_id
      from public.teams
      where organization_id = requested_org.id
        and deleted_at is null
      order by team_number asc, created_at asc
      limit 1;

      if default_team_id is not null then
        insert into public.team_memberships (
          organization_id,
          team_id,
          user_id,
          role,
          is_primary,
          is_active,
          approved_at,
          created_at,
          updated_at
        )
        values (
          requested_org.id,
          default_team_id,
          new.id,
          'owner',
          true,
          true,
          now(),
          now(),
          now()
        )
        on conflict do nothing;
      end if;
    else
      insert into public.org_memberships (organization_id, user_id, role, is_active, created_at, updated_at)
      values (requested_org.id, new.id, 'pd_editor', false, now(), now())
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.auto_confirm_auth_user()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;

  new.confirmation_token := coalesce(new.confirmation_token, '');
  return new;
end;
$$;

drop trigger if exists trg_auto_confirm_auth_user on auth.users;
create trigger trg_auto_confirm_auth_user
before insert on auth.users
for each row execute function private.auto_confirm_auth_user();
