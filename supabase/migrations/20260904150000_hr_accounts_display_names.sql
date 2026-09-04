-- Set active HR Director / Accounts Specialist display names for Team Directory and portals.

update public.profiles
set
  full_name = 'Devon Poole',
  first_name = 'Devon',
  last_name = 'Poole'
where role::text = 'hr'
  and coalesce(is_active, true) = true;

update public.profiles
set
  full_name = 'Katie Turner',
  first_name = 'Katie',
  last_name = 'Turner'
where role::text = 'accountant'
  and coalesce(is_active, true) = true;

-- Prefer Devon for live referral notifications when admin_config has no override yet
-- (or still points at the previous default).
update public.admin_config
set referral_notify_email = 'devon.poole@thejoshuatree.org'
where referral_notify_email is null
   or trim(referral_notify_email) = ''
   or lower(trim(referral_notify_email)) = 'ryan.herrington@thejoshuatree.org';
