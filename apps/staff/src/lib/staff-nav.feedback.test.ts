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

  it("allows Pre-ETS instructors My Profile, Our Team, and PTO paths", () => {
    for (const path of [
      "/dashboard/profile",
      "/dashboard/team",
      "/dashboard/team/anything",
      "/dashboard/core-four",
      "/dashboard/share-moments",
      "/dashboard/pto",
      "/api/profile",
      "/api/team-directory",
      "/api/team-moments",
      "/api/team-moments/share",
      "/api/staff-pto",
      "/api/staff-pto/requests",
    ]) {
      assert.equal(
        isPreEtsInstructorBlockedStaffPath(path),
        false,
        `expected instructor allowed for ${path}`
      );
    }
  });

  it("still blocks Pre-ETS instructors from unrelated staff tools", () => {
    for (const path of [
      "/dashboard/clients",
      "/dashboard/billable-hours",
      "/dashboard/admin",
      "/dashboard/hr",
      "/api/portal/users",
    ]) {
      assert.equal(
        isPreEtsInstructorBlockedStaffPath(path),
        true,
        `expected instructor blocked for ${path}`
      );
    }
  });

  it("includes My Profile, Our Team, and PTO in instructor nav", () => {
    const sections = staffNavSectionsForRole("instructor", false, true);
    const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
    assert.ok(hrefs.includes("/dashboard/profile"), "My Profile");
    assert.ok(hrefs.includes("/dashboard/team"), "Our Team / Team Directory");
    assert.ok(hrefs.includes("/dashboard/core-four"), "Core Four");
    assert.ok(hrefs.includes("/dashboard/share-moments"), "Share a Moment");
    assert.ok(hrefs.includes("/dashboard/pto"), "PTO");
    assert.ok(hrefs.includes("/dashboard/pre-ets"), "Pre-ETS");
  });
});
