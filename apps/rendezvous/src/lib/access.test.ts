import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessRendezvousStaffApp,
  isPublicBookingAllowed,
  RENDEZVOUS_STAFF_ACCESS_MODE,
} from "./access";

describe("rendezvous access gating", () => {
  it("keeps staff app dark when feature flag is off for every role", () => {
    for (const role of ["super_admin", "admin", "supervisor", "es", "transition_specialist", null]) {
      assert.equal(
        canAccessRendezvousStaffApp({ featureEnabled: false, role }),
        false,
        `expected no access for ${role}`
      );
    }
  });

  it("allows only super_admin when flag is on (current rollout mode)", () => {
    assert.equal(RENDEZVOUS_STAFF_ACCESS_MODE, "super_admin_only");
    assert.equal(
      canAccessRendezvousStaffApp({ featureEnabled: true, role: "super_admin" }),
      true
    );
    assert.equal(canAccessRendezvousStaffApp({ featureEnabled: true, role: "admin" }), false);
    assert.equal(canAccessRendezvousStaffApp({ featureEnabled: true, role: "supervisor" }), false);
    assert.equal(canAccessRendezvousStaffApp({ featureEnabled: true, role: "es" }), false);
    assert.equal(
      canAccessRendezvousStaffApp({ featureEnabled: true, role: "transition_specialist" }),
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
