"use server";

import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import { revalidatePath } from "next/cache";

function requireAdmin() {
  return createServiceRoleClient();
}

async function assertTimeAccess() {
  const session = await getAppSession();
  if (!session) {
    throw new Error("Sign in required");
  }
  const role = session.effectiveRole;
  if (
    !isFieldSpecialistRole(role) &&
    !isSupervisorRole(role) &&
    role !== "accountant" &&
    !isAdminTierRole(role)
  ) {
    throw new Error("Not authorized");
  }
  return session;
}

/** Log non-client billable/manual time. Week submit/approve/return flows are retired. */
export async function addNonClientTimeEntry(
  activityTypeId: string,
  durationMinutes: number,
  serviceDate: string,
  narrative: string
) {
  await assertNotPreviewMutation();
  const session = await assertTimeAccess();
  if (!isFieldSpecialistRole(session.effectiveRole)) {
    throw new Error("Only field specialists can log time");
  }

  const admin = requireAdmin();
  const { insertEsTimeEntry } = await import("@wayfinder/supabase/es-time-tracking");

  await insertEsTimeEntry(admin, {
    esUserId: session.effectiveUserId,
    clientId: null,
    activityTypeId,
    serviceDate,
    durationMinutes,
    narrative,
    linkedSourceType: "manual",
    linkedSourceId: null,
  });

  revalidatePath("/dashboard/billable-hours");
  revalidatePath("/dashboard/timesheet");
}
