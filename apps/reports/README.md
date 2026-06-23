# Wayfinder Reports (`@wayfinder/reports`)

Formal GVRA/Tennessee reporting for Wayfinder Pro. Ported from [jtsg-reports-v2](https://github.com/bryanevans-jt/jtsg-reports-v2) `/v2` (the standalone repo is unchanged).

## Local development

1. Apply `supabase/migrations/20260624100000_reporting_integration.sql` to your **Wayfinder Pro** Supabase project.
2. Copy `.env.example` to `.env.local` and use the **same** Supabase URL/keys as `apps/staff`.
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

## Deploy

Separate Vercel project rooted at `apps/reports`, with the same Supabase and Google env vars as production Wayfinder Pro.

## Admin

- `/admin` — templates, Drive folders, notification recipients, TN program catalog (coming in Week 2 UI)
- Access: Wayfinder `super_admin` / `admin` profiles, or legacy `report_user_roles`
