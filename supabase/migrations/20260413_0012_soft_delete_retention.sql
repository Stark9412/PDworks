create extension if not exists pg_cron;

create schema if not exists private;

create or replace function private.purge_soft_deleted_workspace_data()
returns integer
language plpgsql
as $$
declare
  retention_threshold timestamptz := now() - interval '7 days';
  deleted_count integer := 0;
  affected_count integer := 0;
begin
  delete from public.production_cost_entries
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.work_submission_cycles
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.work_batches
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.change_histories
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.task_schedule_changes
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.weekly_report_items
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.writer_evidence_notes
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.production_costs
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.service_platforms
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.derivative_plannings
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.writer_evaluations
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.pd_evaluations
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.weekly_reports
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.tasks
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.rs_contract_terms
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.project_stage_assignments
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.project_participants
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.project_stage_defs
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.writer_contacts
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.writer_aliases
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.projects
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  delete from public.writers
  where deleted_at is not null
    and deleted_at <= retention_threshold;
  get diagnostics affected_count = row_count;
  deleted_count := deleted_count + affected_count;

  return deleted_count;
end;
$$;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'workspace-soft-delete-retention'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'workspace-soft-delete-retention',
    '5 18 * * *',
    'select private.purge_soft_deleted_workspace_data();'
  );
end;
$$;
