alter table public.admin_config
  add column if not exists es_training_demo jsonb;

comment on column public.admin_config.es_training_demo is
  'ES training demo handoff: { "trainingEsUserId": "<uuid>" }';
