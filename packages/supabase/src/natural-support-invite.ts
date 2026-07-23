import type { SupabaseClient } from "@supabase/supabase-js";

const RELATIONSHIPS = new Set(["parent", "guardian", "spouse", "family", "other"]);

export type NaturalSupportContactRow = {
  id: string;
  full_name: string;
  email: string;
  relationship: string;
  relationship_other: string | null;
  invited_at: string | null;
};

export type InviteNaturalSupportInput = {
  clientId: string;
  fullName: string;
  email: string;
  relationship: string;
  relationshipOther: string | null;
};

export async function inviteNaturalSupportForClient(
  admin: SupabaseClient,
  input: InviteNaturalSupportInput
): Promise<void> {
  const name = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const relationship = input.relationship.trim().toLowerCase();

  if (!name || !email || !RELATIONSHIPS.has(relationship)) {
    throw new Error("Name, email, and relationship are required");
  }
  if (relationship === "other" && !input.relationshipOther?.trim()) {
    throw new Error("Please specify the relationship");
  }

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
  });

  if (inviteErr || !invited.user) {
    throw new Error(inviteErr?.message ?? "Could not invite user");
  }

  const supportUserId = invited.user.id;

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ role: "support", full_name: name })
    .eq("id", supportUserId);

  if (profileErr) {
    throw new Error(profileErr.message);
  }

  const { error: contactErr } = await admin.from("natural_support_contacts").insert({
    client_id: input.clientId,
    full_name: name,
    email,
    relationship,
    relationship_other: relationship === "other" ? input.relationshipOther?.trim() ?? null : null,
    support_user_id: supportUserId,
    invited_at: new Date().toISOString(),
  });

  if (contactErr) {
    throw new Error(contactErr.message);
  }

  const { error: assignErr } = await admin.from("support_client_assignments").upsert(
    { support_user_id: supportUserId, client_id: input.clientId },
    { onConflict: "support_user_id,client_id" }
  );

  if (assignErr) {
    throw new Error(assignErr.message);
  }
}

export async function listNaturalSupportContacts(
  admin: SupabaseClient,
  clientId: string
): Promise<NaturalSupportContactRow[]> {
  const { data, error } = await admin
    .from("natural_support_contacts")
    .select("id, full_name, email, relationship, relationship_other, invited_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as NaturalSupportContactRow[];
}

/** Update a Natural Support contact email (and linked auth login when present). */
export async function updateNaturalSupportContactEmail(
  admin: SupabaseClient,
  input: { contactId: string; clientId: string; email: string }
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required");
  }

  const { data: contact, error: loadErr } = await admin
    .from("natural_support_contacts")
    .select("id, client_id, email, support_user_id")
    .eq("id", input.contactId)
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (loadErr) {
    throw new Error(loadErr.message);
  }
  if (!contact) {
    throw new Error("Natural Support contact not found");
  }

  const previous = ((contact.email as string) ?? "").trim().toLowerCase();
  if (previous === email) {
    return;
  }

  const { error: updateErr } = await admin
    .from("natural_support_contacts")
    .update({ email })
    .eq("id", input.contactId)
    .eq("client_id", input.clientId);

  if (updateErr) {
    throw new Error(updateErr.message);
  }

  const supportUserId = contact.support_user_id as string | null;
  if (supportUserId) {
    const { error: authErr } = await admin.auth.admin.updateUserById(supportUserId, { email });
    if (authErr) {
      throw new Error(authErr.message);
    }
  }
}
