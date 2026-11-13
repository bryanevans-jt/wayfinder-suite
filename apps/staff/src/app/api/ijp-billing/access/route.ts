import {
  canAccessIjpBilling,
  canEditIjpBilling,
} from "@wayfinder/supabase/ijp-billing-settings";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  return NextResponse.json({
    canAccess: canAccessIjpBilling(auth.role),
    canEdit: canEditIjpBilling(auth.role),
    role: auth.role,
    hourlyRateCents: auth.settings.hourly_rate_cents,
  });
}
