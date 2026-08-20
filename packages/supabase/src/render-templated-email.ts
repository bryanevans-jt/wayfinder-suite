import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type EmailTemplateKey,
  loadResolvedEmailTemplate,
  renderFlatEmail,
} from "./email-templates";

/** Resolve a flat email template with merge vars (reports, team moments, alerts). */
export async function renderTemplatedFlatEmail(
  admin: SupabaseClient,
  key: EmailTemplateKey,
  vars: Record<string, string>
): Promise<{ subject: string; text: string }> {
  const resolved = await loadResolvedEmailTemplate(admin, key);
  return renderFlatEmail(resolved, vars);
}
