import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessRendezvousStaffApp, isPublicBookingAllowed } from "./access";

describe("rendezvous access gating", () => {
  it("keeps staff app dark when feature flag is off for every role", () => {
    for (const role of ["super_admin", "admin", "supervisor", "es", "transition_specialist", null]) {
      assert.equal(
        canAccessRendezvousStaffApp({ featureEnabled: false, openToAll: true, role }),
        false,
        `expected no access for ${role}`
      );
    }
  });

  it("allows only super_admin when flag is on and openToAll is off", () => {
    assert.equal(
      canAccessRendezvousStaffApp({ featureEnabled: true, openToAll: false, role: "super_admin" }),
      true
    );
    assert.equal(
      canAccessRendezvousStaffApp({ featureEnabled: true, openToAll: false, role: "admin" }),
      false
    );
    assert.equal(
      canAccessRendezvousStaffApp({ featureEnabled: true, openToAll: false, role: "supervisor" }),
      false
    );
    assert.equal(
      canAccessRendezvousStaffApp({ featureEnabled: true, openToAll: false, role: "es" }),
      false
    );
    assert.equal(
      canAccessRendezvousStaffApp({
        featureEnabled: true,
        openToAll: false,
        role: "transition_specialist",
      }),
      false
    );
  });

  it("allows ES/TS/supervisor/admin when openToAll is on", () => {
    for (const role of ["super_admin", "admin", "supervisor", "es", "transition_specialist"]) {
      assert.equal(
        canAccessRendezvousStaffApp({ featureEnabled: true, openToAll: true, role }),
        true,
        `expected access for ${role}`
      );
    }
    assert.equal(
      canAccessRendezvousStaffApp({ featureEnabled: true, openToAll: true, role: "counselor" }),
      false
    );
  });

  it("requires both org flag and schedule.enabled for public booking", () => {
    assert.equal(
      isPublicBookingAllowed({ featureEnabled: false, scheduleEnabled: true }),
      false
    );
    assert.equal(
      isPublicBookingAllowed({ featureEnabled: true, scheduleEnabled: false }),
      false
    );
    assert.equal(
      isPublicBookingAllowed({ featureEnabled: true, scheduleEnabled: true }),
      true
    );
  });
});
