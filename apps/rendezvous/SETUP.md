# Rendezvous setup (Bryan)

Rendezvous is a **separate Next.js app** in this monorepo (`apps/rendezvous`), deployed as its **own Vercel project** on the `joshuatree` team. It uses the existing **Wayfinder-Production** Supabase project with a new Postgres schema `rendezvous`. It never reads client records.

> Do **not** change the `wayfinder-pro` Vercel project settings beyond adding the optional `NEXT_PUBLIC_RENDEZVOUS_APP_URL` env var.  
> Do **not** apply the migration until you have reviewed it.

---

## 1. Review and apply the migration

File: `supabase/migrations/20261109160000_rendezvous_schema.sql`

What it does:

- Creates schema `rendezvous` (schedules, weekly hours, bookings, busy cache, watch channels)
- Adds `admin_config.rendezvous_enabled` (default `false`)
- Enables RLS on every table; anon has **no** table grants
- Exclusion constraint prevents overlapping confirmed bookings per staff member
- Helpers use `set search_path` and are **not** executable by `anon`

Apply in the Supabase SQL editor (or CLI) on **Wayfinder-Production** only after review.

### Expose the schema to PostgREST (Data API)

In the current Supabase dashboard this is **not** under a top-level “API” page:

1. Open the **Wayfinder-Production** project.
2. Click the gear **Project Settings** (bottom-left).
3. Open **Data API** (sibling of **API Keys** — not “API Keys” itself).
4. Find **Exposed schemas** and add `rendezvous` (keep existing ones like `public` and `graphql_public`).
5. Save.

If the UI still doesn’t show it, you can do the same in SQL (review before running):

```sql
-- Include every schema you already expose, plus rendezvous
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, rendezvous';
notify pgrst, 'reload config';
```

Without this, `admin.schema("rendezvous")` calls from the app fail with a PostgREST “schema must be one of…” error.

### Auth redirect URLs

Authentication → URL Configuration → Redirect URLs, add:

- `https://rendezvous.thejoshuatree.org/auth/callback` (production)
- `http://localhost:3003/auth/callback` (local)

---

## 2. Google Cloud project + Calendar service account

