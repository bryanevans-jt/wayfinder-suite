-- Soft-hide and merge program groups (no destructive deletes from Schools & groups UI).

alter table public.pre_ets_program_groups
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by uuid references public.profiles (id) on delete set null,
  add column if not exists hidden_reason text,
  add column if not exists merged_into_program_group_id uuid references public.pre_ets_program_groups (id) on delete set null;

create index if not exists pre_ets_program_groups_hidden_idx
  on public.pre_ets_program_groups (school_id, service_month, hidden_at);
