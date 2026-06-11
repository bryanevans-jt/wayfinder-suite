# Supabase auth email templates

Branded HTML for **Magic Link** and **Confirm signup** lives in this folder. Supabase does not read these files automatically—you paste them into the dashboard.

## Install in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Email Templates**.
2. For **Magic Link**, paste the contents of `magic-link.html`.
3. For **Confirm signup**, paste `confirm-signup.html`.
4. Save each template.

## Logo in emails

Templates load the Wayfinder mark from:

```text
{{ .SiteURL }}/wayfinder-logo.png
```

That file must exist at `apps/staff/public/wayfinder-logo.png` (and be deployed with the staff app).

### Site URL (required)

**Authentication → URL Configuration → Site URL** must be the **public HTTPS origin** of your **Wayfinder Pro** staff app, for example:

```text
https://wayfinder-pro.thejoshuatree.org
```

Not `http://localhost:3000` — Gmail, Outlook, and other clients cannot fetch images from your machine, so the logo will appear broken during local-only development.

After deploy, verify in a browser (while logged out):

```text
https://YOUR-STAFF-APP/wayfinder-logo.png
```

You should see the PNG. If that URL works, the same URL in emails will work once Site URL matches.

### Optional: fixed CDN URL

If Site URL cannot match your app host, replace the `src` in the template with a permanent HTTPS URL (e.g. Supabase Storage public bucket or your CDN).
