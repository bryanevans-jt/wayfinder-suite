# Deploying Joshua Tree Reports (Wayfinder monorepo)

Integrated reporting lives in **`apps/reports`** inside [wayfinder-suite](https://github.com/bryanevans-jt/wayfinder-suite). It does **not** deploy from the retired standalone `jtsg-reports-v2` repo.

> Never commit `.env.local`. Use the same **Wayfinder Pro Supabase project** as `apps/staff`.

## Vercel project

1. **Add New → Project** → import `wayfinder-suite`.
2. **Root Directory:** `apps/reports`
3. Framework: Next.js (auto-detected).

## Environment variables

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same Supabase project as Wayfinder Pro |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as staff |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as staff (server routes) |
| `NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN` | Production: `.thejoshuatree.org` (shared sign-in with staff) |
| `NEXT_PUBLIC_STAFF_APP_URL` | Wayfinder Pro URL |
| `NEXT_PUBLIC_REPORTS_APP_URL` | This app’s production URL |
| `GOOGLE_OAUTH_CLIENT_ID` | Server Google APIs (see below) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Server Google APIs |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Server Google APIs |
| `CRON_SECRET` | Vercel cron `Authorization: Bearer …` |
| `VPR_MIGRATION_SHEET_ID` | Optional one-time admin VPR sheet import only |

After deploy, set **`NEXT_PUBLIC_REPORTS_APP_URL`** on the **staff** Vercel project and add the reports URL to Supabase **Authentication → Redirect URLs**.

See also `apps/reports/.env.example` and `docs/reporting-integration.md`.

## Supabase redirect URLs

Add your reports host, e.g.:

- `https://wayfinder-reports.thejoshuatree.org/auth/callback`

Google **user sign-in** uses Supabase Auth (`signInWithOAuth({ provider: 'google' })`). In Google Cloud, the redirect URI is your Supabase project’s auth callback:

- `https://<YOUR_WAYFINDER_SUPABASE_PROJECT>.supabase.co/auth/v1/callback`

(not the legacy reporting-only Supabase project).

## Health check

`GET /api/health` — expect `{ ok: true, googleOAuth: true }` when the Google API trio is set.

Crons are defined in `apps/reports/vercel.json` (missing/overdue reports, etc.).
