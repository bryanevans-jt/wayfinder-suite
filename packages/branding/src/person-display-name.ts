export type PersonLabelInput = {
  full_name?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  contact_email?: string | null;
  id?: string | null;
};

/** Prefer profile/name fields; email and id are fallbacks only. */
export function personDisplayName(
  person: PersonLabelInput,
  fallback = "Unknown"
): string {
  const name = (person.full_name ?? person.name ?? "").trim();
  if (name) return name;

  const composed = [person.first_name, person.last_name]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim();
  if (composed) return composed;

  const email = (person.email ?? person.contact_email ?? "").trim();
  if (email) return email;

  const id = (person.id ?? "").trim();
  if (id) return id;

  return fallback;
}

export function clientDisplayName(client: PersonLabelInput): string {
  return personDisplayName(client, "Unknown client");
}

export function staffDisplayName(staff: {
  display_name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  id?: string | null;
}): string {
  const preset = (staff.display_name ?? "").trim();
  if (preset) return preset;

  return personDisplayName({
    full_name: staff.full_name,
    first_name: staff.first_name,
    last_name: staff.last_name,
    email: staff.email,
    id: staff.id,
  });
}

type StaffProfileInput = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/** Resolve a staff label from profile row plus optional Supabase auth metadata. */
export function resolveStaffDisplayName(
  userId: string,
  profile: StaffProfileInput | null | undefined,
  email: string | null | undefined,
  userMetadata?: Record<string, unknown> | null
): string {
  const meta = userMetadata as { full_name?: string; name?: string } | undefined;
  return personDisplayName({
    full_name: profile?.full_name ?? meta?.full_name ?? meta?.name ?? null,
    first_name: profile?.first_name,
    last_name: profile?.last_name,
    email,
    id: userId,
  });
}
