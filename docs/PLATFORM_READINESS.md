# Wayfinder platform readiness audit

Last updated: June 2026. Use this as a deployment and operations checklist across **Wayfinder** (client), **Wayfinder Pro** (staff), and **Joshua Tree Reports**.

## Summary

| Area | Staff | Client | Reports |
|------|-------|--------|---------|
| PWA manifest + SW | Yes | Yes | Yes (added) |
| Mobile install prompt | Yes (Android + iOS) | Yes | Yes |
| Error log bridging | Yes | Yes | Yes (added) |
| Host-only auth cookies | Parent domain | Parent domain | Parent domain |
| Service role on Vercel | Yes | As needed | Yes |

---

## Action required before next production deploy

### 1. Run pending Supabase migrations (SQL Editor)

**Source of truth:** `supabase/migrations/` at the monorepo root. Apply new files there only — do not use `apps/reports/supabase/migrations/` (legacy v2 folder, kept for reference).

Apply these if not already applied:

1. `supabase/migrations/20260627140000_offices_hidden_flag.sql` — `offices.is_hidden`
2. `supabase/migrations/20260627150000_system_error_logs_reports_app.sql` — allow `app = 'reports'` in `system_error_logs`
3. `supabase/migrations/20260629190000_profiles_updated_at_column.sql` — `profiles.updated_at` on legacy DBs

Without (2), reports API errors will fail to persist and users will still see friendly messages but **no WF reference codes** in Wayfinder Pro → Settings → Error log.

### 2. Vercel environment variables

**Reports** (`wayfinder-reports.thejoshuatree.org`):

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Error logging + admin APIs |
| Google OAuth vars | Yes | PDF generation / Drive |
| `CRON_SECRET` | Yes | If using cron endpoints |
| `NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN` | Yes | `.thejoshuatree.org` — same as staff for seamless sign-in |

**Staff and Reports** — set `NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN=.thejoshuatree.org` on both Vercel projects so sessions carry across subdomains. The login form clears stale PKCE verifier cookies before Google or magic-link sign-in to avoid cross-app OAuth collisions.

**Client** — same parent-domain cookie pattern if clients use subdomains.

### 3. Supabase Auth redirect URLs

Ensure all production origins are listed under **Authentication → URL Configuration → Redirect URLs**:

- `https://wayfinder-pro.thejoshuatree.org/auth/callback` (staff)
- `https://wayfinder.thejoshuatree.org/auth/callback` (client — adjust to your live URL)
- `https://wayfinder-reports.thejoshuatree.org/auth/callback` (reports)

**Passkeys:** Relying Party ID = `thejoshuatree.org`; add every app origin under Relying Party Origins.

### 4. Redeploy all three Vercel projects

After migrations and env changes, redeploy staff, client, and reports.

---

## Cross-app integration checks

### Auth and cookies

- Staff, client, and reports share parent-domain Supabase cookies (`.thejoshuatree.org`) for seamless handoff between Wayfinder Pro and Official Reporting.
- Before OAuth or magic link, the login form clears stale PKCE verifier cookies so cross-app sign-in does not fail.
- After deploy, test: sign in on Wayfinder Pro, open Reports in a new tab (should skip login), then sign out on one app and confirm the other behaves as expected.

### Error log (super admin)

Wayfinder Pro → **Settings → Error log** now includes:

- Filter: **Reports**
- Summary card: **Reports (7d)**
- All reports API 500s log with `app = reports` and a `WF-XXXXXXXX` code

Client and staff errors continue to log as before. Cron failures and remaining admin/export routes now log with WF codes as well.

### Office visibility

Super admins can hide unused GA/TN VR offices. Run migration `20260627140000` and verify hidden offices do not appear in admin/supervisor pickers.

### Tennessee reporting

- Runtime form order/labels come from **code** (`ips-monthly-service-order.ts`) even if admin JSON is older.
- Admin `tag_schema` in DB is source of truth for field definitions.
- JD contact row dates prefill from activity log unless the user changes them.

### Cron jobs (reports)

If using external cron (e.g. cron-job.org), verify secrets and URLs after domain changes:

- `/api/cron/missing-reports`
- `/api/cron/overdue-reports`
- `/api/cron/vpr-cleanup`

---

## PWA and mobile web

All three apps now support:

- `manifest.json` + `sw.js` (service worker for install eligibility and push hooks)
- **Android/Chrome:** native “Install” banner when `beforeinstallprompt` fires
- **iOS Safari:** instructional banner (Share → Add to Home Screen) on mobile viewports

Installed PWAs open in standalone mode without browser chrome — suitable for daily staff use on phones.

**Limitations:**

- iOS does not support Web Push in all versions; push notifications require native wrapper or APNs.
- PWA install is per-origin — three separate installs if users need all three apps on one phone.

---

## App Store and Google Play packaging

Native store apps are scaffolded under `mobile/` using **Capacitor** in **remote URL** mode (WebView loads your production HTTPS site). This keeps one codebase; store apps are thin shells.

See `mobile/README.md` for build steps.

### What you must provide (cannot be automated in repo)

| Item | Google Play | Apple App Store |
|------|-------------|-----------------|
| Developer account | Google Play Console (~$25 one-time) | Apple Developer Program ($99/year) |
| App signing | Upload key + Play App Signing | Certificates + provisioning profiles |
| Store listing | Screenshots, description, privacy policy URL | Same + App Review |
| Privacy policy | Public HTTPS URL | Required |
| Content rating | Questionnaire | Age rating |

### Recommended store strategy

1. **Phase 1:** Ship PWAs + install prompts (done) — lowest friction for staff already on `@thejoshuatree.org`.
2. **Phase 2:** Publish **Wayfinder Pro** to Play + App Store first (highest daily use).
3. **Phase 3:** Client app (participants), then Reports (smaller audience).

### Auth in native WebView

- Magic links must open in the app’s WebView or use **universal links / app links** so OAuth callbacks return to the app.
- Capacitor `@capacitor/browser` or custom URL scheme may be needed for Google OAuth on reports.
- Test passkeys on real devices after wrapping — WebView passkey support varies by OS version.

---

## Streamlining suggestions

1. **Link Supabase CLI** to the project and use `supabase db push` so migrations are not pasted manually.
2. **Single sign-on handoff:** optional “Open Reports” link from Wayfinder Pro that opens reports in a new tab (already separate auth by design).
3. **Unified status page:** optional super-admin widget showing last cron run + error count per app.
4. **Schema sync:** document TN admin JSON paste process in runbook when adding new report types.
5. **Remove** `NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN` from reports Vercel if still present.

---

## Smoke test checklist (post-deploy)

- [ ] Magic link sign-in on reports (fresh link, no staff tab open)
- [ ] Passkey sign-in on reports
- [ ] TN IPS Monthly submit → PDF email + Drive
- [ ] Hide/show office in Wayfinder Pro super admin
- [ ] Trigger a test 500 on reports → appears in Error log with Reports filter
- [ ] Mobile Chrome: install prompt on reports home
- [ ] iPhone Safari: “Add to Home Screen” banner on reports
- [ ] Staff dashboard install prompt still works
