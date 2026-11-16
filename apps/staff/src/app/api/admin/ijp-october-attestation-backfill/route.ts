import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import {
  canRunOctoberAttestationBackfill,
  executeOctoberAttestationBackfill,
  planOctoberAttestationBackfill,
} from "@/lib/ijp-october-attestation-backfill";
import { NextRequest, NextResponse } from "next/server";

/**
 * Super Admin October attestation copy/link.
 * GET / POST without execute → dry-run plan (counts + client ids, no names).
 * POST { execute: true, confirmExecute: true } → copy Drive PDFs + insert October rows.
 */

function planResponse(plan: Awaited<ReturnType<typeof planOctoberAttestationBackfill>>) {
  return {
    dryRun: true,
    targetRelativePath: plan.targetRelativePath,
    targetServiceMonth: plan.targetServiceMonth,
    attestationRootConfigured: Boolean(plan.attestationRootFolderId),
    counts: plan.counts,
    // Staff-only preview list: client ids only (no display names in API payload docs).
    clientIdsToCopy: plan.toCopy.map((c) => c.clientId),
    candidates: plan.toCopy.map((c) => ({
      clientId: c.clientId,
      sourceServiceMonth: c.sourceServiceMonth,
      capturedAt: c.capturedAt,
      sourceAttestationId: c.sourceAttestationId,
    })),
    alreadyLinkedClientIds: [
      ...new Set(
        plan.candidates.filter((c) => c.octoberAlreadyLinked).map((c) => c.clientId)
      ),
    ],
  };
}

export async function GET(_request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!canRunOctoberAttestationBackfill(auth.role)) {
    return NextResponse.json({ error: "Super Admin required." }, { status: 403 });
  }

  const plan = await planOctoberAttestationBackfill(auth.admin, { dryRun: true });
  return NextResponse.json(planResponse(plan));
}

export async function POST(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!canRunOctoberAttestationBackfill(auth.role)) {
    return NextResponse.json({ error: "Super Admin required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
    execute?: boolean;
    confirmExecute?: boolean;
  };

  const wantExecute = body.execute === true && body.confirmExecute === true;

  const { data: profile } = await auth.admin
    .from("profiles")
    .select("full_name")
    .eq("id", auth.userId)
    .maybeSingle();
  const actorName = (profile?.full_name as string | null) ?? null;

  if (!wantExecute) {
    const plan = await planOctoberAttestationBackfill(auth.admin, { dryRun: true });
    await auth.admin.from("ijp_billing_hour_audit").insert({
      action: "attestation_backfill_plan",
      actor_user_id: auth.userId,
      actor_name: actorName,
      service_month: plan.targetServiceMonth,
      detail: { dryRun: true, counts: plan.counts },
    });
    return NextResponse.json(planResponse(plan));
  }

  if (body.execute === true && body.confirmExecute !== true) {
    return NextResponse.json(
      { error: "confirmExecute=true is required to run the October copy." },
      { status: 400 }
    );
  }

  try {
    const result = await executeOctoberAttestationBackfill(auth.admin, {
      actorUserId: auth.userId,
      actorName,
    });
    return NextResponse.json({
      dryRun: false,
      targetRelativePath: result.targetRelativePath,
      targetServiceMonth: result.targetServiceMonth,
      copied: result.copied,
      skipped: result.skipped,
      failed: result.failed,
      counts: {
        copied: result.copied,
        skipped: result.skipped.length,
        failed: result.failed.length,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "October copy failed." },
      { status: 400 }
    );
  }
}
