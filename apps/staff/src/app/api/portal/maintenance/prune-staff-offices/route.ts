import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import { pruneStaleStaffOfficeAssignments } from "@/lib/staff-office-cleanup";

/** Admin: drop retired TN / invisible office links from all field staff. */
export async function POST() {
  try {
    const { admin } = await assertPortalMutation("admin");
    const result = await pruneStaleStaffOfficeAssignments(admin);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
