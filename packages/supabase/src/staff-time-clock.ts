import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminTierRole, isSupervisorRole } from "./roles";
import { notifySupervisorsForEs, notifyUser } from "./notify-user";
import {
  STAFF_CLOCK_MIN_MINUTES,
  canUseStaffClock,
  localDateStringInTz,
  nyLocalToUtc,
  parseLocalDate,
  shiftDurationMinutes,
  zonedDateTimeParts,
  type StaffClockEditLogRow,
  type StaffClockShiftRow,
} from "./staff-time-clock-shared";

export * from "./staff-time-clock-shared";

function shiftSnapshot(row: StaffClockShiftRow): Record<string, unknown> {
  return {
    clock_in_at: row.clock_in_at,
    clock_out_at: row.clock_out_at,
    local_date: row.local_date,
    auto_out_reason: row.auto_out_reason,
    needs_attention: row.needs_attention,
    notes: row.notes,
  };
}

async function insertEditLog(
  admin: SupabaseClient,
  input: {
    shiftId: string;
    editedBy: string;
    action: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    reason?: string | null;
  }
): Promise<void> {
  const { error } = await admin.from("staff_time_clock_edit_logs").insert({
    shift_id: input.shiftId,
    edited_by: input.editedBy,
    action: input.action,
    before_state: input.before,
    after_state: input.after,
    reason: input.reason ?? null,
  });
  if (error) {
    console.error("staff_time_clock_edit_logs insert failed:", error.message);
  }
}

export async function getOpenShift(
  admin: SupabaseClient,
  staffUserId: string
): Promise<StaffClockShiftRow | null> {
  const { data, error } = await admin
    .from("staff_time_clock_shifts")
    .select("*")
    .eq("staff_user_id", staffUserId)
    .is("clock_out_at", null)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return (data as StaffClockShiftRow | null) ?? null;
}

