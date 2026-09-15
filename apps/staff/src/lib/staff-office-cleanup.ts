import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  filterOfficesForPicker,
  queryAllOffices,
} from "@/lib/office-visibility";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

/** Office ids that may appear on staff assignment pickers (Tennessee offices excluded entirely). */
export async function loadAssignableOfficeIds(admin: AdminClient): Promise<Set<string>> {
  const offices = await queryAllOffices(admin);
  return new Set(
    filterOfficesForPicker(offices, {
      sunsetKeepOfficeIds: new Set(),
    }).map((o) => o.id)
  );
}

/** Removes staff→office links that no longer belong in the app (TN, hidden, missing office row, etc.). */
export async function pruneStaleStaffOfficeAssignments(
  admin: AdminClient
): Promise<{ removed: number }> {
  const assignable = await loadAssignableOfficeIds(admin);
  const { data: links, error } = await admin
    .from("staff_office_assignments")
    .select("id, office_id");

  if (error) {
    throw new Error(error.message);
  }

  const staleIds = (links ?? [])
    .filter((row) => !assignable.has(row.office_id as string))
    .map((row) => row.id as string);

  if (staleIds.length === 0) {
    return { removed: 0 };
  }

  const { error: deleteErr } = await admin
    .from("staff_office_assignments")
    .delete()
    .in("id", staleIds);

  if (deleteErr) {
    throw new Error(deleteErr.message);
  }

  return { removed: staleIds.length };
}
