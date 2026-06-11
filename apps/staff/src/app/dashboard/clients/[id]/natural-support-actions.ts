"use server";

import {
  assertNaturalSupportClientAccess,
  requireServiceRoleAdmin,
} from "@/lib/natural-support-access";
import { inviteNaturalSupportForClient } from "@wayfinder/supabase/natural-support-invite";
import { revalidatePath } from "next/cache";

type Input = {
  clientId: string;
  fullName: string;
  email: string;
  relationship: string;
  relationshipOther: string | null;
};

/** @deprecated Prefer POST /api/natural-support — kept for any legacy callers. */
export async function inviteNaturalSupport(input: Input) {
  await assertNaturalSupportClientAccess(input.clientId);
  const admin = requireServiceRoleAdmin();
  await inviteNaturalSupportForClient(admin, input);
  revalidatePath(`/dashboard/clients/${input.clientId}`);
}
