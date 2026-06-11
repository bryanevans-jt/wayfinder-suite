const MIN_SUBMIT_MS = 3000;
const MAX_TOKEN_AGE_MS = 60 * 60 * 1000;
const MAX_SUBMISSIONS_PER_EMAIL_PER_HOUR = 3;

export function validatePublicFormTiming(issuedAt: unknown): string | null {
  const ts = typeof issuedAt === "number" ? issuedAt : Number(issuedAt);
  if (!Number.isFinite(ts)) {
    return "Invalid form session. Refresh the page and try again.";
  }
  const age = Date.now() - ts;
  if (age < MIN_SUBMIT_MS) {
    return "Please wait a moment before submitting.";
  }
  if (age > MAX_TOKEN_AGE_MS) {
    return "This form session expired. Refresh the page and try again.";
  }
  return null;
}

export function honeypotTriggered(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export async function publicSubmissionRateLimited(
  admin: ReturnType<typeof import("@wayfinder/supabase/admin-server").createServiceRoleClient>,
  contactEmail: string
): Promise<boolean> {
  const email = contactEmail.trim().toLowerCase();
  if (!email) {
    return false;
  }
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("employers")
    .select("id", { count: "exact", head: true })
    .eq("submission_source", "public")
    .ilike("contact_email", email)
    .gte("created_at", since);

  if (error) {
    console.error("public submission rate limit check failed:", error.message);
    return false;
  }
  return (count ?? 0) >= MAX_SUBMISSIONS_PER_EMAIL_PER_HOUR;
}
