import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ASSIGNABLE_STAFF_ROLES,
  canActorAssignStaffRole,
  canManageTeamDirectory,
  isAssignableStaffRole,
  isSuperAdminOnlyAssignableRole,
} from "./roles";

describe("staff role assignment gates", () => {
  it("hides hr from assignable staff roles (enum role remains elsewhere)", () => {
    assert.equal(isAssignableStaffRole("hr"), false);
    assert.ok(!(ASSIGNABLE_STAFF_ROLES as readonly string[]).includes("hr"));
  });

  it("treats admin and super_admin as Super Admin–only assignable", () => {
    assert.equal(isSuperAdminOnlyAssignableRole("admin"), true);
    assert.equal(isSuperAdminOnlyAssignableRole("super_admin"), true);
    assert.equal(isAssignableStaffRole("admin"), false);
  });

  it("allows only Super Admin to grant Admin or Super Admin", () => {
    assert.equal(canActorAssignStaffRole("super_admin", "admin"), true);
    assert.equal(canActorAssignStaffRole("super_admin", "super_admin"), true);
    assert.equal(canActorAssignStaffRole("admin", "admin"), false);
    assert.equal(canActorAssignStaffRole("admin", "super_admin"), false);
  });

  it("allows Super Admin (and Admin for non-elevated) to assign field/org roles", () => {
    assert.equal(canActorAssignStaffRole("super_admin", "es"), true);
    assert.equal(canActorAssignStaffRole("admin", "es"), true);
    assert.equal(canActorAssignStaffRole("admin", "accountant"), true);
    assert.equal(canActorAssignStaffRole("supervisor", "es"), false);
  });

  it("lets Admin tier manage Team Directory (HR Director retired)", () => {
    assert.equal(canManageTeamDirectory("admin"), true);
    assert.equal(canManageTeamDirectory("super_admin"), true);
    assert.equal(canManageTeamDirectory("hr"), true);
    assert.equal(canManageTeamDirectory("es"), false);
  });
});
