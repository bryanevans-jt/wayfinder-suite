-- One-time Pre-ETS fresh start (schools, groups, imports, rosters).
-- Run once in Supabase Dashboard → SQL Editor.
-- Keeps: pre_ets_settings, staff profiles, Pre-ETS module configuration.
-- Does NOT deploy with migrations; delete this file from the repo after you have run it if you prefer.

begin;

delete from public.pre_ets_worksheet_imports;
delete from public.pre_ets_worksheet_group_mappings;
delete from public.pre_ets_class_setup;

-- Cascades to gvra offices, schools, program groups, authorizations, rosters,
-- sessions, staff school assignments, schedule plans, invoice packets, etc.
delete from public.pre_ets_districts;

delete from public.pre_ets_students;

commit;