export async function listShiftsForDate(
  admin: SupabaseClient,
  staffUserId: string,
  localDate: string
): Promise<StaffClockShiftRow[]> {
  const { data, error } = await admin
    .from("staff_time_clock_shifts")
    .select("*")
    .eq("staff_user_id", staffUserId)
    .eq("local_date", localDate)
    .order("clock_in_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as StaffClockShiftRow[];
}

export async function listRecentShifts(
  admin: SupabaseClient,
  staffUserId: string,
  limit = 40
): Promise<StaffClockShiftRow[]> {
  const { data, error } = await admin
    .from("staff_time_clock_shifts")
    .select("*")
    .eq("staff_user_id", staffUserId)
    .order("clock_in_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as StaffClockShiftRow[];
}

export async function listAttentionShifts(
  admin: SupabaseClient,
  staffUserId: string
): Promise<StaffClockShiftRow[]> {
  const { data, error } = await admin
    .from("staff_time_clock_shifts")
    .select("*")
    .eq("staff_user_id", staffUserId)
    .eq("needs_attention", true)
    .order("clock_in_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as StaffClockShiftRow[];
}

/**
 * Close yesterday's open shift at 11:59 PM NY and open a new shift at 12:00 AM
 * when the calendar day rolled over while still clocked in.
 */
export async function applyMidnightSplitIfNeeded(
  admin: SupabaseClient,
  staffUserId: string,
  now: Date = new Date()
): Promise<{ closed: StaffClockShiftRow | null; opened: StaffClockShiftRow | null }> {
  const open = await getOpenShift(admin, staffUserId);
  if (!open) {
    return { closed: null, opened: null };
  }

  const today = localDateStringInTz(now);
  if (open.local_date >= today) {
    return { closed: null, opened: null };
  }

  const { year, month, day } = parseLocalDate(open.local_date);
  const outAt = nyLocalToUtc(year, month, day, 23, 59, 0);

  const before = shiftSnapshot(open);
  const { data: closed, error: closeErr } = await admin
    .from("staff_time_clock_shifts")
    .update({
      clock_out_at: outAt.toISOString(),
      auto_out_reason: "midnight_split",
      updated_at: now.toISOString(),
    })
    .eq("id", open.id)
    .select("*")
    .single();

  if (closeErr || !closed) {
    throw new Error(closeErr?.message ?? "Could not close overnight shift");
  }

  await insertEditLog(admin, {
    shiftId: open.id,
    editedBy: staffUserId,
    action: "midnight_split",
    before,
    after: shiftSnapshot(closed as StaffClockShiftRow),
    reason: "Automatic midnight day split (America/New_York)",
  });

  const nextLocalAfter = (localDate: string): string => {
    const p = parseLocalDate(localDate);
    const noon = nyLocalToUtc(p.year, p.month, p.day, 12, 0, 0);
    noon.setUTCDate(noon.getUTCDate() + 1);
    return localDateStringInTz(noon);
  };

  // Backfill full days between the original local_date and today, then leave an open shift today.
  let cursorDate = nextLocalAfter(open.local_date);
  while (cursorDate < today) {
    const { year: cy, month: cm, day: cd } = parseLocalDate(cursorDate);
    const dayIn = nyLocalToUtc(cy, cm, cd, 0, 0, 0);
    const dayOut = nyLocalToUtc(cy, cm, cd, 23, 59, 0);
    const { data: midRow, error: midErr } = await admin
      .from("staff_time_clock_shifts")
      .insert({
        staff_user_id: staffUserId,
        clock_in_at: dayIn.toISOString(),
        clock_out_at: dayOut.toISOString(),
        local_date: cursorDate,
        auto_out_reason: "midnight_split",
        needs_attention: false,
        updated_at: now.toISOString(),
      })
      .select("*")
      .single();
    if (midErr || !midRow) {
      throw new Error(midErr?.message ?? "Could not backfill overnight day");
    }
    await insertEditLog(admin, {
      shiftId: (midRow as StaffClockShiftRow).id,
      editedBy: staffUserId,
      action: "midnight_split",
      before: {},
      after: shiftSnapshot(midRow as StaffClockShiftRow),
      reason: "Automatic midnight day split backfill",
    });
    cursorDate = nextLocalAfter(cursorDate);
  }

  const todayParts = parseLocalDate(today);
  const todayIn = nyLocalToUtc(todayParts.year, todayParts.month, todayParts.day, 0, 0, 0);
  const { data: opened, error: openErr } = await admin
    .from("staff_time_clock_shifts")
    .insert({
      staff_user_id: staffUserId,
      clock_in_at: todayIn.toISOString(),
      clock_out_at: null,
      local_date: today,
      auto_out_reason: null,
      needs_attention: false,
      updated_at: now.toISOString(),
    })
    .select("*")
    .single();

  if (openErr || !opened) {
    throw new Error(openErr?.message ?? "Could not open new day shift");
  }

  const openedRow = opened as StaffClockShiftRow;
  await insertEditLog(admin, {
    shiftId: openedRow.id,
    editedBy: staffUserId,
    action: "midnight_split",
    before: {},
    after: shiftSnapshot(openedRow),
    reason: "Automatic midnight continue from 12:00 AM",
  });

  return { closed: closed as StaffClockShiftRow, opened: openedRow };
}

export async function clockIn(
  admin: SupabaseClient,
  staffUserId: string,
  now: Date = new Date()
): Promise<StaffClockShiftRow> {
  await applyMidnightSplitIfNeeded(admin, staffUserId, now);

  const existing = await getOpenShift(admin, staffUserId);
  if (existing) {
    const err = new Error("You're already clocked in");
    (err as Error & { code?: string }).code = "ALREADY_CLOCKED_IN";
    throw err;
  }

  const localDate = localDateStringInTz(now);
  const { data, error } = await admin
    .from("staff_time_clock_shifts")
    .insert({
      staff_user_id: staffUserId,
      clock_in_at: now.toISOString(),
      clock_out_at: null,
      local_date: localDate,
      updated_at: now.toISOString(),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not clock in");
  }

  const row = data as StaffClockShiftRow;
  await insertEditLog(admin, {
    shiftId: row.id,
    editedBy: staffUserId,
    action: "clock_in",
    before: {},
    after: shiftSnapshot(row),
  });
  return row;
}

export async function clockOut(
  admin: SupabaseClient,
  staffUserId: string,
  now: Date = new Date()
): Promise<StaffClockShiftRow> {
  await applyMidnightSplitIfNeeded(admin, staffUserId, now);

  const open = await getOpenShift(admin, staffUserId);
  if (!open) {
    throw new Error("You are not clocked in");
  }

  const minutes = shiftDurationMinutes(open.clock_in_at, now.toISOString(), now);
  if (minutes < STAFF_CLOCK_MIN_MINUTES) {
    throw new Error("Shifts must be at least 1 minute long");
  }

  const before = shiftSnapshot(open);
  const { data, error } = await admin
    .from("staff_time_clock_shifts")
    .update({
      clock_out_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", open.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not clock out");
  }

  const row = data as StaffClockShiftRow;
  await insertEditLog(admin, {
    shiftId: row.id,
    editedBy: staffUserId,
    action: "clock_out",
    before,
    after: shiftSnapshot(row),
  });
  return row;
}

export async function acknowledgeStillWorking(
  admin: SupabaseClient,
  staffUserId: string,
  now: Date = new Date()
): Promise<StaffClockShiftRow> {
  await applyMidnightSplitIfNeeded(admin, staffUserId, now);
  const open = await getOpenShift(admin, staffUserId);
  if (!open) {
    throw new Error("You are not clocked in");
  }

  const before = shiftSnapshot(open);
  const { data, error } = await admin
    .from("staff_time_clock_shifts")
    .update({
      still_working_ack_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", open.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save still-working response");
  }

  const row = data as StaffClockShiftRow;
  await insertEditLog(admin, {
    shiftId: row.id,
    editedBy: staffUserId,
    action: "edit_times",
    before,
    after: shiftSnapshot(row),
    reason: "Acknowledged still working after 5:30 PM prompt",
  });
  return row;
}

export async function canActorEditShift(
  admin: SupabaseClient,
  actor: { userId: string; role: string },
  targetStaffUserId: string
): Promise<boolean> {
  if (isAdminTierRole(actor.role)) {
    return true;
  }
  if (actor.userId === targetStaffUserId && canUseStaffClock(actor.role)) {
    return true;
  }
  if (isSupervisorRole(actor.role)) {
    const { data } = await admin
      .from("supervisor_es_assignments")
      .select("es_user_id")
      .eq("supervisor_user_id", actor.userId)
      .eq("es_user_id", targetStaffUserId)
      .maybeSingle();
    return Boolean(data);
  }
  return false;
}

export async function editShift(
  admin: SupabaseClient,
  input: {
    shiftId: string;
    actorUserId: string;
    actorRole: string;
    clockInAt?: string;
    clockOutAt?: string | null;
    needsAttention?: boolean;
    notes?: string | null;
    reason?: string | null;
  }
): Promise<StaffClockShiftRow> {
  const { data: existing, error: loadErr } = await admin
    .from("staff_time_clock_shifts")
    .select("*")
    .eq("id", input.shiftId)
    .maybeSingle();

  if (loadErr) {
    throw new Error(loadErr.message);
  }
  if (!existing) {
    throw new Error("Shift not found");
  }

  const row = existing as StaffClockShiftRow;
  const allowed = await canActorEditShift(
    admin,
    { userId: input.actorUserId, role: input.actorRole },
    row.staff_user_id
  );
  if (!allowed) {
    throw new Error("Forbidden");
  }

  const nextIn = input.clockInAt ?? row.clock_in_at;
  const nextOut =
    input.clockOutAt !== undefined ? input.clockOutAt : row.clock_out_at;

  if (nextOut) {
    const mins = shiftDurationMinutes(nextIn, nextOut);
    if (mins < STAFF_CLOCK_MIN_MINUTES) {
      throw new Error("Shifts must be at least 1 minute long");
    }
  }

  const localDate = localDateStringInTz(new Date(nextIn));
  const before = shiftSnapshot(row);

  const patch: Record<string, unknown> = {
    clock_in_at: nextIn,
    clock_out_at: nextOut,
    local_date: localDate,
    updated_at: new Date().toISOString(),
  };

  if (input.notes !== undefined) {
    patch.notes = input.notes;
  }

  let action = "edit_times";
  if (input.needsAttention !== undefined) {
    patch.needs_attention = input.needsAttention;
    if (input.needsAttention === false) {
      patch.attention_cleared_at = new Date().toISOString();
      action = "clear_attention";
    }
  }

  // Manual edits clear auto-out reason if times changed
  if (input.clockInAt !== undefined || input.clockOutAt !== undefined) {
    patch.auto_out_reason = null;
  }

  const { data: updated, error } = await admin
    .from("staff_time_clock_shifts")
    .update(patch)
    .eq("id", input.shiftId)
    .select("*")
    .single();

  if (error || !updated) {
    throw new Error(error?.message ?? "Could not update shift");
  }

  const afterRow = updated as StaffClockShiftRow;
  await insertEditLog(admin, {
    shiftId: afterRow.id,
    editedBy: input.actorUserId,
    action,
    before,
    after: shiftSnapshot(afterRow),
    reason: input.reason ?? null,
  });

  return afterRow;
}

export async function listEditLogs(
  admin: SupabaseClient,
  shiftId: string
): Promise<StaffClockEditLogRow[]> {
  const { data, error } = await admin
    .from("staff_time_clock_edit_logs")
    .select("*")
    .eq("shift_id", shiftId)
    .order("edited_at", { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as StaffClockEditLogRow[];
}

export async function listOpenShiftsForUsers(
  admin: SupabaseClient,
  staffUserIds: string[]
): Promise<StaffClockShiftRow[]> {
  if (staffUserIds.length === 0) return [];
  const { data, error } = await admin
    .from("staff_time_clock_shifts")
    .select("*")
    .in("staff_user_id", staffUserIds)
    .is("clock_out_at", null);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as StaffClockShiftRow[];
}

async function autoOutStillWorkingTimeout(
  admin: SupabaseClient,
  open: StaffClockShiftRow,
  now: Date
): Promise<StaffClockShiftRow> {
  const { year, month, day } = parseLocalDate(open.local_date);
  const stampedOut = nyLocalToUtc(year, month, day, 17, 30, 0);
  const before = shiftSnapshot(open);

  const { data, error } = await admin
    .from("staff_time_clock_shifts")
    .update({
      clock_out_at: stampedOut.toISOString(),
      auto_out_reason: "still_working_timeout",
      needs_attention: true,
      updated_at: now.toISOString(),
    })
    .eq("id", open.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Auto clock-out failed");
  }

  const row = data as StaffClockShiftRow;
  await insertEditLog(admin, {
    shiftId: row.id,
    editedBy: row.staff_user_id,
    action: "auto_out",
    before,
    after: shiftSnapshot(row),
    reason: "No response to 5:30 PM still-working prompt by 6:00 PM",
  });

  await notifyUser(admin, {
    userId: row.staff_user_id,
    app: "staff",
    kind: "staff_clock_auto_out",
    title: "You were clocked out at 5:30 PM",
    body: "No response to the still-working prompt. Please review and edit this Time Clock entry if needed.",
    link_path: "/dashboard/time-clock",
    metadata: { shiftId: row.id },
  });

  await notifySupervisorsForEs(admin, row.staff_user_id, {
    app: "staff",
    kind: "staff_clock_auto_out_supervisor",
    title: "Team member auto clock-out at 5:30 PM",
    body: "A team member did not respond to the still-working prompt and was clocked out at 5:30 PM (flagged for review).",
    link_path: "/dashboard/time-clock",
    metadata: { shiftId: row.id, staffUserId: row.staff_user_id },
  });

  return row;
}

/** Cron: 5:30 prompts, 6:00 auto-outs, midnight day splits. */
export async function processStaffClockCron(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<{
  prompted: number;
  autoOut: number;
  midnightSplits: number;
}> {
  const parts = zonedDateTimeParts(now);
  const today = localDateStringInTz(now);

  const { data: openRows, error } = await admin
    .from("staff_time_clock_shifts")
    .select("*")
    .is("clock_out_at", null);

  if (error) {
    throw new Error(error.message);
  }

  let prompted = 0;
  let autoOut = 0;
  let midnightSplits = 0;

  for (const raw of openRows ?? []) {
    const open = raw as StaffClockShiftRow;

    if (open.local_date < today) {
      await applyMidnightSplitIfNeeded(admin, open.staff_user_id, now);
      midnightSplits += 1;
      continue;
    }

    const minutesOfDay = parts.hour * 60 + parts.minute;
    const after530 = minutesOfDay >= 17 * 60 + 30;
    const after600 = minutesOfDay >= 18 * 60;

    if (
      after530 &&
      !after600 &&
      !open.still_working_prompted_at &&
      open.local_date === today
    ) {
      const { error: promptErr } = await admin
        .from("staff_time_clock_shifts")
        .update({
          still_working_prompted_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", open.id);
      if (promptErr) {
        console.error("still_working prompt stamp failed:", promptErr.message);
        continue;
      }

      await notifyUser(admin, {
        userId: open.staff_user_id,
        app: "staff",
        kind: "staff_clock_still_working",
        title: "Still working?",
        body: "It is 5:30 PM. Tap to confirm you are still clocked in, or clock out on Time Clock. If we do not hear from you by 6:00 PM, you will be clocked out at 5:30 PM.",
        link_path: "/dashboard/time-clock",
        metadata: { shiftId: open.id },
      });
      prompted += 1;
      continue;
    }

    if (
      after600 &&
      open.still_working_prompted_at &&
      !open.still_working_ack_at &&
      open.local_date === today
    ) {
      await autoOutStillWorkingTimeout(admin, open, now);
      autoOut += 1;
    }
  }

  return { prompted, autoOut, midnightSplits };
}
