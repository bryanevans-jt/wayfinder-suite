import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

export async function logEmployerStatusChange(input: {
  employerId: string;
  changedBy: string | null;
  oldStatus: string | null;
  newStatus: string;
}) {
  const admin = createServiceRoleClient();
  const { error } = await admin.from("employer_status_logs").insert({
    employer_id: input.employerId,
    changed_by: input.changedBy,
    old_status: input.oldStatus,
    new_status: input.newStatus,
  });
  if (error) {
    console.error("employer_status_log insert failed:", error.message);
  }
}

export type EmployerStatusLogRow = {
  id: string;
  old_status: string | null;
  new_status: string;
  created_at: string;
  changed_by: string | null;
  profiles?: { full_name: string | null } | null;
};
