import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import { resolveRendezvousAccess, type RendezvousAccess } from "./access";
import { JOSHUA_TREE_ORG_EMAIL_DOMAIN } from "@wayfinder/branding";

export type RendezvousSession = {
  userId: string;
  email: string;
  role: string | null;
  fullName: string | null;
  access: RendezvousAccess;
};

export async function getRendezvousSession(): Promise<RendezvousSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email?.endsWith(`@${JOSHUA_TREE_ORG_EMAIL_DOMAIN}`)) {
    return null;
  }

  const { data: rpcRows } = await supabase.rpc("get_auth_user_profile");
  const row = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
    | { role?: string; full_name?: string | null }
    | undefined;
  const role = row?.role ? String(row.role).toLowerCase() : null;
  const admin = createAdminClient();
  const access = await resolveRendezvousAccess(admin, {
    userId: user.id,
    role,
  });

  return {
    userId: user.id,
    email: user.email,
    role,
    fullName: row?.full_name ?? null,
    access,
  };
}

/**
 * Gate for authenticated APIs/pages. Returns 404 (not 403) when the feature
 * must stay invisible to non-eligible users.
 */
export async function requireRendezvousAccess(): Promise<
  | { ok: true; session: RendezvousSession }
  | { ok: false; status: 401 | 404 }
> {
  const session = await getRendezvousSession();
  if (!session) return { ok: false, status: 401 };
  if (!session.access.canAccessApp) return { ok: false, status: 404 };
  return { ok: true, session };
}
