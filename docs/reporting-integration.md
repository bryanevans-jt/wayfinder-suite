# Reporting integration (Wayfinder Suite)

## Runtime dependency on legacy jtsg-reports-v2

**None.** Production reporting is **`apps/reports`** in this monorepo, backed by the **same Supabase project** as Wayfinder Pro (`apps/staff`). Staff opens reporting via `NEXT_PUBLIC_REPORTS_APP_URL` / `buildReportsAppUrl()` — not the old Firebase app or `jtsg-reports-v2.vercel.app`.

| Item | Status |
|------|--------|
| Standalone `jtsg-reports-v2` repo / Vercel | Historical reference only; not called by this codebase |
| Legacy Supabase `xkhybcyiyjmghzevgmgm` | Not referenced in app code; do not point env vars at it |
| Retired vocationalreports URL | Removed from `@wayfinder/branding`; not used in suite |
| `scripts/v2-extract.mjs`, `.tmp-jtsg-reports-v2/` | Optional one-off migration helpers; gitignored output |
| `POST /api/admin/migrate-vpr` | One-time import from a **Google Sheet** (`VPR_MIGRATION_SHEET_ID`), not from v2 |

Database schema: `supabase/migrations/20260624100000_reporting_integration.sql` (and follow-ons).

## OAuth and Google credentials

Two separate mechanisms:

### 1. User sign-in (Google / magic link)

- **Configured in Supabase Dashboard** (Auth providers, redirect URLs, cookie domain).
- **App env:** `NEXT_PUBLIC_SUPABASE_*`, optional `NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN`.
- **Not** the `GOOGLE_OAUTH_*` trio below.

Used by `@wayfinder/auth-ui` → `supabase.auth.signInWithOAuth({ provider: 'google' })` on staff and reports login.

### 2. Server Google APIs (Drive, Docs, Gmail)

Same three env vars on **both** Vercel projects when those features are enabled:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth client for server-side refresh token |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Paired with client ID |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Long-lived token (OAuth Playground flow in `google-mail.ts` / `reports/src/lib/google.ts`) |

**Reports app** (`apps/reports/src/lib/google.ts`):

- PDF generation (Google Docs templates → Drive)
- Report submission routes (SE Monthly, VPR, VMR, EVF, JTSG TSVS, TN upload, etc.)
- Alert email via Gmail
- Admin VPR sheet migration
- Health check flags `googleOAuth` when all three are set

**Staff app** (`apps/staff/src/lib/google-mail.ts`):

- Pre-ETS Drive archive / downloads / Google Doc rosters
- VPR submit from client profile
- Referral / intake / session-complete / portal template emails
- Team Moments photo share
- Pre-ETS test roster email

If the trio is missing, those routes fail with “Missing Google OAuth credentials” (or graceful message where handled).

### Optional related env (not OAuth client trio)

- `VPR_MIGRATION_SHEET_ID` — reports admin only
- `CRON_SECRET` — Vercel cron auth (reports + staff)
- VAPID keys — push notifications (optional, both apps)

## Operational checklist

- [ ] Staff and reports Supabase URLs match Wayfinder Pro project
- [ ] Staff `NEXT_PUBLIC_REPORTS_APP_URL` points at deployed `apps/reports`
- [ ] Supabase redirect URLs include reports + staff hosts
- [ ] `GOOGLE_OAUTH_*` set on reports (required for submissions) and staff (required for Pre-ETS Drive, email, VPR)
