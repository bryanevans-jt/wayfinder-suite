import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPreEtsInstructorBlockedStaffPath,
  staffNavSectionsForRole,
} from "./staff-nav";

function lastNavLabel(role: string) {
  const sections = staffNavSectionsForRole(role, false, false);
  const lastSection = sections[sections.length - 1];
  const lastItem = lastSection?.items[lastSection.items.length - 1];
  return lastItem?.label ?? null;
}

describe("feedback nav placement", () => {
  it("puts the feedback item at the bottom for every common staff role", () => {
    const label = "Report a problem or suggest a feature";
    for (const role of [
      "super_admin",
      "admin",
      "supervisor",
      "es",
      "transition_specialist",
      "counselor",
      "gvra_supervisor",
      "hr",
      "accountant",
      "hospitality_specialist",
      "instructor",
    ]) {
      assert.equal(lastNavLabel(role), label, `expected feedback last for ${role}`);
    }
  });

  it("allows Pre-ETS instructors to open feedback pages and APIs", () => {
    assert.equal(isPreEtsInstructorBlockedStaffPath("/dashboard/feedback"), false);
    assert.equal(isPreEtsInstructorBlockedStaffPath("/dashboard/feedback/manage"), false);
    assert.equal(isPreEtsInstructorBlockedStaffPath("/api/feedback"), false);
    assert.equal(isPreEtsInstructorBlockedStaffPath("/api/feedback/prepare-upload"), false);
  });
});
