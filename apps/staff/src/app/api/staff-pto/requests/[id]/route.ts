import {
  jsonStaffPtoError,
  requireStaffPtoSession,
  staffPtoOk,
} from "@/lib/staff-pto-auth";
import {
  countBusinessDaysInclusive,
  findOverlappingRequests,
  loadPtoBalanceForUser,
  logPtoEdit,
  mapPtoRequestRow,
} from "@/lib/staff-pto-data";
import { NextRequest } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const route = "api/staff-pto/requests/[id]";
  try {
    const { id } = await context.params;
    const { admin, userId, caps } = await requireStaffPtoSession(true);
    const body = (await request.json()) as {
      action?: string;
      decision_notes?: string;
      start_date?: string;
      end_date?: string;
      days_charged?: number;
      reset_days_charged?: boolean;
      note?: string;
    };

    const action = (body.action ?? "").trim();
    const { data: existingRaw, error: loadErr } = await admin
      .from("staff_pto_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (loadErr) {
      return jsonStaffPtoError(loadErr, route);
    }
    if (!existingRaw) {
      return staffPtoOk({ error: "Request not found." }, { status: 404 });
    }

    const existing = mapPtoRequestRow(existingRaw as Record<string, unknown>);
    const decisionNotes =
      typeof body.decision_notes === "string" ? body.decision_notes.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";

    if (action === "cancel") {
      if (existing.requester_user_id !== userId) {
        return staffPtoOk({ error: "Only the requester can cancel a pending request." }, { status: 403 });
      }
      if (existing.status !== "pending") {
        return staffPtoOk({ error: "Only pending requests can be cancelled by the requester." }, { status: 400 });
      }
      const patch = {
        status: "cancelled",
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin
        .from("staff_pto_requests")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) return jsonStaffPtoError(error, route);
      const after = mapPtoRequestRow(data as Record<string, unknown>);
      await logPtoEdit(admin, {
        requestId: id,
        editedBy: userId,
        action: "cancel",
        before: existing as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
      });
      return staffPtoOk({ ok: true, request: after });
    }

    if (action === "approve" || action === "deny") {
      if (!caps.canApprove) {
        return staffPtoOk({ error: "Forbidden" }, { status: 403 });
      }
      if (existing.status !== "pending") {
        return staffPtoOk({ error: "Only pending requests can be approved or denied." }, { status: 400 });
      }
      if (action === "deny" && !decisionNotes) {
        return staffPtoOk(
          { error: "Please include a short explanation when denying a request." },
          { status: 400 }
        );
      }

      let exceedWarning: string | null = null;
      if (action === "approve") {
        const balance = await loadPtoBalanceForUser(admin, existing.requester_user_id);
        if (
          balance.remainingDays != null &&
          existing.days_charged > balance.remainingDays
        ) {
          exceedWarning = `Approving will exceed remaining PTO (${balance.remainingDays} left; request charges ${existing.days_charged}).`;
        }
      }

      const patch = {
        status: action === "approve" ? "approved" : "denied",
        decision_notes: decisionNotes || null,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin
        .from("staff_pto_requests")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) return jsonStaffPtoError(error, route);
      const after = mapPtoRequestRow(data as Record<string, unknown>);
      await logPtoEdit(admin, {
        requestId: id,
        editedBy: userId,
        action,
        before: existing as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
        note: decisionNotes || null,
      });
      return staffPtoOk({ ok: true, request: after, exceedWarning });
    }

    if (action === "void") {
      if (!caps.canApprove) {
        return staffPtoOk({ error: "Forbidden" }, { status: 403 });
      }
      if (existing.status !== "approved") {
        return staffPtoOk({ error: "Only approved requests can be voided." }, { status: 400 });
      }
      if (!note) {
        return staffPtoOk({ error: "A note is required to void an approved request." }, { status: 400 });
      }
      const patch = {
        status: "cancelled",
        decision_notes: note,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin
        .from("staff_pto_requests")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) return jsonStaffPtoError(error, route);
      const after = mapPtoRequestRow(data as Record<string, unknown>);
      await logPtoEdit(admin, {
        requestId: id,
        editedBy: userId,
        action: "void",
        before: existing as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
        note,
      });
      return staffPtoOk({ ok: true, request: after });
    }

    if (action === "amend") {
      if (!caps.canApprove) {
        return staffPtoOk({ error: "Forbidden" }, { status: 403 });
      }
      if (!note) {
        return staffPtoOk({ error: "An amendment note is required." }, { status: 400 });
      }
      if (existing.status === "cancelled" || existing.status === "denied") {
        return staffPtoOk({ error: "Cannot amend a cancelled or denied request." }, { status: 400 });
      }

      let startDate = existing.start_date;
      let endDate = existing.end_date;
      let daysCharged = existing.days_charged;
      let daysChargedManual = existing.days_charged_manual;
      let logAction = "amend";

      const datesProvided =
        typeof body.start_date === "string" || typeof body.end_date === "string";
      if (datesProvided) {
        startDate =
          typeof body.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.start_date)
            ? body.start_date
            : existing.start_date;
        endDate =
          typeof body.end_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.end_date)
            ? body.end_date
            : existing.end_date;
        if (endDate < startDate) {
          return staffPtoOk({ error: "End date must be on or after start date." }, { status: 400 });
        }
        logAction = "amend_dates";
        if (body.reset_days_charged || !existing.days_charged_manual) {
          daysCharged = countBusinessDaysInclusive(startDate, endDate);
          daysChargedManual = false;
        }
      }

      if (typeof body.days_charged === "number") {
        if (!Number.isFinite(body.days_charged) || body.days_charged < 0) {
          return staffPtoOk({ error: "Days charged must be a non-negative number." }, { status: 400 });
        }
        daysCharged = body.days_charged;
        daysChargedManual = true;
        if (!datesProvided) {
          logAction = "amend_days_charged";
        }
      }

      if (body.reset_days_charged && !datesProvided) {
        daysCharged = countBusinessDaysInclusive(startDate, endDate);
        daysChargedManual = false;
        logAction = "amend_days_charged";
      }

      const overlaps = await findOverlappingRequests(admin, existing.requester_user_id, startDate, endDate, id);

      const patch = {
        start_date: startDate,
        end_date: endDate,
        days_charged: daysCharged,
        days_charged_manual: daysChargedManual,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin
        .from("staff_pto_requests")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) return jsonStaffPtoError(error, route);
      const after = mapPtoRequestRow(data as Record<string, unknown>);
      await logPtoEdit(admin, {
        requestId: id,
        editedBy: userId,
        action: logAction,
        before: existing as unknown as Record<string, unknown>,
        after: after as unknown as Record<string, unknown>,
        note,
      });
      return staffPtoOk({
        ok: true,
        request: after,
        overlapWarning:
          overlaps.length > 0
            ? "Amended dates overlap another pending or approved request."
            : null,
      });
    }

    return staffPtoOk(
      { error: "Unknown action. Use cancel, approve, deny, void, or amend." },
      { status: 400 }
    );
  } catch (error) {
    return jsonStaffPtoError(error, route);
  }
}
