import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessIjpBilling,
  canEditIjpBilling,
  canManageIjpBillingSettings,
  formatIjpListHours,
  GA_IJP_SERVICE_NAME,
  GA_IJP_SERVICE_NAME_VARIANTS,
  ijpHoursExpandMode,
  isIjpInvoiceLockedForLineEdits,
} from "./ijp-billing-settings";
import { isIndividualJobPlacementServiceName } from "./ijp-stages";

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

  it("does not lock draft, ready, or archived invoices for line edits today", () => {
    assert.equal(isIjpInvoiceLockedForLineEdits({ status: "draft" }), false);
    assert.equal(isIjpInvoiceLockedForLineEdits({ status: "ready", compiled_at: "2026-11-01" }), false);
    assert.equal(
      isIjpInvoiceLockedForLineEdits({ status: "archived", archived_at: "2026-11-02" }),
      false
    );
  });

  it("expands Hours as editable for editors and read-only otherwise", () => {
    assert.equal(ijpHoursExpandMode({ canEdit: true }), "edit");
    assert.equal(ijpHoursExpandMode({ canEdit: false }), "readonly");
    assert.equal(ijpHoursExpandMode({ canEdit: true, locked: true }), "readonly");
    assert.equal(ijpHoursExpandMode({ canEdit: false, locked: true }), "readonly");
  });

  it("formats list hour totals for whole and fractional values", () => {
    assert.equal(formatIjpListHours(4), "4");
    assert.equal(formatIjpListHours(3.1), "3.1");
    assert.equal(formatIjpListHours(null), "0");
  });
});

describe("IJP service name variants", () => {
  it("lists bare and (GA) as the same logical service", () => {
    assert.ok(GA_IJP_SERVICE_NAME_VARIANTS.includes("Individual Job Placement"));
    assert.ok(GA_IJP_SERVICE_NAME_VARIANTS.includes(GA_IJP_SERVICE_NAME));
    assert.ok(GA_IJP_SERVICE_NAME_VARIANTS.includes("IJP"));
    for (const name of GA_IJP_SERVICE_NAME_VARIANTS) {
      assert.equal(isIndividualJobPlacementServiceName(name), true);
    }
  });
});
