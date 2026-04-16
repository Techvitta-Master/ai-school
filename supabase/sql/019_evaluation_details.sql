-- 019_evaluation_details.sql
-- Extends public.evaluations with a grade column and a details jsonb column
-- for the full RCA output (per-question scores, topic analysis, improvement plan).
--
-- Run after: 015_evaluations.sql
-- Safe to re-run — uses IF NOT EXISTS.

begin;

alter table public.evaluations
  add column if not exists grade   text,
  add column if not exists details jsonb not null default '{}'::jsonb;

commit;
