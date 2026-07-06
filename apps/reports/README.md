# Wayfinder Reports (`@wayfinder/reports`)

Formal GVRA/Tennessee reporting for Wayfinder Pro. Ported from [jtsg-reports-v2](https://github.com/bryanevans-jt/jtsg-reports-v2) `/v2` (the standalone repo is unchanged).

## Local development

1. Apply reporting migrations to your **Wayfinder Pro** Supabase project (in order):
   - `supabase/migrations/20260624100000_reporting_integration.sql`
   - `supabase/migrations/20260625100000_report_alerts_compliance.sql`
2. Copy `apps/reports/.env.example` to `apps/reports/.env.local` and use the **same** Supabase URL/keys as `apps/staff`.
3. From the monorepo root:

```bash
npm install
npm run dev:reports   # http://localhost:3002
npm run dev:staff     # http://localhost:3000
```

Set in staff `.env.local`:

```
NEXT_PUBLIC_REPORTS_APP_URL=http://localhost:3002
```

## Google Workspace (Drive / Docs / Gmail)

Required server env vars (see `.env.example`):

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`

GA folder and template IDs are seeded by the reporting migration. Adjust in `/admin` if needed.

Time Sheet blank PDF is seeded as Google Drive file ID `1M_ShNpk7HgLAtehKohUxB5SzqTwoOSdi`.

## Production deploy (Vercel)

Create a **separate Vercel project** with root directory `apps/reports`.

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as Wayfinder Pro |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as Wayfinder Pro |
| `SUPABASE_SERVICE_ROLE_KEY` | Same as Wayfinder Pro |
| `NEXT_PUBLIC_STAFF_APP_URL` | e.g. `https://wayfinder-pro.thejoshuatree.org` |
| `NEXT_PUBLIC_REPORTS_APP_URL` | This app's production URL |
| Google OAuth trio | Same refresh token as v2 if already working |
| `CRON_SECRET` | Random string; Vercel crons send `Authorization: Bearer …` |
| VAPID keys (optional) | Same as staff for push on report alerts |

After deploy:

1. Hit `GET /api/health` — should return `{ ok: true }`.
2. Set `NEXT_PUBLIC_REPORTS_APP_URL` on the **staff** Vercel project to the reports URL.
3. Add the reports URL to Supabase **Authentication → Redirect URLs**.

`vercel.json` schedules missing-report (7th) and overdue-report (10th) crons.

## Shared sign-in with Wayfinder Pro

Both apps use the same Supabase project and PKCE auth. In production, configure Supabase so session cookies work across your staff and reports hostnames (typically subdomains of `thejoshuatree.org`). Users open reporting from **Wayfinder Pro → Reporting** or sign in directly on the reports app.

## Admin

- `/admin` — GA Drive folders, Google Doc templates, notification recipients, Tennessee program catalog
- Access: Wayfinder `super_admin` / `admin` profiles, or legacy `report_user_roles`

## Alpha / beta test plan

### Alpha (you)

- [ ] Migrations applied on production Supabase
- [ ] Reports app deployed; `/api/health` OK
- [ ] Staff `NEXT_PUBLIC_REPORTS_APP_URL` points at reports app
- [ ] Google sign-in works on reports app
- [ ] Submit each GA report type once (SE Monthly, VPR, JTSG VMR, EVF, Time Sheet upload)
- [ ] SE Monthly recall + job dev prefill from Wayfinder client
- [ ] Submitted reports appear on Wayfinder client profile
- [ ] Cron test: `GET /api/cron/missing-reports?secret=CRON_SECRET`

### Supervisor beta

- [ ] ES + supervisor see dashboard alert banner when reports are missing/overdue
- [ ] In-app notifications fire for missing/overdue SE Monthly
- [ ] Supervisor scoped alerts (only their ES / offices)
- [ ] Launch Official Reporting from client profile deep link

### Tennessee (as templates are added)

- [ ] Enable program in `/admin` → Tennessee VR Programs
- [ ] Add report type with template IDs / tag schema
- [ ] Confirm TN appears in state selector for TN-office caseload

## Cutover from legacy v2 / Firebase

| Phase | Action |
|-------|--------|
| **Now** | Beta on integrated app (`NEXT_PUBLIC_REPORTS_APP_URL`) |
| **Parallel** | Keep `jtsg-reports-v2.vercel.app` until beta passes |
| **Cutover** | Point staff reporting launcher at production reports URL; update any bookmarks |
| **Retire** | Disable Firebase hosting/functions after 2–4 weeks stable production use |
| **Data** | Legacy Supabase (`xkhybcyiyjmghzevgmgm`) can be archived after migration verified |

Do **not** modify the `jtsg-reports-v2` GitHub repo — it remains the reference until cutover.

## Support

Non–super-admin errors: contact Bryan Evans at bryan.evans@thejoshuatree.org (shown in-app on login footer).
