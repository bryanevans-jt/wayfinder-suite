-- Workplace Readiness Training curriculum (admin-authored modules / lessons / blocks).
-- Preview-only in app UI; does not enroll or modify existing Workplace Readiness clients.

create table if not exists public.wrt_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  citations text,
  sort_order int not null default 0,
  is_optional boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wrt_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.wrt_modules (id) on delete cascade,
  slug text not null,
  title text not null,
  objectives text,
  desired_outcomes text,
  facilitator_notes text,
  citations text,
  default_duration_minutes int not null default 30,
  sort_order int not null default 0,
  is_optional boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wrt_lessons_duration_check check (default_duration_minutes > 0),
  constraint wrt_lessons_module_slug_unique unique (module_id, slug)
);

create index if not exists wrt_lessons_module_sort_idx
  on public.wrt_lessons (module_id, sort_order);

create table if not exists public.wrt_lesson_blocks (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.wrt_lessons (id) on delete cascade,
  block_type text not null,
  title text,
  body text,
  url text,
  meta jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wrt_lesson_blocks_type_check check (
    block_type in ('rich_text', 'youtube', 'pdf_link', 'quiz', 'activity', 'external_link')
  )
);

create index if not exists wrt_lesson_blocks_lesson_sort_idx
  on public.wrt_lesson_blocks (lesson_id, sort_order);

alter table public.wrt_modules enable row level security;
alter table public.wrt_lessons enable row level security;
alter table public.wrt_lesson_blocks enable row level security;
