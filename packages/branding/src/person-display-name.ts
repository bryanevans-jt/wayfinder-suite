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
    .map((part) => part.trim())
    .join(" ")
    .trim();
  if (composed) return composed;

  const email = (person.email ?? person.contact_email ?? "").trim();
  if (email) return email;

  const id = (person.id ?? "").trim();
  if (id) return id;

  return fallback;
}

/**
 * Client-facing label: roster / profile names first, then email, never UUID.
 * Pass linked profile name fields when clients.full_name is null.
 */
export function clientDisplayName(client: PersonLabelInput): string {
  return personDisplayName(
    {
      full_name: client.full_name,
      name: client.name,
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email,
      contact_email: client.contact_email,
      id: null,
    },
    "Unknown client"
  );
}

/**
 * Merge a clients row with an optional linked profiles row for display.
 * Prefer clients.full_name, then profile full/first/last, then email.
 */
export function clientDisplayNameFromRosterAndProfile(
  client: {
    full_name?: string | null;
    contact_email?: string | null;
    email?: string | null;
  } | null | undefined,
  profile?: {
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null
): string {
  return clientDisplayName({
    full_name: client?.full_name || profile?.full_name || null,
    first_name: profile?.first_name ?? null,
    last_name: profile?.last_name ?? null,
    contact_email: client?.contact_email || client?.email || profile?.email || null,
  });
}

/** Last / first tokens for alphabetical client lists (missing names sort last). */
export function clientNameSortKey(opts: {
  displayName: string;
  first_name?: string | null;
  last_name?: string | null;
}): { lastName: string; firstName: string } {
  const explicitLast = (opts.last_name ?? "").trim();
  const explicitFirst = (opts.first_name ?? "").trim();
  if (explicitLast || explicitFirst) {
    return {
      lastName: explicitLast.toLocaleLowerCase(),
      firstName: explicitFirst.toLocaleLowerCase(),
    };
  }

  const display = (opts.displayName ?? "").trim();
  if (!display || display === "Unknown client" || display.includes("@")) {
    return { lastName: "\uffff", firstName: display.toLocaleLowerCase() };
  }

  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { lastName: parts[0].toLocaleLowerCase(), firstName: "" };
  }
  return {
    lastName: parts[parts.length - 1].toLocaleLowerCase(),
    firstName: parts.slice(0, -1).join(" ").toLocaleLowerCase(),
  };
}

export function compareClientNameSortKeys(
  a: { lastName: string; firstName: string; displayName?: string },
  b: { lastName: string; firstName: string; displayName?: string }
): number {
  const last = a.lastName.localeCompare(b.lastName, undefined, { sensitivity: "base" });
  if (last !== 0) return last;
  const first = a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" });
  if (first !== 0) return first;
  return (a.displayName ?? "").localeCompare(b.displayName ?? "", undefined, {
    sensitivity: "base",
  });
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
