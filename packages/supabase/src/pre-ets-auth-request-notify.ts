import type { SupabaseClient } from "@supabase/supabase-js";
import { formatEnglishList } from "./pre-ets-list-format";
import { notifyUser } from "./notify-user";
import { isAdminTierRole, isAccountantRole, isSuperAdminRole, normalizeRole } from "./roles";

async function loadAuthRequestRecipientIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.from("profiles").select("id, role").eq("is_active", true);
  if (error) {
    throw new Error(error.message);
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const role = normalizeRole(row.role as string);
    if (isSuperAdminRole(role) || isAdminTierRole(role) || isAccountantRole(role)) {
      ids.add(row.id as string);
    }
  }
  return [...ids];
}

export async function notifyPreEtsAuthRequestsSubmitted(
  admin: SupabaseClient,
  input: {
    schoolGroupLabels: string[];
    serviceMonth: string;
    districtNumber: string;
    importId: string;
  }
): Promise<void> {
  const labels = [...new Set(input.schoolGroupLabels.map((s) => s.trim()).filter(Boolean))];
  if (labels.length === 0) return;

  const list = formatEnglishList(labels);
  const title = "Pre-ETS authorization requests submitted";
  const body = `Authorization requests submitted for ${list}. Enter GVRA authorization numbers when received.`;
  const month = input.serviceMonth.slice(0, 7);
  const link_path = `/dashboard/pre-ets?tab=authorizations&authType=pending&month=${encodeURIComponent(month)}`;

  const recipientIds = await loadAuthRequestRecipientIds(admin);
  await Promise.all(
    recipientIds.map((userId) =>
      notifyUser(admin, {
        userId,
        app: "staff",
        kind: "pre_ets_auth_request_submitted",
        title,
        body,
        link_path,
        metadata: {
          importId: input.importId,
          districtNumber: input.districtNumber,
          serviceMonth: input.serviceMonth,
          schoolGroupLabels: labels,
        },
      })
    )
  );
}
