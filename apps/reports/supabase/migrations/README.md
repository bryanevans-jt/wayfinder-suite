# Legacy migrations (v2 standalone app)

These SQL files are from the pre-monorepo Joshua Tree Reports v2 project.

**Do not apply new migrations here.**

All schema changes for production go in the monorepo root:

`../../supabase/migrations/`

The integrated reports app (`apps/reports`) reads from the same Supabase project as Wayfinder Pro; monorepo migrations are idempotent and include reporting integration (`20260624100000_reporting_integration.sql` and later).
