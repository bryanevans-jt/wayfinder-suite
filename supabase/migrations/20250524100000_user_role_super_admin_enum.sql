-- Step 1 of 2: add enum value only. Must run in its own query (separate commit).
-- PostgreSQL does not allow using a new enum value in the same transaction it was added.

alter type public.user_role add value if not exists 'super_admin';
