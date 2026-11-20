import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  directorCanMutateCasework,
  directorVisibleStaffRoles,
  isDirectorAllowedStaffPath,
  isDirectorBlockedStaffPath,
  isDirectorVisibleStaffRole,
  isReadOnlySafeHttpMethod,
} from "./director-scope";
import {
  canAssignClientEs,
  canWriteStaffOnlyClientNotes,
  isDirectorRole,
  isReadOnlyStaffRole,
  roleDisplayName,
  staffHomePath,
} from "./roles";

describe("director role helpers", () => {
  it("recognizes both director roles as read-only staff", () => {
    assert.equal(isDirectorRole("transition_director"), true);
    assert.equal(isDirectorRole("vocational_director"), true);
    assert.equal(isReadOnlyStaffRole("transition_director"), true);
    assert.equal(isReadOnlyStaffRole("vocational_director"), true);
    assert.equal(isReadOnlyStaffRole("supervisor"), false);
  });

  it("maps role-derived staff scope without assignment tables", () => {
    assert.deepEqual(
      [...directorVisibleStaffRoles("transition_director")].sort(),
      ["instructor", "supervisor", "transition_specialist"].sort()
    );
    assert.deepEqual(
      [...directorVisibleStaffRoles("vocational_director")].sort(),
      ["es", "supervisor"].sort()
    );
    assert.equal(
      isDirectorVisibleStaffRole("transition_director", "instructor"),
      true
    );
    assert.equal(isDirectorVisibleStaffRole("transition_director", "es"), false);
    assert.equal(isDirectorVisibleStaffRole("vocational_director", "es"), true);
    assert.equal(
      isDirectorVisibleStaffRole("vocational_director", "transition_specialist"),
      false
    );
    // Supervisors report to both directors.
    assert.equal(isDirectorVisibleStaffRole("transition_director", "supervisor"), true);
    assert.equal(isDirectorVisibleStaffRole("vocational_director", "supervisor"), true);
  });

  it("blocks casework mutations for directors", () => {
    assert.equal(directorCanMutateCasework("transition_director"), false);
    assert.equal(directorCanMutateCasework("vocational_director"), false);
    assert.equal(directorCanMutateCasework("supervisor"), true);
    assert.equal(canAssignClientEs("transition_director"), false);
    assert.equal(canWriteStaffOnlyClientNotes("vocational_director"), false);
  });

  it("blocks admin-only paths and allows oversight paths", () => {
    assert.equal(isDirectorBlockedStaffPath("/dashboard/admin"), true);
    assert.equal(isDirectorBlockedStaffPath("/dashboard/super-admin/users"), true);
    assert.equal(isDirectorBlockedStaffPath("/dashboard/ijp-billing"), true);
    assert.equal(isDirectorBlockedStaffPath("/dashboard/exports"), true);
    assert.equal(
      isDirectorAllowedStaffPath("/dashboard/clients", "transition_director"),
      true
    );
    assert.equal(
      isDirectorAllowedStaffPath("/dashboard/pre-ets", "transition_director"),
      true
    );
    assert.equal(
      isDirectorAllowedStaffPath("/dashboard/pre-ets", "vocational_director"),
      false
    );
    assert.equal(
      isDirectorAllowedStaffPath("/dashboard/admin", "vocational_director"),
      false
    );
  });

  it("treats only safe HTTP methods as read-only allowed", () => {
    assert.equal(isReadOnlySafeHttpMethod("GET"), true);
    assert.equal(isReadOnlySafeHttpMethod("POST"), false);
    assert.equal(isReadOnlySafeHttpMethod("PATCH"), false);
    assert.equal(isReadOnlySafeHttpMethod("DELETE"), false);
  });

  it("homes directors on /dashboard/director with clear labels", () => {
    assert.equal(staffHomePath("transition_director"), "/dashboard/director");
    assert.equal(staffHomePath("vocational_director"), "/dashboard/director");
    assert.equal(
      roleDisplayName("transition_director"),
      "Director of Transition Services"
    );
    assert.equal(
      roleDisplayName("vocational_director"),
      "Director of Development & Vocational Services"
    );
  });
});
