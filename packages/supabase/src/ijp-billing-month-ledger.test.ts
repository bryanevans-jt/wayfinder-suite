import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { preferAttestationServiceMonth } from "./ijp-billing-month-ledger";

describe("preferAttestationServiceMonth", () => {
  it("defaults to prior month while its grace window is open", () => {
    const month = preferAttestationServiceMonth({
      nowYmd: "2026-11-10",
      currentMonthStart: "2026-11-01",
      priorMonthStart: "2026-10-01",
      priorWindowOpen: true,
      currentWindowOpen: true,
      onIjpInPrior: true,
      onIjpInCurrent: true,
    });
    assert.equal(month, "2026-10-01");
  });

  it("uses current month when prior window is closed", () => {
    const month = preferAttestationServiceMonth({
      nowYmd: "2026-11-20",
      currentMonthStart: "2026-11-01",
      priorMonthStart: "2026-10-01",
      priorWindowOpen: false,
      currentWindowOpen: true,
      onIjpInPrior: true,
      onIjpInCurrent: true,
    });
    assert.equal(month, "2026-11-01");
  });

  it("falls back to prior when only prior is on IJP", () => {
    const month = preferAttestationServiceMonth({
      nowYmd: "2026-11-10",
      currentMonthStart: "2026-11-01",
      priorMonthStart: "2026-10-01",
      priorWindowOpen: true,
      currentWindowOpen: true,
      onIjpInPrior: true,
      onIjpInCurrent: false,
    });
    assert.equal(month, "2026-10-01");
  });

  it("returns null when client is on neither month", () => {
    const month = preferAttestationServiceMonth({
      nowYmd: "2026-11-10",
      currentMonthStart: "2026-11-01",
      priorMonthStart: "2026-10-01",
      priorWindowOpen: true,
      currentWindowOpen: true,
      onIjpInPrior: false,
      onIjpInCurrent: false,
    });
    assert.equal(month, null);
  });
});
