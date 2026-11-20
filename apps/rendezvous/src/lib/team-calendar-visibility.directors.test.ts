import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveTeamCalendarVisibilityMode } from "./team-calendar-visibility";
import { directorVisibleStaffRoles } from "@wayfinder/supabase/director-scope";

describe("team calendar director visibility", () => {
  it("gives directors director_scope mode (not admin_team)", () => {
    assert.equal(
      resolveTeamCalendarVisibilityMode("transition_director"),
      "director_scope"
    );
    assert.equal(
      resolveTeamCalendarVisibilityMode("vocational_director"),
      "director_scope"
    );
    assert.equal(resolveTeamCalendarVisibilityMode("admin"), "admin_team");
    assert.equal(resolveTeamCalendarVisibilityMode("supervisor"), "supervisor_reports");
  });

  it("scopes calendars by role mapping (supervisors on both; no admins)", () => {
    const transition = directorVisibleStaffRoles("transition_director");
    const vocational = directorVisibleStaffRoles("vocational_director");
    assert.ok(transition.includes("supervisor"));
    assert.ok(vocational.includes("supervisor"));
    assert.ok(transition.includes("instructor"));
    assert.ok(transition.includes("transition_specialist"));
    assert.ok(vocational.includes("es"));
    assert.ok(!transition.includes("admin"));
    assert.ok(!vocational.includes("super_admin"));
    assert.ok(!transition.includes("es"));
  });
});
