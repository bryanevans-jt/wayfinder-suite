import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allocateUniqueSlug,
  isRendezvousTeamMemberRole,
  slugFromPersonName,
} from "./schedule-defaults";

describe("isRendezvousTeamMemberRole", () => {
  it("includes Joshua Tree team roles", () => {
    for (const role of [
      "es",
      "transition_specialist",
      "supervisor",
      "admin",
      "super_admin",
      "hr",
      "accountant",
      "hospitality_specialist",
    ]) {
      assert.equal(isRendezvousTeamMemberRole(role), true, role);
    }
  });

  it("excludes counselors, clients, and natural supports", () => {
    for (const role of ["counselor", "gvra_supervisor", "client", "support"]) {
      assert.equal(isRendezvousTeamMemberRole(role), false, role);
    }
  });
});

describe("slugFromPersonName", () => {
  it("builds firstname-lastname", () => {
    assert.equal(
      slugFromPersonName({ firstName: "Jane", lastName: "Doe", fullName: "Jane Doe" }),
      "jane-doe"
    );
  });

  it("falls back to full name when parts are missing", () => {
    assert.equal(
      slugFromPersonName({ firstName: null, lastName: null, fullName: "Alex Rivera" }),
      "alex-rivera"
    );
  });
});

describe("allocateUniqueSlug", () => {
  it("avoids collisions", () => {
    const taken = new Set(["jane-doe"]);
    assert.equal(allocateUniqueSlug("jane-doe", taken), "jane-doe-2");
    assert.equal(allocateUniqueSlug("jane-doe", taken), "jane-doe-3");
  });
});
