-- PD Ops Workspace seed (safe sample, no auth.users dependency)
-- Use after core migration.

insert into public.organizations (id, code, name, status)
values ('11111111-1111-1111-1111-111111111111', 'demo-org', 'Demo Organization', 'active')
on conflict (id) do nothing;

insert into public.projects (
  id, organization_id, code, title, genre, start_date, end_date, status
)
values
  ('20000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'SEA-001', 'Sea West', 'Fantasy', '2026-03-01', '2026-06-30', 'active'),
  ('20000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'CITY-002', 'City Fragments', 'Action', '2026-03-05', '2026-07-20', 'active')
on conflict (organization_id, code) do nothing;

insert into public.writers (
  id, organization_id, legal_name, primary_pen_name, employment_type, overall_grade, work_grade, deadline_grade, communication_grade, recommendation
)
values
  ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Hong Jihun', 'Hunjak', 'external', 'A', 'A', 'B', 'B', 'priority'),
  ('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Kim Seoyoon', 'Seoyoon', 'external', 'C', 'B', 'C', 'C', 'caution')
on conflict (id) do nothing;

insert into public.writer_aliases (id, organization_id, writer_id, alias_name, is_primary)
values
  ('31000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000001', 'Hunjak', true),
  ('31000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000002', 'Seoyoon', true)
on conflict (organization_id, writer_id, alias_name) do nothing;

insert into public.writer_contacts (id, organization_id, writer_id, contact_type, contact_value, is_primary)
values
  ('32000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000001', 'phone', '010-2394-1190', true),
  ('32000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '30000000-0000-0000-0000-000000000002', 'email', 'kim@sample.com', true)
on conflict do nothing;

insert into public.project_participants (
  id, organization_id, project_id, writer_id, role, status, started_at
)
values
  ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Conti', 'active', '2026-03-01'),
  ('40000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'Line Art', 'active', '2026-03-01')
on conflict (id) do nothing;

insert into public.tasks (
  id, organization_id, project_id, participant_id, writer_id, episode_no, task_type, title,
  planned_start_date, planned_end_date, current_start_date, current_end_date, status, feedback_done
)
values
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 12, 'Conti', 'Episode 12 Conti Draft', '2026-03-18', '2026-03-20', '2026-03-18', '2026-03-21', 'in_progress', false),
  ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 12, 'Line Art', 'Episode 12 Line Art', '2026-03-21', '2026-03-26', '2026-03-22', '2026-03-29', 'hold', false)
on conflict (id) do nothing;

insert into public.weekly_reports (
  id, organization_id, week_start, week_end, report_scope, writer_id, recommendation, score, weekly_note, submitted_at
)
values
  ('60000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-03-23', '2026-03-29', 'all', '30000000-0000-0000-0000-000000000001', 'priority', 4, 'Fast turnaround with minor communication lag.', now()),
  ('60000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '2026-03-23', '2026-03-29', 'all', '30000000-0000-0000-0000-000000000002', 'caution', 2, 'Repeated delay risk observed this week.', now())
on conflict (organization_id, week_start, report_scope, writer_id) do nothing;

insert into public.project_stage_defs (
  id, organization_id, project_id, stage_code, stage_name, sort_order, is_active, allow_parallel_workers, note
)
values
  ('71000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', 'story', '글/원작', 1, true, false, 'Default stage template'),
  ('71000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', 'conti', '콘티', 2, true, false, 'Default stage template'),
  ('71000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', 'line', '선화', 3, true, false, 'Default stage template'),
  ('71000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', 'flat', '밑색', 4, true, false, 'Default stage template'),
  ('71000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', 'shade', '명암', 5, true, false, 'Default stage template'),
  ('71000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', 'bg', '배경', 6, true, true, 'Shared background support'),
  ('71000000-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', 'retouch', '후보정', 7, true, false, 'Default stage template'),
  ('71000000-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', 'edit', '편집', 8, true, false, 'Default stage template')
on conflict (project_id, stage_code) do nothing;

insert into public.project_stage_assignments (
  id, organization_id, project_id, stage_def_id, participant_id, writer_id, status, started_at, note
)
values
  ('72000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'active', '2026-03-01', 'Conti lead'),
  ('72000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'active', '2026-03-01', 'Line art lead')
on conflict (id) do nothing;

insert into public.rs_contract_terms (
  id, organization_id, project_id, stage_def_id, assignment_id, writer_id,
  effective_start_date, effective_end_date, amount_basis, unit_amount, currency_code,
  scope_note, change_reason, is_current
)
values
  ('73000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '2026-03-01', null, 'scope_batch', 400000, 'KRW', 'Episode 12-18 conti batch', 'Initial contract', true),
  ('73000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '2026-03-01', '2026-03-24', 'scope_batch', 1000000, 'KRW', 'Episode 12 line art batch', 'Initial contract', false),
  ('73000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '2026-03-25', null, 'scope_batch', 1150000, 'KRW', 'Episode 12 line art batch revised', 'Raised after stronger output', true)
on conflict (id) do nothing;

insert into public.work_batches (
  id, organization_id, project_id, stage_def_id, assignment_id, writer_id, legacy_task_id,
  title, scope_label, episode_start, episode_end, planned_note, status,
  planned_start_date, planned_end_date, current_start_date, current_end_date,
  rs_contract_term_id, approved_at
)
values
  ('74000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Episode 12 Conti Draft', '12화 콘티 1차', 12, 12, 'Shared internally before line art handoff', 'submitted', '2026-03-18', '2026-03-20', '2026-03-18', '2026-03-21', '73000000-0000-0000-0000-000000000001', null),
  ('74000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '20000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', '72000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'Episode 12 Line Art', '12화 선화 본작업', 12, 12, 'Revision requested after first delivery', 'feedback_requested', '2026-03-21', '2026-03-26', '2026-03-22', '2026-03-29', '73000000-0000-0000-0000-000000000003', null)
on conflict (id) do nothing;

insert into public.work_submission_cycles (
  id, organization_id, work_batch_id, cycle_no, submitted_at, submission_note,
  pd_checked_at, feedback_note, revision_due_at, resubmitted_at, is_approved
)
values
  ('75000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '74000000-0000-0000-0000-000000000001', 1, '2026-03-21T11:00:00+09:00', 'Conti first delivery uploaded.', '2026-03-21T15:00:00+09:00', null, null, null, false),
  ('75000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '74000000-0000-0000-0000-000000000002', 1, '2026-03-29T10:00:00+09:00', 'Line art first delivery uploaded.', '2026-03-29T16:00:00+09:00', 'Facial consistency and action panel cleanup required.', '2026-04-01T18:00:00+09:00', null, false)
on conflict (work_batch_id, cycle_no) do nothing;

