-- Staff profile fields, demo/training clients, and metrics isolation.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS home_city text,
  ADD COLUMN IF NOT EXISTS bio text;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_is_demo_idx ON public.clients (is_demo) WHERE is_demo = true;

COMMENT ON COLUMN public.clients.is_demo IS
  'Training/demo caseload — excluded from analytics, compliance alerts, and org metrics.';
COMMENT ON COLUMN public.clients.demo_created_by IS
  'Super admin who created this demo client; only super admins may create demo clients.';
