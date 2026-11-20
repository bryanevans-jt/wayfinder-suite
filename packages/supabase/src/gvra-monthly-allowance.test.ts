import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assigneeIsEligibleForGvraAllowance } from "./gvra-monthly-allowance";

describe("assigneeIsEligibleForGvraAllowance", () => {
  it("allows staff roles that receive caseload / payroll credit", () => {
    for (const role of [
      "es",
      "transition_specialist",
      "supervisor",
      "admin",
      "super_admin",
      "accountant",
    ]) {
      assert.equal(assigneeIsEligibleForGvraAllowance(role), true, role);
    }
  });

  it("skips client and other non-staff assignees so grants are not miscredited", () => {
    assert.equal(assigneeIsEligibleForGvraAllowance("client"), false);
    assert.equal(assigneeIsEligibleForGvraAllowance("support"), false);
    assert.equal(assigneeIsEligibleForGvraAllowance(null), false);
    assert.equal(assigneeIsEligibleForGvraAllowance(undefined), false);
    assert.equal(assigneeIsEligibleForGvraAllowance(""), false);
  });
});
