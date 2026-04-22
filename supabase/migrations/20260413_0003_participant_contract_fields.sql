-- Add project-specific MG / RS fields to participants

alter table if exists public.project_participants
  add column if not exists fee_label text,
  add column if not exists rs_ratio numeric(6,2);
