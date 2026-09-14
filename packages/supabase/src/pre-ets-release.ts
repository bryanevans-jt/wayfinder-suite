export type PreEtsAuthorizationReleaseFields = {
  auth_number: string | null;
  auth_type: string;
};

/** Field staff (TS/TI) may access rosters/sessions only when auth is finalized. */
export function isPreEtsAuthorizationReleasedToField(
  auth: PreEtsAuthorizationReleaseFields | null | undefined
): boolean {
  if (!auth) return false;
  const num = (auth.auth_number ?? "").trim();
  if (!num) return false;
  return auth.auth_type === "group" || auth.auth_type === "individual";
}
