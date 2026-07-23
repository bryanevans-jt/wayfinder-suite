import {
  buildClockStatusPayload,
  jsonStaffClockError,
  requireStaffClockSession,
  resolveClockTargetUserId,
  staffClockOk,
} from "@/lib/staff-clock-auth";

export async function GET(request: Request) {
  const route = "api/staff-clock";
  try {
    const { admin, role, userId } = await requireStaffClockSession();
    const targetParam = new URL(request.url).searchParams.get("userId");
    const targetUserId = await resolveClockTargetUserId(admin, { userId, role }, targetParam);
    const payload = await buildClockStatusPayload(admin, targetUserId);
    return staffClockOk({ ...payload, staffUserId: targetUserId });
  } catch (error) {
    return jsonStaffClockError(error, route);
  }
}
