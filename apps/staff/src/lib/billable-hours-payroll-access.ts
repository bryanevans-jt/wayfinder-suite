import { isAdminTierRole } from "@wayfinder/supabase/roles";

/** Accounts Specialist and Admin — org-wide monthly billable totals on Billable Hours. */
export function canViewPayrollMonthlyBillableHours(role: string | null | undefined): boolean {
  return role === "accountant" || isAdminTierRole(role);
}
