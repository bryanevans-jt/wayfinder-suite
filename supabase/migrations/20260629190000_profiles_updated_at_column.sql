-- Legacy production DBs may lack profiles.updated_at (added in 20250512000000).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
