-- Onboarding App only (Supabase project hvtvrbviykvcwaryauta).
-- Do not apply this file to Wayfinder-Production.
--
-- training_modules / training_settings were created outside tracked migrations
-- with RLS off. The onboarding app reads/writes them exclusively via the
-- service role (NextAuth Google gate + SUPABASE_SERVICE_ROLE_KEY), matching
-- onboarding_links / app_settings. Enable RLS with no policies so anon and
-- authenticated lose table access while service_role continues to bypass RLS.

alter table public.training_modules enable row level security;
alter table public.training_settings enable row level security;

-- Service role bypasses RLS. No policies needed for server-only access.
-- If a future client path needs direct access, add policies here.
