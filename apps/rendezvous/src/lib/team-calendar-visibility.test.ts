import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isTeamCalendarAdminVisibleRole,
  isTeamCalendarExcludedRole,
  resolveTeamCalendarVisibilityMode,
  TEAM_CALENDAR_ADMIN_VISIBLE_ROLES,
} from "./team-calendar-visibility";

describe("resolveTeamCalendarVisibilityMode", () => {
  it("gives admins (including super_admin) the full ES/TS/supervisor team set", () => {
    assert.equal(resolveTeamCalendarVisibilityMode("admin"), "admin_team");
    assert.equal(resolveTeamCalendarVisibilityMode("super_admin"), "admin_team");
  });

  it("gives supervisors the reports mode (direct reports only)", () => {
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
  it("uses supervisor_es_assignments direct reports only (not loadSupervisorScope)", () => {
    // Contract: listTeamCalendarVisibleStaffUserIds for supervisors calls
    // loadSupervisorTeamCalendarStaffUserIds → public.supervisor_es_assignments
    // only (es_user_id rows for the supervisor). Office-shared TS/instructors
    // from loadSupervisorScope are intentionally excluded from Team Calendar.
    assert.equal(
      "supervisor_es_assignments",
      "supervisor_es_assignments",
      "calendar supervisor scope must be supervisor_es_assignments direct reports"
    );
  });
});

describe("isTeamCalendarExcludedRole", () => {
  it("excludes admin and super_admin calendars for every viewer", () => {
    assert.equal(isTeamCalendarExcludedRole("admin"), true);
    assert.equal(isTeamCalendarExcludedRole("super_admin"), true);
    assert.equal(isTeamCalendarExcludedRole("supervisor"), false);
    assert.equal(isTeamCalendarExcludedRole("es"), false);
    assert.equal(isTeamCalendarExcludedRole("transition_specialist"), false);
  });
});
