import {
  wayfinderAuthOptions,
  wayfinderServerAuthOptions,
} from '@wayfinder/supabase/auth-client-options';

/**
 * Reports uses host-only auth cookies (no parent domain) so PKCE verifiers and
 * sessions do not collide with Wayfinder Pro on `.thejoshuatree.org`.
 */
export const reportsAuthOptions = {
  auth: wayfinderAuthOptions.auth,
};

export const reportsServerAuthOptions = {
  auth: wayfinderServerAuthOptions.auth,
};
