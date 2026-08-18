import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { insertInvoicePacketEvent } from "@wayfinder/supabase/pre-ets-invoice-packet";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/invoice-packets/[id]";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      status?: "draft" | "ready" | "submitted" | "paid";
      providerInvoiceNumber?: string | null;
      totalAmountCents?: number;
      notes?: string | null;
    };

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status) patch.status = body.status;
    if (body.providerInvoiceNumber !== undefined) {
      patch.provider_invoice_number = body.providerInvoiceNumber;
    }
    if (body.totalAmountCents !== undefined) {
      patch.total_amount_cents = body.totalAmountCents;
    }
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.status === "submitted") patch.submitted_at = new Date().toISOString();
    if (body.status === "paid") patch.paid_at = new Date().toISOString();

    const admin = createServiceRoleClient();

    const { data: existing } = await admin
      .from("pre_ets_invoice_packets")
      .select("status")
      .eq("id", id)
      .maybeSingle();

    const { error } = await admin.from("pre_ets_invoice_packets").update(patch).eq("id", id);

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    if (body.status && body.status !== existing?.status) {
      await insertInvoicePacketEvent(admin, {
        packetId: id,
        actorUserId: auth.userId,
        eventKind: "status_changed",
        fromStatus: existing?.status as string | null,
        toStatus: body.status,
      });
    }

    if (body.notes !== undefined) {
      await insertInvoicePacketEvent(admin, {
        packetId: id,
        actorUserId: auth.userId,
        eventKind: "notes_updated",
        metadata: { notes: body.notes },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
