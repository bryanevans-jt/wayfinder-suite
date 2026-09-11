import { assertPortalMutation, assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import {
  loadContactLogTimeEditPayload,
  loadLinkedTimeEntrySnapshot,
  type ContactLogTimeEntrySnapshot,
} from "@/lib/admin-contact-log-time";
import { recordContactLogEvent } from "@/lib/contact-log-events";
import { updateEsTimeEntry } from "@wayfinder/supabase/es-time-tracking";
import { NextRequest } from "next/server";

function snapshotForAudit(entry: ContactLogTimeEntrySnapshot) {
  return {
    time_entry_id: entry.id,
    activity_type_id: entry.activityTypeId,
    service_date: entry.serviceDate,
    duration_minutes: entry.durationMinutes,
    start_time: entry.startTime,
    end_time: entry.endTime,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("super_admin");
    const contactLogId = request.nextUrl.searchParams.get("contactLogId")?.trim();
    if (!contactLogId) {
      return Response.json({ error: "contactLogId is required" }, { status: 400 });
    }

    const payload = await loadContactLogTimeEditPayload(admin, contactLogId);
    if (!payload) {
      return Response.json({ error: "Contact log not found" }, { status: 404 });
    }

    return Response.json(payload);
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, user } = await assertPortalMutation("super_admin");
    const body = (await request.json()) as {
      contactLogId?: string;
      timeEntryId?: string;
      activityTypeId?: string;
      serviceDate?: string;
      durationMinutes?: number;
      startTime?: string;
      endTime?: string;
    };

    const contactLogId = body.contactLogId?.trim();
    const timeEntryId = body.timeEntryId?.trim();
    const activityTypeId = body.activityTypeId?.trim();
    const serviceDate = body.serviceDate?.trim();
    const durationMinutes = Number(body.durationMinutes);

    if (!contactLogId || !timeEntryId || !activityTypeId || !serviceDate) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return Response.json({ error: "Duration must be greater than zero" }, { status: 400 });
    }

    const payload = await loadContactLogTimeEditPayload(admin, contactLogId);
    if (!payload) {
      return Response.json({ error: "Contact log not found" }, { status: 404 });
    }
    if (!payload.timeEntry || payload.timeEntry.id !== timeEntryId) {
      return Response.json({ error: "Linked time entry not found for this contact log" }, { status: 404 });
    }

    const before = payload.timeEntry;

    await updateEsTimeEntry(admin, timeEntryId, {
      activityTypeId,
      serviceDate,
      durationMinutes,
      startTime: body.startTime,
      endTime: body.endTime,
    });

    const after = await loadLinkedTimeEntrySnapshot(admin, contactLogId);
    if (!after) {
      return Response.json({ error: "Time entry could not be reloaded after save" }, { status: 500 });
    }

    await recordContactLogEvent(admin, {
      contactLogId,
      clientId: payload.clientId,
      actorUserId: user.id,
      eventKind: "admin_edited",
      metadata: {
        field: "service_time",
        before: snapshotForAudit(before),
        after: snapshotForAudit(after),
      },
    });

    return Response.json({ ok: true, timeEntry: after });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
