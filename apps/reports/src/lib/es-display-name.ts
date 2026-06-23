import { personDisplayName } from "@wayfinder/branding";

type ProfileRow = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/** ES display name for reports — never falls back to email. */
export function resolveReportingEsName(
  profile: ProfileRow | null | undefined,
  userMetadata?: Record<string, unknown> | null
): string {
  const meta = userMetadata as { full_name?: string; name?: string } | undefined;
  return personDisplayName(
    {
      full_name: profile?.full_name ?? meta?.full_name ?? meta?.name ?? null,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
    },
    ""
  );
}
