-- Normalize legacy role rows to the current operating model:
-- - admin@kenaz-re.com remains the only development administrator
-- - owner/admin on other accounts become pd_manager
-- - auditor is folded into executive_viewer

with normalized_org_roles as (
  select
    om.id,
    case
      when lower(coalesce(p.email::text, '')) = 'admin@kenaz-re.com'
        and om.role in ('owner'::public.member_role, 'admin'::public.member_role)
        then 'owner'::public.member_role
      when om.role in ('owner'::public.member_role, 'admin'::public.member_role)
        then 'pd_manager'::public.member_role
      when om.role = 'auditor'::public.member_role
        then 'executive_viewer'::public.member_role
      else om.role
    end as next_role
  from public.org_memberships om
  join public.profiles p
    on p.id = om.user_id
  where om.deleted_at is null
),
normalized_team_roles as (
  select
    tm.id,
    case
      when lower(coalesce(p.email::text, '')) = 'admin@kenaz-re.com'
        and tm.role in ('owner'::public.member_role, 'admin'::public.member_role)
        then 'owner'::public.member_role
      when tm.role in ('owner'::public.member_role, 'admin'::public.member_role)
        then 'pd_manager'::public.member_role
      when tm.role = 'auditor'::public.member_role
        then 'executive_viewer'::public.member_role
      else tm.role
    end as next_role
  from public.team_memberships tm
  join public.profiles p
    on p.id = tm.user_id
  where tm.deleted_at is null
)
update public.org_memberships om
set role = normalized_org_roles.next_role,
    updated_at = now()
from normalized_org_roles
where normalized_org_roles.id = om.id
  and om.role is distinct from normalized_org_roles.next_role;

with normalized_team_roles as (
  select
    tm.id,
    case
      when lower(coalesce(p.email::text, '')) = 'admin@kenaz-re.com'
        and tm.role in ('owner'::public.member_role, 'admin'::public.member_role)
        then 'owner'::public.member_role
      when tm.role in ('owner'::public.member_role, 'admin'::public.member_role)
        then 'pd_manager'::public.member_role
      when tm.role = 'auditor'::public.member_role
        then 'executive_viewer'::public.member_role
      else tm.role
    end as next_role
  from public.team_memberships tm
  join public.profiles p
    on p.id = tm.user_id
  where tm.deleted_at is null
)
update public.team_memberships tm
set role = normalized_team_roles.next_role,
    updated_at = now()
from normalized_team_roles
where normalized_team_roles.id = tm.id
  and tm.role is distinct from normalized_team_roles.next_role;
