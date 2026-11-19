import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveTeamCalendarVisibilityMode,
  isTeamCalendarAdminVisibleRole,
} from "../team-calendar-visibility";

/**
 * Team Calendar visibility mirrors listTeamCalendarVisibleStaffUserIds.
 * Supervisor reports = direct reports from supervisor_es_assignments only.
 */
function visibleStaffIds(opts: {
  viewer: { userId: string; role: string };
  /** Direct report IDs from supervisor_es_assignments.es_user_id. */
  supervisorDirectReportIds?: string[];
  adminTeamIds?: string[];
  /** Profile IDs whose role is admin/super_admin — always stripped. */
  excludedAdminIds?: string[];
}): string[] {
  const mode = resolveTeamCalendarVisibilityMode(opts.viewer.role);
  // Admin / super_admin calendars are never included (including the viewer).
  const exclude = new Set(opts.excludedAdminIds ?? []);
  if (mode === "admin_team") {
    return (opts.adminTeamIds ?? []).filter((id) => !exclude.has(id));
  }
  if (mode === "supervisor_reports") {
    return Array.from(
      new Set([opts.viewer.userId, ...(opts.supervisorDirectReportIds ?? [])])
    ).filter((id) => !exclude.has(id));
  }
  return exclude.has(opts.viewer.userId) ? [] : [opts.viewer.userId];
}

describe("team calendar visibility rules", () => {
  it("admins see ES, Transition Specialist, and Supervisor calendars (not themselves or counselors)", () => {
    const ids = visibleStaffIds({
      viewer: { userId: "admin-1", role: "admin" },
      adminTeamIds: ["es-1", "ts-1", "sup-2"],
      excludedAdminIds: ["admin-1"],
    });
    assert.deepEqual(ids.sort(), ["es-1", "sup-2", "ts-1"].sort());
    assert.equal(isTeamCalendarAdminVisibleRole("es"), true);
    assert.equal(isTeamCalendarAdminVisibleRole("counselor"), false);
  });

  it("never surfaces another admin calendar even if present in a candidate list", () => {
    assert.deepEqual(
      visibleStaffIds({
        viewer: { userId: "sup-1", role: "supervisor" },
        supervisorDirectReportIds: ["es-1", "admin-2"],
        excludedAdminIds: ["admin-2"],
      }).sort(),
      ["sup-1", "es-1"].sort()
    );
  });

  it("super_admins use the same admin team visibility", () => {
    assert.equal(resolveTeamCalendarVisibilityMode("super_admin"), "admin_team");
  });

  it("supervisors see self + direct reports only (no office-shared staff)", () => {
    assert.deepEqual(
      visibleStaffIds({
        viewer: { userId: "sup-1", role: "supervisor" },
        // Only assignment-table IDs — office-shared TS/instructors omitted
        supervisorDirectReportIds: ["es-1", "ts-assigned"],
      }).sort(),
      ["sup-1", "es-1", "ts-assigned"].sort()
    );
  });

  it("does not include office-shared TS/instructors without an assignment row", () => {
    assert.deepEqual(
      visibleStaffIds({
        viewer: { userId: "sup-1", role: "supervisor" },
        supervisorDirectReportIds: ["es-1"],
      }).sort(),
      ["sup-1", "es-1"].sort()
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
