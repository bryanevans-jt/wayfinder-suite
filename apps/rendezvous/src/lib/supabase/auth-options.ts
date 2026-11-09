import {
  wayfinderAuthOptions,
  wayfinderServerAuthOptions,
} from "@wayfinder/supabase/auth-client-options";

/**
 * Rendezvous shares parent-domain Supabase cookies with Wayfinder Pro so staff
 * can move between apps without signing in again.
 */
export const rendezvousAuthOptions = wayfinderAuthOptions;
export const rendezvousServerAuthOptions = wayfinderServerAuthOptions;
