import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRendezvousAppUrl } from "@wayfinder/branding";
import { staffNavSectionsForRole } from "./staff-nav";

function ourTeamHrefs(role: string): string[] {
  const sections = staffNavSectionsForRole(role, false, false);
  const ourTeam = sections.find((s) => s.label === "Our Team");
  return (ourTeam?.items ?? []).map((i) => i.href);
}

describe("Our Team → Rendezvous nav", () => {
  const rendezvousHref = buildRendezvousAppUrl("/calendar");

  it("shows Rendezvous for supervisors, admins, and super_admins", () => {
    for (const role of ["supervisor", "admin", "super_admin"] as const) {
      const hrefs = ourTeamHrefs(role);
      assert.ok(
        hrefs.includes(rendezvousHref),
        `${role} should see Rendezvous under Our Team`
      );
    }
  });

  it("hides Rendezvous from ES and Transition Specialists", () => {
    for (const role of ["es", "transition_specialist"] as const) {
      const hrefs = ourTeamHrefs(role);
      assert.ok(
        !hrefs.includes(rendezvousHref),
        `${role} should not see Rendezvous under Our Team`
      );
      assert.ok(hrefs.includes("/dashboard/team"), `${role} still has Our Team`);
    }
  });
});
