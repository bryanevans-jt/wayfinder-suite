import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessIjpBilling,
  canEditIjpBilling,
  canManageIjpBillingSettings,
} from "./ijp-billing-settings";

describe("IJP Billing role gates", () => {
  it("allows Accounts Specialist (accountant), Admin, and Super Admin to access and edit", () => {
    for (const role of ["accountant", "admin", "super_admin", "Accountant", " Admin "]) {
      assert.equal(canAccessIjpBilling(role), true, `access ${role}`);
      assert.equal(canEditIjpBilling(role), true, `edit ${role}`);
    }
  });

  it("denies other staff roles access and edit", () => {
    for (const role of [
      "es",
      "transition_specialist",
      "supervisor",
      "hr",
      "hospitality_specialist",
      "counselor",
      "gvra_supervisor",
      "wrt_admin",
      "instructor",
      "client",
      "support",
      "",
      null,
      undefined,
    ]) {
      assert.equal(canAccessIjpBilling(role), false, `access ${String(role)}`);
      assert.equal(canEditIjpBilling(role), false, `edit ${String(role)}`);
    }
  });

  it("keeps settings management Super Admin only", () => {
    assert.equal(canManageIjpBillingSettings("super_admin"), true);
    assert.equal(canManageIjpBillingSettings("admin"), false);
    assert.equal(canManageIjpBillingSettings("accountant"), false);
    assert.equal(canManageIjpBillingSettings("hr"), false);
  });

  it("keeps access and edit aligned (no view-only IJP Billing role)", () => {
    const roles = [
      "accountant",
      "admin",
      "super_admin",
      "es",
      "hr",
      "supervisor",
      null,
    ];
    for (const role of roles) {
      assert.equal(canAccessIjpBilling(role), canEditIjpBilling(role));
    }
  });
});
