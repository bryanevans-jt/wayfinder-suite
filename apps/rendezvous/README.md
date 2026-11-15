# Rendezvous

Calendly-style scheduling for Joshua Tree Service Group Employment & Transition Specialists. Counselors book meetings; Google Calendar blocks busy time; Wayfinder roles drive team visibility.

- **Setup (Bryan):** see [SETUP.md](./SETUP.md)
- **App:** `@wayfinder/rendezvous` on port `3003`
- **Data:** Postgres schema `rendezvous` in Wayfinder-Production (migrations in repo root `supabase/migrations/`)
- **Gate:** `admin_config.rendezvous_enabled` / `rendezvous_open_to_all` (super admin always; broader roles when open)
- **Emails:** Production has booking/cancel/reschedule emails on (`RENDEZVOUS_EMAILS_ENABLED=true`)
- **Admin Setup:** Anyone who can open Admin Setup may edit any team member’s schedule (intentional)

```bash
npm run dev:rendezvous
npm run test -w @wayfinder/rendezvous
```
