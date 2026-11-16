import { canEditIjpBilling } from "@wayfinder/supabase/ijp-billing-settings";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { unbillIjpLedgerEntries } from "@/lib/ijp-billing-ledger-actions";
import { NextRequest, NextResponse } from "next/server";

/** Uncheck billed hours back to Not billed yet (audit + rebuild confirm for compiled). */
export async function POST(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!canEditIjpBilling(auth.role)) {
    return NextResponse.json({ error: "Edit access required." }, { status: 403 });
  }

  const body = (await request.json()) as {
    entryIds?: string[];
    confirmRebuild?: boolean;
  };
  const entryIds = Array.isArray(body.entryIds) ? body.entryIds : [];
  if (entryIds.length === 0) {
    return NextResponse.json({ error: "entryIds required." }, { status: 400 });
  }

  const { data: profile } = await auth.admin
    .from("profiles")
    .select("full_name")
    .eq("id", auth.userId)
    .maybeSingle();

  const result = await unbillIjpLedgerEntries(auth.admin, {
    entryIds,
    actorUserId: auth.userId,
    actorName: (profile?.full_name as string | null) ?? null,
    confirmRebuild: body.confirmRebuild === true,
    hourlyRateCents: auth.settings.hourly_rate_cents,
  });

  if (result.needsRebuildConfirm.length > 0 && body.confirmRebuild !== true) {
    return NextResponse.json(
      {
        needsRebuildConfirm: result.needsRebuildConfirm,
        cleared: 0,
        failed: result.failed,
        message:
          "Some hours are on a compiled invoice. Confirm rebuild to uncheck them and flag the invoice Needs rebuild.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json(result);
}
