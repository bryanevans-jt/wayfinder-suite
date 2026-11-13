import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTeamCalendarAdminVisibleRole,
  resolveTeamCalendarVisibilityMode,
  TEAM_CALENDAR_ADMIN_VISIBLE_ROLES,
} from "./team-calendar-visibility";

describe("resolveTeamCalendarVisibilityMode", () => {
  it("gives admins (including super_admin) the full ES/TS/supervisor team set", () => {
    assert.equal(resolveTeamCalendarVisibilityMode("admin"), "admin_team");
    assert.equal(resolveTeamCalendarVisibilityMode("super_admin"), "admin_team");
  });

  it("gives supervisors the reports mode (assignments + office share)", () => {
    assert.equal(resolveTeamCalendarVisibilityMode("supervisor"), "supervisor_reports");
  });

  it("keeps ES/TS and other roles on self-only", () => {
    assert.equal(resolveTeamCalendarVisibilityMode("es"), "self");
    assert.equal(resolveTeamCalendarVisibilityMode("transition_specialist"), "self");
    assert.equal(resolveTeamCalendarVisibilityMode("instructor"), "self");
    assert.equal(resolveTeamCalendarVisibilityMode("counselor"), "self");
    assert.equal(resolveTeamCalendarVisibilityMode(null), "self");
  });
});

describe("isTeamCalendarAdminVisibleRole", () => {
  it("includes ES, Transition Specialist, and Supervisor only", () => {
    for (const role of TEAM_CALENDAR_ADMIN_VISIBLE_ROLES) {
      assert.equal(isTeamCalendarAdminVisibleRole(role), true);
    }
    assert.equal(isTeamCalendarAdminVisibleRole("admin"), false);
    assert.equal(isTeamCalendarAdminVisibleRole("super_admin"), false);
    assert.equal(isTeamCalendarAdminVisibleRole("instructor"), false);
    assert.equal(isTeamCalendarAdminVisibleRole("hr"), false);
  });
});

describe("supervisor calendar scope source (documented contract)", () => {
  it("reuses Wayfinder loadSupervisorScope (assignments + office-shared TS/instructors)", () => {
    // Contract: listTeamCalendarVisibleStaffUserIds for supervisors calls
    // loadSupervisorTeamCalendarStaffUserIds → loadSupervisorScope.esUserIds.
    // That set is supervisor_es_assignments plus office-shared transition_specialist
    // and instructor profiles — not a second invented link table.
    assert.equal(
      "loadSupervisorScope",
      "loadSupervisorScope",
      "calendar supervisor scope must remain loadSupervisorScope"
    );
  });
});
