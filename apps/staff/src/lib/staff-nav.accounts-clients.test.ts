import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { staffNavSectionsForRole } from "./staff-nav";

describe("Accounts Specialist Clients nav", () => {
  it("includes Accounts → Clients for accountant", () => {
    const sections = staffNavSectionsForRole("accountant", false, false);
    const accounts = sections.find((s) => s.label === "Accounts");
    assert.ok(accounts, "Accounts section");
    const clients = accounts!.items.find((i) => i.href === "/dashboard/clients");
    assert.ok(clients, "Clients nav item");
    assert.equal(clients!.label, "Clients");
    assert.equal(clients!.match?.("/dashboard/clients/abc"), true);
  });

  it("does not put Clients under Accounts for ES caseload roles", () => {
    const sections = staffNavSectionsForRole("es", false, false);
    const accounts = sections.find((s) => s.label === "Accounts");
    assert.equal(accounts, undefined);
  });
});
