import {
  wayfinderAuthOptions,
  wayfinderServerAuthOptions,
} from '@wayfinder/supabase/auth-client-options';

/**
 * Reports shares parent-domain Supabase cookies with Wayfinder Pro so staff can
 * move between apps without signing in again. Stale PKCE verifier cookies are
 * cleared before OAuth in the shared login form.
 */
export const reportsAuthOptions = wayfinderAuthOptions;
export const reportsServerAuthOptions = wayfinderServerAuthOptions;
