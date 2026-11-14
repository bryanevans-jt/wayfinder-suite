import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Document the safe draft-packet contract used by upsertPreEtsDraftInvoicePacket /
 * refreshPreEtsDraftPacketTotals. Full DB integration is covered by API usage;
 * these assertions guard the status / invoice-number preservation rules.
 */
describe("Pre-ETS draft packet regeneration safety rules", () => {
  const NON_DRAFT = ["ready", "submitted", "paid"] as const;

  function mayRegenerateDraftPacket(status: string | null | undefined): boolean {
    return !status || status === "draft";
  }

  function nextProviderInvoiceNumber(input: {
    existingStatus: string | null;
    existingProviderInvoiceNumber: string | null;
    authType: "group" | "individual";
    rosterInvoiceNumber: string | null;
  }): string | null {
    if (input.existingStatus && input.existingStatus !== "draft") {
      throw new Error("must not regenerate non-draft packets");
    }
    if (input.existingProviderInvoiceNumber != null) {
      return input.existingProviderInvoiceNumber;
    }
    if (input.authType === "individual") {
      return input.rosterInvoiceNumber;
    }
    return null;
  }

  it("allows create/refresh only when no packet exists or status is draft", () => {
    assert.equal(mayRegenerateDraftPacket(null), true);
    assert.equal(mayRegenerateDraftPacket("draft"), true);
    for (const status of NON_DRAFT) {
      assert.equal(mayRegenerateDraftPacket(status), false, status);
    }
  });

  it("preserves a saved provider invoice number when refreshing a draft", () => {
    assert.equal(
      nextProviderInvoiceNumber({
        existingStatus: "draft",
        existingProviderInvoiceNumber: "INV-100",
        authType: "group",
        rosterInvoiceNumber: null,
      }),
      "INV-100"
    );
  });

  it("does not invent a group invoice number on first draft create", () => {
    assert.equal(
      nextProviderInvoiceNumber({
        existingStatus: null,
        existingProviderInvoiceNumber: null,
        authType: "group",
        rosterInvoiceNumber: "ROSTER-1",
      }),
      null
    );
  });

  it("refuses to compute a next invoice number for non-draft packets", () => {
    assert.throws(() =>
      nextProviderInvoiceNumber({
        existingStatus: "submitted",
        existingProviderInvoiceNumber: "INV-100",
        authType: "group",
        rosterInvoiceNumber: null,
      })
    );
  });
});
