import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNoDoubleBillingAcrossRuns,
  entryEligibleForIjpInvoiceBuild,
  filterEntriesForIjpInvoiceBuild,
  isEsTimeEntryIjpBilled,
  lateUnbilledEntryIds,
} from "./ijp-billing-entry-billing";
import {
  canEditIjpBilling,
  canGenerateIjpBilling,
  canUseIjpBillingTestTools,
} from "./ijp-billing-settings";

describe("IJP per-entry billing (no double-bill)", () => {
  it("excludes entries already billed on another invoice from a second run", () => {
    const invA = "inv-a";
    const invB = "inv-b";
    const entries = [
      { id: "e1", ijp_billed_invoice_id: invA },
      { id: "e2", ijp_billed_invoice_id: null },
      { id: "e3", ijp_billed_invoice_id: invA },
    ];
    const forB = filterEntriesForIjpInvoiceBuild(entries, invB);
    assert.deepEqual(
      forB.map((e) => e.id),
      ["e2"]
    );
    assert.equal(entryEligibleForIjpInvoiceBuild(entries[0], invB), false);
    assert.equal(entryEligibleForIjpInvoiceBuild(entries[0], invA), true);
  });

  it("keeps already-billed-on-this-invoice entries when refreshing the same draft", () => {
    const inv = "inv-1";
    const entries = [
      { id: "e1", ijp_billed_invoice_id: inv },
      { id: "e2", ijp_billed_invoice_id: null },
    ];
    assert.deepEqual(
      filterEntriesForIjpInvoiceBuild(entries, inv).map((e) => e.id),
      ["e1", "e2"]
    );
  });

  it("assertNoDoubleBillingAcrossRuns fails on overlap", () => {
    assert.deepEqual(
      assertNoDoubleBillingAcrossRuns({
        firstRunBilledEntryIds: ["a", "b"],
        secondRunCandidateEntryIds: ["c", "d"],
      }),
      { ok: true }
    );
    const bad = assertNoDoubleBillingAcrossRuns({
      firstRunBilledEntryIds: ["a", "b"],
      secondRunCandidateEntryIds: ["b", "c"],
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.deepEqual(bad.overlapping, ["b"]);
  });

  it("late-entered (never billed) hours remain eligible for the next run", () => {
    const entries = [
      { id: "billed", ijp_billed_invoice_id: "inv-1" },
      { id: "late", ijp_billed_invoice_id: null },
      { id: "also-late", ijp_billed_invoice_id: null },
    ];
    assert.deepEqual(lateUnbilledEntryIds(entries), ["late", "also-late"]);
    assert.equal(isEsTimeEntryIjpBilled(entries[0]), true);
    assert.equal(isEsTimeEntryIjpBilled(entries[1]), false);
  });
});

describe("IJP generate permissions (Accounts Specialist)", () => {
  it("allows accountant, admin, and super_admin to generate", () => {
    for (const role of ["accountant", "admin", "super_admin"]) {
      assert.equal(canGenerateIjpBilling(role), true, role);
      assert.equal(canEditIjpBilling(role), true, role);
    }
  });

  it("denies generate for other staff roles", () => {
    for (const role of ["es", "supervisor", "hr", "transition_specialist", "counselor"]) {
      assert.equal(canGenerateIjpBilling(role), false, role);
    }
  });

  it("keeps sandbox test tools admin/super_admin only", () => {
    assert.equal(canUseIjpBillingTestTools("accountant"), false);
    assert.equal(canUseIjpBillingTestTools("admin"), true);
    assert.equal(canUseIjpBillingTestTools("super_admin"), true);
    assert.equal(canUseIjpBillingTestTools("es"), false);
  });
});
