alter table public.weekly_reports
  add column if not exists project_issue_note text;

alter table public.weekly_reports
  add column if not exists next_week_note text;
