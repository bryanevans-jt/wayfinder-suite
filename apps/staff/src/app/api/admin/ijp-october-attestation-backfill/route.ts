import { canManageIjpBillingSettings } from "@wayfinder/supabase/ijp-billing-settings";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { planOctoberAttestationBackfill } from "@/lib/ijp-october-attestation-backfill";
import { NextRequest, NextResponse } from "next/server";

/**
 * One-time October attestation copy/link plan.
 * Always dry-run unless execute=true AND confirmExecute=true (not used in this PR).
 * Returns counts only in the default response shape (no client names).
 */
export async function GET(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!canManageIjpBillingSettings(auth.role)) {
    return NextResponse.json({ error: "Super Admin required." }, { status: 403 });
  }

  const execute = request.nextUrl.searchParams.get("execute") === "true";
  const confirmExecute =
    request.nextUrl.searchParams.get("confirmExecute") === "true";

  // Never execute Drive copy/link from this route in the current PR.
  if (execute || confirmExecute) {
    return NextResponse.json(
      {
        error:
          "Execute is disabled in this build. Run dry-run only; Bryan must approve a follow-up to perform Drive copies.",
      },
      { status: 400 }
    );
  }

  const plan = await planOctoberAttestationBackfill(auth.admin, { dryRun: true });

  return NextResponse.json({
    dryRun: true,
    targetRelativePath: plan.targetRelativePath,
    attestationRootConfigured: Boolean(plan.attestationRootFolderId),
    counts: plan.counts,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!canManageIjpBillingSettings(auth.role)) {
    return NextResponse.json({ error: "Super Admin required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
    execute?: boolean;
  };

  if (body.execute === true || body.dryRun === false) {
    return NextResponse.json(
      {
        error:
          "Execute is disabled in this build. Dry-run only; no Drive writes from this route.",
      },
      { status: 400 }
    );
  }

  const plan = await planOctoberAttestationBackfill(auth.admin, { dryRun: true });

  await auth.admin.from("ijp_billing_hour_audit").insert({
    action: "attestation_backfill_plan",
    actor_user_id: auth.userId,
    detail: { dryRun: true, counts: plan.counts },
  });

  return NextResponse.json({
    dryRun: true,
    targetRelativePath: plan.targetRelativePath,
    attestationRootConfigured: Boolean(plan.attestationRootFolderId),
    counts: plan.counts,
  });
}
