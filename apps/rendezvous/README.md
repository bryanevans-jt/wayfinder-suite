# Rendezvous

Calendly-style scheduling for Joshua Tree Service Group Employment & Transition Specialists. Counselors book meetings; Google Calendar blocks busy time; Wayfinder roles drive team visibility.

- **Setup (Bryan):** see [SETUP.md](./SETUP.md)
- **App:** `@wayfinder/rendezvous` on port `3003`
- **Data:** Postgres schema `rendezvous` in Wayfinder-Production (migrations in repo root `supabase/migrations/`)
- **Gate:** `admin_config.rendezvous_enabled` + super-admin-only staff access until rollout

```bash
npm run dev:rendezvous
npm run test -w @wayfinder/rendezvous
```
