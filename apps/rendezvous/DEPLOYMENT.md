# Deploying Rendezvous

Separate Vercel project. Root Directory: `apps/rendezvous`. Full checklist: [SETUP.md](./SETUP.md).

Production domain: **`rendezvous.thejoshuatree.org`** (attach in the Rendezvous Vercel project Domains settings and add the DNS record Vercel shows — do not change `wayfinder-pro` domains).

Set `APP_BASE_URL=https://rendezvous.thejoshuatree.org` (and `NEXT_PUBLIC_RENDEZVOUS_APP_URL` to the same value) so booking, cancel, reschedule, and email links use that host.

On Wayfinder Pro, only add `NEXT_PUBLIC_RENDEZVOUS_APP_URL=https://rendezvous.thejoshuatree.org` — do not change that project’s Root Directory or build settings.
