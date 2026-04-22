alter table public.projects
  add column if not exists team_label text,
  add column if not exists total_episodes int,
  add column if not exists production_mode text,
  add column if not exists co_production text,
  add column if not exists co_production_partners text[] not null default '{}',
  add column if not exists serialization_end_date date,
  add column if not exists derivative_memo text;
