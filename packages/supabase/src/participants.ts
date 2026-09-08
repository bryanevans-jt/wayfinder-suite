import type { SupabaseClient } from "@supabase/supabase-js";

/** Normalize a person name for fuzzy comparison (first + last focus). */
export function normalizeParticipantName(fullName: string): string {
  const parts = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export function namesLooselyMatch(a: string, b: string): boolean {
  const na = normalizeParticipantName(a);
  const nb = normalizeParticipantName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [aFirst, aLast] = na.split(" ");
  const [bFirst, bLast] = nb.split(" ");
  return Boolean(aFirst && aLast && bFirst && bLast && aFirst === bFirst && aLast === bLast);
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ea = (a ?? "").trim().toLowerCase();
  const eb = (b ?? "").trim().toLowerCase();
  return Boolean(ea && eb && ea === eb);
}

export type ParticipantMatchResult =
  | { kind: "exact"; participantId: string }
  | { kind: "suggest"; participantId: string; reason: string }
  | { kind: "new"; participantId: string }
  | { kind: "none" };

/**
 * Link a client to a participant using DOB + 2-of-3 (name, DOB, email).
 * Exact 2-of-3 → auto-link. Near name match → flag for staff review.
 */
export async function resolveParticipantForClient(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    fullName: string;
    dateOfBirth: string | null;
    contactEmail: string | null;
  }
): Promise<ParticipantMatchResult> {
  const dob = (opts.dateOfBirth ?? "").trim();
  if (!dob) {
    return { kind: "none" };
  }

  const { data: candidates } = await admin
    .from("participants")
    .select("id, date_of_birth, normalized_name, primary_email")
    .eq("date_of_birth", dob)
    .limit(50);

  const name = opts.fullName.trim();
  const email = (opts.contactEmail ?? "").trim().toLowerCase();

  let exactId: string | null = null;
  let suggestId: string | null = null;
  let suggestReason = "";

  for (const row of candidates ?? []) {
    const pid = row.id as string;
    const nameMatch = name && namesLooselyMatch(name, String(row.normalized_name ?? ""));
    const emailMatch = emailsMatch(email, row.primary_email as string | null);
    const dobMatch = true;

    const matchCount = [nameMatch, emailMatch, dobMatch].filter(Boolean).length;
    if (matchCount >= 2 && (nameMatch || emailMatch)) {
      exactId = pid;
      break;
    }
    if (dobMatch && (nameMatch || emailMatch) && matchCount < 2) {
      suggestId = pid;
      suggestReason = nameMatch ? "name_similar" : "email_match_only";
    } else if (dobMatch && name && !nameMatch && emailMatch) {
      suggestId = pid;
      suggestReason = "dob_email_name_mismatch";
    }
  }

  if (exactId) {
    await admin.from("clients").update({ participant_id: exactId }).eq("id", opts.clientId);
    return { kind: "exact", participantId: exactId };
  }

  const normalized = normalizeParticipantName(name);
  const { data: created, error } = await admin
    .from("participants")
    .insert({
      date_of_birth: dob,
      normalized_name: normalized || null,
      primary_email: email || null,
    })
    .select("id")
    .maybeSingle();

  if (error || !created?.id) {
    return { kind: "none" };
  }

  const newId = created.id as string;
  await admin.from("clients").update({ participant_id: newId }).eq("id", opts.clientId);

  if (suggestId && suggestId !== newId) {
    await admin.from("participant_link_flags").insert({
      client_id: opts.clientId,
      suggested_participant_id: suggestId,
      match_reason: suggestReason,
      status: "pending",
    });
    return { kind: "suggest", participantId: newId, reason: suggestReason };
  }

  return { kind: "new", participantId: newId };
}

export async function confirmParticipantLink(
  admin: SupabaseClient,
  opts: {
    flagId: string;
    actorUserId: string;
    action: "confirm" | "dismiss";
  }
): Promise<{ ok: true } | { error: string }> {
  const { data: flag } = await admin
    .from("participant_link_flags")
    .select("id, client_id, suggested_participant_id, status")
    .eq("id", opts.flagId)
    .maybeSingle();

  if (!flag || flag.status !== "pending") {
    return { error: "Link flag not found or already resolved." };
  }

  const now = new Date().toISOString();
  if (opts.action === "confirm") {
    await admin
      .from("clients")
      .update({ participant_id: flag.suggested_participant_id })
      .eq("id", flag.client_id);
  }

  await admin
    .from("participant_link_flags")
    .update({
      status: opts.action === "confirm" ? "confirmed" : "dismissed",
      resolved_at: now,
      resolved_by: opts.actorUserId,
    })
    .eq("id", opts.flagId);

  return { ok: true };
}

export async function loadPendingParticipantLinkFlags(
  admin: SupabaseClient
): Promise<
  Array<{
    id: string;
    clientId: string;
    clientName: string | null;
    suggestedParticipantId: string;
    matchReason: string;
    createdAt: string;
  }>
> {
  const { data } = await admin
    .from("participant_link_flags")
    .select(
      "id, client_id, suggested_participant_id, match_reason, created_at, clients(full_name)"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map((row) => {
    const clients = row.clients as { full_name?: string | null } | { full_name?: string | null }[] | null;
    const c = Array.isArray(clients) ? clients[0] : clients;
    return {
      id: row.id as string,
      clientId: row.client_id as string,
      clientName: c?.full_name ?? null,
      suggestedParticipantId: row.suggested_participant_id as string,
      matchReason: row.match_reason as string,
      createdAt: row.created_at as string,
    };
  });
}
