import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveTeamCalendarVisibilityMode,
  isTeamCalendarAdminVisibleRole,
} from "../team-calendar-visibility";

/**
 * Team Calendar visibility mirrors listTeamCalendarVisibleStaffUserIds.
 * Supervisor reports come only from supervisor_es_assignments (not office share).
 */
function visibleStaffIds(opts: {
  viewer: { userId: string; role: string };
  assignedEsUserIds?: string[];
  adminTeamIds?: string[];
}): string[] {
  const mode = resolveTeamCalendarVisibilityMode(opts.viewer.role);
  if (mode === "admin_team") {
    return Array.from(
      new Set([opts.viewer.userId, ...(opts.adminTeamIds ?? [])])
    );
  }
  if (mode === "supervisor_reports") {
    return Array.from(
      new Set([opts.viewer.userId, ...(opts.assignedEsUserIds ?? [])])
    );
  }
  return [opts.viewer.userId];
}

describe("team calendar visibility rules", () => {
  it("admins see ES, Transition Specialist, and Supervisor calendars (not counselors)", () => {
    const ids = visibleStaffIds({
      viewer: { userId: "admin-1", role: "admin" },
      adminTeamIds: ["es-1", "ts-1", "sup-2"],
    });
    assert.deepEqual(ids.sort(), ["admin-1", "es-1", "sup-2", "ts-1"].sort());
    assert.equal(isTeamCalendarAdminVisibleRole("es"), true);
    assert.equal(isTeamCalendarAdminVisibleRole("counselor"), false);
  });

  it("super_admins use the same admin team visibility", () => {
    assert.equal(resolveTeamCalendarVisibilityMode("super_admin"), "admin_team");
  });

  it("supervisors see self + supervisor_es_assignments reports only", () => {
    assert.deepEqual(
      visibleStaffIds({
        viewer: { userId: "sup-1", role: "supervisor" },
        assignedEsUserIds: ["es-1", "ts-1"],
      }),
      ["sup-1", "es-1", "ts-1"]
    );
  });

  it("does not invent office-shared staff for supervisors on the calendar", () => {
    // Office-shared TS would appear in loadSupervisorScope for caseload, but
    // Team Calendar must not include them unless they are also in assignments.
    assert.deepEqual(
      visibleStaffIds({
        viewer: { userId: "sup-1", role: "supervisor" },
        assignedEsUserIds: ["es-1"],
      }),
      ["sup-1", "es-1"]
    );
  });

  it("specialists see only themselves", () => {
    assert.deepEqual(
      visibleStaffIds({ viewer: { userId: "es-1", role: "es" } }),
      ["es-1"]
    );
    assert.deepEqual(
      visibleStaffIds({
        viewer: { userId: "ts-1", role: "transition_specialist" },
      }),
      ["ts-1"]
    );
  });
});
