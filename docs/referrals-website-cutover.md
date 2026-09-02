# Website referral forms → Wayfinder API

## Paste-ready page embeds

Same look as your current GA form; submit URL points at Wayfinder Pro instead of Apps Script.

| Page | File to copy |
|---|---|
| **Georgia (GVRA)** | [`docs/website-embeds/ga-gvra-referral-form.html`](website-embeds/ga-gvra-referral-form.html) — **Individual Job Placement** and **Workplace Readiness Training** |
| **Tennessee (TDHS VR)** | [`docs/website-embeds/tn-tdhs-referral-form.html`](website-embeds/tn-tdhs-referral-form.html) — **retired** (closed notice; API returns 410) |

1. Open the file in the repo.
2. Confirm `REFERRAL_SCRIPT_URL` uses your live staff host (default: `wayfinder-pro.thejoshuatree.org`).
3. Paste the **entire** file into the website page HTML/embed (replace the old Apps Script block).
4. Publish the website page.

Endpoints:

- GA: `https://wayfinder-pro.thejoshuatree.org/api/public/referrals/ga` (IJP and WRT)
- TN: retired — `POST /api/public/referrals/tn` returns **410 Gone**

## Optional form secret

If `REFERRAL_FORM_SECRET` is set on the staff Vercel project, put the same value in each embed:

```js
const REFERRAL_FORM_SECRET = "your-secret-here";
```

## Env (staff Vercel)

| Variable | Purpose |
|---|---|
| `REFERRAL_FORM_SECRET` | Optional shared secret from the website |
| `REFERRAL_NOTIFY_EMAIL` | Live HR inbox (default ryan.herrington@…) |
| `REFERRAL_TRAINING_CC` | Comma-separated admin emails CC’d while training phase is on |
| `REFERRAL_CORS_ORIGINS` | Allowed website origins (include `https://thejoshuatree.org` and `https://www.thejoshuatree.org`) |
| `CRON_SECRET` | Required for referral SLA / inactivity crons |
| Google OAuth vars | Same as team moments — confirmation + HR emails |

## Counselor access

Referral submit creates a counselor **directory** row (email stored) **without** Wayfinder login or invite. Activate counselors one-by-one in the portal when ready. They only receive the referral confirmation email from this path.
