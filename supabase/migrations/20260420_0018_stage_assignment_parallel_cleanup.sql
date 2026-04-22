-- Allow cleanup and non-active updates on stage assignments without tripping
-- the parallel assignment rule. The overlap guard should only apply to
-- active rows that remain effective after the write.

create or replace function public.ensure_stage_assignment_parallel_rule()
returns trigger
language plpgsql
as $$
declare
  allow_parallel boolean;
  overlap_count int;
begin
  if new.deleted_at is not null or coalesce(new.status, 'active') <> 'active' then
    return new;
  end if;

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
