-- Production bootstrap helper for the first organization, team, and admin.
-- Run after the user has signed up once through Supabase Auth.
-- Update the values inside the params CTE before executing.

begin;

with params as (
  select
    'kenaz'::text as organization_code,
    'Kenaz Studio'::text as organization_name,
    1::int as team_number,
    'Team 1'::text as team_name,
    'owner@example.com'::citext as admin_email,
    'owner'::public.member_role as org_role,
    'owner'::public.member_role as team_role
),
org_upsert as (
  insert into public.organizations (code, name)
  select organization_code, organization_name
  from params
  on conflict (code) do update
    set name = excluded.name,
        updated_at = now()
  returning id, code
),
org_row as (
  select id, code from org_upsert
  union all
  select o.id, o.code
  from public.organizations o
  join params p on p.organization_code = o.code
),
team_upsert as (
  insert into public.teams (organization_id, team_number, team_name, status)
  select o.id, p.team_number, p.team_name, 'active'
  from org_row o
  cross join params p
  on conflict (organization_id, team_number) do update
    set team_name = excluded.team_name,
        status = 'active',
        updated_at = now()
  returning id, organization_id
),
team_row as (
  select id, organization_id from team_upsert
  union all
  select t.id, t.organization_id
  from public.teams t
  join org_row o on o.id = t.organization_id
  join params p on p.team_number = t.team_number
),
admin_profile as (
  select pr.id, pr.email
  from public.profiles pr
  join params p on pr.email = p.admin_email
)
insert into public.org_memberships (
  organization_id,
  user_id,
  role,
  is_active,
  approved_at,
  created_at,
  updated_at
)
select
  o.id,
  a.id,
  p.org_role,
  true,
  now(),
  now(),
  now()
from org_row o
cross join admin_profile a
cross join params p
on conflict (organization_id, user_id, role) do update
  set is_active = true,
      approved_at = coalesce(public.org_memberships.approved_at, now()),
      updated_at = now();

with params as (
  select
    'kenaz'::text as organization_code,
    1::int as team_number,
    'owner@example.com'::citext as admin_email,
    'owner'::public.member_role as team_role
),
org_row as (
  select id
  from public.organizations
  where code = (select organization_code from params)
),
team_row as (
  select t.id, t.organization_id
  from public.teams t
  join org_row o on o.id = t.organization_id
  join params p on p.team_number = t.team_number
),
admin_profile as (
  select id
  from public.profiles
  where email = (select admin_email from params)
)
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
select
  t.organization_id,
  t.id,
  a.id,
  p.team_role,
  true,
  true,
  now(),
  now(),
  now()
from team_row t
cross join admin_profile a
cross join params p
where not exists (
  select 1
  from public.team_memberships tm
  where tm.team_id = t.id
    and tm.user_id = a.id
    and tm.deleted_at is null
)
on conflict do nothing;

select o.id as organization_id, o.code, o.name, o.status
from public.organizations o
where o.code = 'kenaz';

select t.id as team_id, t.team_number, t.team_name, t.status
from public.teams t
join public.organizations o on o.id = t.organization_id
where o.code = 'kenaz'
order by t.team_number;

select
  pr.email,
  om.role as organization_role,
  om.is_active as organization_active,
  tm.role as team_role,
  tm.is_active as team_active
from public.profiles pr
join public.org_memberships om on om.user_id = pr.id and om.deleted_at is null
left join public.team_memberships tm on tm.user_id = pr.id and tm.deleted_at is null
join public.organizations o on o.id = om.organization_id
where o.code = 'kenaz'
  and pr.email = 'owner@example.com';

commit;