1. In [Google Cloud Console](https://console.cloud.google.com/), create or reuse a project (e.g. `jtsg-rendezvous`).
2. Enable **Google Calendar API** and **Gmail API**.
3. Create a **Service Account** (no user OAuth client needed for Calendar sync).
4. Create a JSON key. Store the `client_email` and `private_key` in Vercel env (never commit; never `NEXT_PUBLIC_`).
5. Note the service account client ID (numeric) from the JSON (`client_id`) — needed for Workspace delegation.

### Domain-wide delegation (Workspace Admin)

Bryan is Workspace admin:

1. [admin.google.com](https://admin.google.com) → **Security → Access and data control → API controls → Domain-wide delegation**.
2. **Add new** with the service account **client ID**.
3. OAuth scopes (exact):

```
https://www.googleapis.com/auth/calendar.events,https://www.googleapis.com/auth/calendar.freebusy,https://www.googleapis.com/auth/gmail.send
```

The app impersonates each staff member’s primary calendar for free/busy + event create/update, and impersonates `scheduling@thejoshuatree.org` for Gmail send.

---

## 3. Mailbox: scheduling@thejoshuatree.org

1. Create the Google Workspace user/mailbox `scheduling@thejoshuatree.org` (or a group with send-as if you prefer a user mailbox that owns send).
2. Prefer a real user mailbox so Gmail API `users.messages.send` as that subject works cleanly with delegation.
3. SPF / DKIM / DMARC (Workspace usually handles this for `thejoshuatree.org`):
   - Confirm SPF includes Google (`include:_spf.google.com`)
   - Enable DKIM for the domain in Admin → Apps → Google Workspace → Gmail → Authenticate email
   - DMARC: start with `p=none` monitoring if not already set; tighten later
4. Set `RENDEZVOUS_FROM_EMAIL=scheduling@thejoshuatree.org`
5. Keep `RENDEZVOUS_EMAILS_ENABLED=false` until you are ready. Explicit test path: set `RENDEZVOUS_ALLOW_TEST_EMAIL=true` and POST with `"forceTestEmail": true` to `/api/book` (still requires a bookable schedule).

---

## 4. Create the Vercel project

1. Vercel team **joshuatree** → Add New → Project → import `wayfinder-suite`.
2. **Root Directory:** `apps/rendezvous`
3. Framework: Next.js (auto).
4. `vercel.json` already sets install/build from the monorepo root and a cron to renew Calendar watch channels every 12 hours.
5. **Do not** alter the `wayfinder-pro` project’s Root Directory or build commands.

### Attach the custom domain (you do this — agent will not change DNS)

Production URL: **`https://rendezvous.thejoshuatree.org`**

1. In the **Rendezvous** Vercel project → **Settings → Domains** → Add `rendezvous.thejoshuatree.org`.
2. Vercel will show the DNS record to create (usually a **CNAME** for `rendezvous` → `cname.vercel-dns.com`, or an A record if they instruct otherwise).
3. In your DNS provider for `thejoshuatree.org`, add that record. Do **not** point it at the `wayfinder-pro` project.
4. Wait for TLS to become **Valid** in Vercel Domains.
5. Set env (below) so booking / cancel / reschedule / email links use this origin — never a `*.vercel.app` preview URL:

```
APP_BASE_URL=https://rendezvous.thejoshuatree.org
NEXT_PUBLIC_RENDEZVOUS_APP_URL=https://rendezvous.thejoshuatree.org
```

(`APP_BASE_URL` is the preferred server-side canonical origin; the public alias keeps staff redirects and client-visible copy consistent.)

### Env vars (Rendezvous project)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Same as Wayfinder Pro |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Same as Wayfinder Pro |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Same as Wayfinder Pro (server only) |
| `NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN` | prod | `.thejoshuatree.org` |
| `NEXT_PUBLIC_STAFF_APP_URL` | yes | Wayfinder Pro URL |
| `APP_BASE_URL` | yes (prod) | Canonical origin for booking, cancel, reschedule, webhook, and email links: `https://rendezvous.thejoshuatree.org` |
| `NEXT_PUBLIC_RENDEZVOUS_APP_URL` | yes | Same production URL (also used by staff app redirects) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | yes | Service account email |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | yes | PEM with `\n` newlines |
| `GOOGLE_CALENDAR_WEBHOOK_TOKEN` | yes | Random secret for push channel token |
| `RENDEZVOUS_FROM_EMAIL` | yes | Default `scheduling@thejoshuatree.org` |
| `RENDEZVOUS_EMAILS_ENABLED` | yes | `false` until launch testing |
| `RENDEZVOUS_ALLOW_TEST_EMAIL` | optional | `true` only for explicit test sends |
| `CRON_SECRET` | yes | Bearer for `/api/cron/renew-watches` |
| `NEXT_PUBLIC_VAPID_*` / `VAPID_*` | optional | Same as staff for in-app push |

### Env var on Wayfinder Pro (staff) only

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_RENDEZVOUS_APP_URL` | `https://rendezvous.thejoshuatree.org` so `/dashboard/rendezvous` redirects correctly |

Do not add Google service account keys to the staff project unless you later share code paths there.

---

## 5. Enable for testing (super admin only)

1. Deploy Rendezvous + apply migration + expose schema.
2. Sign in to Wayfinder Pro as Bryan (super admin).
3. Super Admin Portal → Feature Toggles → enable **Rendezvous**.
4. Open **Rendezvous** (link appears under the toggle, or visit `/dashboard/rendezvous`).
5. In Rendezvous → Admin setup: create a schedule for a test staff member.
6. Leave **Booking page is ON** unchecked until you are ready; then enable **only** the test schedule.
7. Open `/book/<slug>` in a private window (no staff session required).
8. Keep `RENDEZVOUS_EMAILS_ENABLED=false` until mailbox + SPF/DKIM look good; use `forceTestEmail` sparingly.

### Team Calendar visibility (server-enforced on `GET /api/calendar`)

| Role | Calendar / bookings |
|------|---------------------|
| Super admin / admin | All active **Employment Specialists**, **Transition Specialists**, and **Supervisors** |
| Supervisor | Self + staff from existing `loadSupervisorScope`: ES/TS in `supervisor_es_assignments` **and** office-shared Transition Specialists / Instructors |
| ES / Transition Specialist (and others) | Own calendar only |

Staff app entry is still gated by the Rendezvous feature flag / `rendezvous_open_to_all` (super admin always; broader roles when open). Calendar queries always use an explicit staff-ID allow-list — never UI-only filtering.

---

## 6. Health checks

- `GET /api/health` → `{ ok: true, googleServiceAccount: true/false, emailsEnabled: ... }`
- After enabling a schedule, cron `/api/cron/renew-watches` registers Google push channels (requires a public HTTPS webhook URL).

---

## 7. Local development

```bash
npm install
npm run dev:rendezvous
# http://localhost:3003
npm run test -w @wayfinder/rendezvous
```

Copy `.env.example` → `.env.local` with the same Supabase project (or a staging clone). Never point a throwaway key at production Calendar without a test user.
