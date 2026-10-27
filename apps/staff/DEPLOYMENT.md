# Deploying Wayfinder Pro (`apps/staff`)

Integrated staff app in [wayfinder-suite](https://github.com/bryanevans-jt/wayfinder-suite).

## Vercel project (required)

1. Import **`bryanevans-jt/wayfinder-suite`** (not a legacy standalone repo).
2. **Root Directory:** `apps/staff`
3. **Production branch:** `main`
4. **Install Command:** `cd ../.. && npm ci` (see `vercel.json`)
5. **Build Command:** `cd ../.. && npm run build -w @wayfinder/staff`

After each push to `main`, open **Deployments** and confirm **Production** shows the same commit SHA as GitHub `main`.

If deploy succeeds but **wayfinder-pro.thejoshuatree.org** still shows an old footer version, the domain is likely attached to a **different** Vercel project or an old production deployment — use **Promote to Production** on the latest `main` deployment, or fix **Settings → Domains**.

## Verify live build

```bash
curl -sI "https://wayfinder-pro.thejoshuatree.org/login" | grep -i x-wayfinder
curl -s "https://wayfinder-pro.thejoshuatree.org/api/health"
```

Expect `X-Wayfinder-Version: 1.2.5` (or current `APP_VERSION`) and JSON from `/api/health` with matching `version` and `gitCommit`.
