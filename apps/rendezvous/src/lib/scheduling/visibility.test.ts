import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { esUserAllowedForSupervisor, type SupervisorScope } from "@wayfinder/supabase/supervisor-client-scope";
import { isAdminTierRole, isSupervisorRole } from "@wayfinder/supabase/roles";

/**
 * Mirrors listVisibleStaffUserIds / canViewStaffBookings rules without DB I/O.
 */
function visibleStaffIds(
  viewer: { userId: string; role: string },
  scope: SupervisorScope | null
): string[] | "all" {
  if (isAdminTierRole(viewer.role)) return "all";
  if (isSupervisorRole(viewer.role) && scope) {
    return Array.from(new Set([viewer.userId, ...scope.esUserIds]));
  }
  return [viewer.userId];
}

describe("team calendar visibility rules", () => {
  it("admins see everyone", () => {
    assert.equal(visibleStaffIds({ userId: "a1", role: "admin" }, null), "all");
    assert.equal(visibleStaffIds({ userId: "sa", role: "super_admin" }, null), "all");
  });

  it("supervisors see self + direct reports from supervisor_es_assignments scope", () => {
    const scope: SupervisorScope = {
      supervisorUserId: "sup-1",
      officeIds: ["o1"],
      esUserIds: ["es-1", "ts-1"],
    };
    assert.deepEqual(visibleStaffIds({ userId: "sup-1", role: "supervisor" }, scope), [
      "sup-1",
      "es-1",
      "ts-1",
    ]);
    assert.equal(esUserAllowedForSupervisor(scope, "es-1"), true);
    assert.equal(esUserAllowedForSupervisor(scope, "es-9"), false);
  });

  it("specialists see only themselves", () => {
    assert.deepEqual(visibleStaffIds({ userId: "es-1", role: "es" }, null), ["es-1"]);
    assert.deepEqual(
      visibleStaffIds({ userId: "ts-1", role: "transition_specialist" }, null),
      ["ts-1"]
    );
  });
});
