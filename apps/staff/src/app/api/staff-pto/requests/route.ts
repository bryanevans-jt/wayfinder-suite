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
import { loadStaffNameById } from "@/lib/staff-names";
import {
  isValidPtoReason,
  todayEasternDateString,
  type PtoStatus,
} from "@wayfinder/supabase/staff-pto-shared";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const route = "api/staff-pto/requests";
  try {
    const { admin } = await requireStaffPtoSession(false);
    const filter = (request.nextUrl.searchParams.get("filter") ?? "active").toLowerCase();
    const today = todayEasternDateString();

    let query = admin.from("staff_pto_requests").select("*").order("start_date", { ascending: false });

    if (filter === "pending") {
      query = query.eq("status", "pending");
    } else if (filter === "approved") {
      query = query.eq("status", "approved");
    } else if (filter === "denied") {
      query = query.eq("status", "denied");
    } else if (filter === "past") {
      query = query.lt("end_date", today).neq("status", "cancelled");
    } else if (filter === "all") {
      // no status filter
    } else {
      // active: pending, or decided with end_date still in the future/today
      query = query.in("status", ["pending", "approved", "denied"]);
    }

    const { data, error } = await query.limit(500);
    if (error) {
      return jsonStaffPtoError(error, route);
    }

    let rows = (data ?? []).map((row) => mapPtoRequestRow(row as Record<string, unknown>));
    if (filter === "active" || filter === "") {
      rows = rows.filter(
        (r) => r.status === "pending" || (r.status !== "cancelled" && r.end_date >= today)
      );
    }    const userIds = [
      ...new Set(
        rows.flatMap((r) => [r.requester_user_id, r.decided_by].filter(Boolean) as string[])
      ),
    ];
    const names = await loadStaffNameById(admin, userIds);

    return staffPtoOk({
      filter,
      today,
      requests: rows.map((r) => ({
        ...r,
        requester_name: names.get(r.requester_user_id) ?? "Team member",
        decided_by_name: r.decided_by ? names.get(r.decided_by) ?? null : null,
      })),
    });
  } catch (error) {
    return jsonStaffPtoError(error, route);
  }
}

export async function POST(request: NextRequest) {
  const route = "api/staff-pto/requests";
  try {
    const { admin, userId } = await requireStaffPtoSession(true);
    const body = (await request.json()) as {
      start_date?: string;
      end_date?: string;
      reason?: string;
      details?: string;
    };

    const startDate = typeof body.start_date === "string" ? body.start_date.trim() : "";
    const endDate = typeof body.end_date === "string" ? body.end_date.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const details = typeof body.details === "string" ? body.details.trim() : "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return staffPtoOk({ error: "Start and end dates are required." }, { status: 400 });
    }
    if (endDate < startDate) {
      return staffPtoOk({ error: "End date must be on or after start date." }, { status: 400 });
    }
    if (!isValidPtoReason(reason)) {
      return staffPtoOk({ error: "Select a valid reason." }, { status: 400 });
    }
    if (reason === "other" && !details) {
      return staffPtoOk({ error: "Please add details when reason is Other." }, { status: 400 });
    }

    const daysCharged = countBusinessDaysInclusive(startDate, endDate);
    if (daysCharged <= 0) {
      return staffPtoOk(
        { error: "Selected range has no business days (Mon–Fri). Adjust dates or ask HR to set days charged after submit." },
        { status: 400 }
      );
    }

    const overlaps = await findOverlappingRequests(admin, userId, startDate, endDate);
    const balance = await loadPtoBalanceForUser(admin, userId);
    const remaining = balance.remainingDays;
    const exceedWarning =
      remaining != null && daysCharged > remaining
        ? `This request is for ${daysCharged} day(s) but you have ${remaining} remaining in the current period.`
        : null;

    const insertRow = {
      requester_user_id: userId,
      start_date: startDate,
      end_date: endDate,
      reason,
      details: details || null,
      days_charged: daysCharged,
      days_charged_manual: false,
      status: "pending" as PtoStatus,
    };

    const { data, error } = await admin
      .from("staff_pto_requests")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      return jsonStaffPtoError(error, route);
    }

    const created = mapPtoRequestRow(data as Record<string, unknown>);
    await logPtoEdit(admin, {
      requestId: created.id,
      editedBy: userId,
      action: "create",
      before: {},
      after: created as unknown as Record<string, unknown>,
      note: null,
    });

    return staffPtoOk({
      ok: true,
      request: created,
      overlapWarning:
        overlaps.length > 0
          ? "This overlaps another pending or approved request. You can still submit; HR/admin will decide."
          : null,
      exceedWarning,
    });
  } catch (error) {
    return jsonStaffPtoError(error, route);
  }
}
