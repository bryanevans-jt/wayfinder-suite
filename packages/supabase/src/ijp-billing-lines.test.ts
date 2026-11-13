import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIjpInvoiceHeaderPlaceholders,
  ceilIjpTotalHours,
  IJP_INVOICE_SERVICE_CODE,
  ijpLineServiceDescription,
  invoiceLinesAreManuallyAdjusted,
  isIjpInvoiceEligibleForDraftLineRefresh,
  markIjpLinesManuallyAdjusted,
  roundIjpLineHours,
  roundIjpLineHoursFromMinutes,
  sumIjpLineItems,
  type IjpInvoiceLineItem,
} from "./ijp-billing-lines";

function line(partial: Partial<IjpInvoiceLineItem> & { hours: number }): IjpInvoiceLineItem {
  return {
    entryId: partial.entryId ?? "e1",
    authorization: partial.authorization ?? "AUTH",
    serviceCode: partial.serviceCode ?? IJP_INVOICE_SERVICE_CODE,
    description: partial.description ?? "In-Person Meeting",
    serviceDate: partial.serviceDate ?? "2026-10-01",
    startTime: partial.startTime ?? "09:00",
    endTime: partial.endTime ?? "10:00",
    hours: partial.hours,
    amountCents: partial.amountCents ?? Math.round(partial.hours * 6000),
    instructorName: partial.instructorName ?? "ES",
    editable: partial.editable ?? true,
    manuallyAdjusted: partial.manuallyAdjusted,
  };
}

describe("roundIjpLineHoursFromMinutes (nearest half hour, round-half-up)", () => {
  it("rounds minutes to the nearest half hour", () => {
    assert.equal(roundIjpLineHoursFromMinutes(75), 1.5);
    assert.equal(roundIjpLineHoursFromMinutes(70), 1.0);
    assert.equal(roundIjpLineHoursFromMinutes(105), 2.0);
    assert.equal(roundIjpLineHoursFromMinutes(90), 1.5);
    assert.equal(roundIjpLineHoursFromMinutes(60), 1.0);
    assert.equal(roundIjpLineHoursFromMinutes(30), 0.5);
    assert.equal(roundIjpLineHoursFromMinutes(15), 0.5);
    assert.equal(roundIjpLineHoursFromMinutes(14), 0);
    // Exact midpoint between half hours rounds up (45 min → 1.0).
    assert.equal(roundIjpLineHoursFromMinutes(45), 1.0);
  });

  it("treats nullish, zero, and negatives as zero", () => {
    assert.equal(roundIjpLineHoursFromMinutes(0), 0);
    assert.equal(roundIjpLineHoursFromMinutes(null), 0);
    assert.equal(roundIjpLineHoursFromMinutes(undefined), 0);
    assert.equal(roundIjpLineHoursFromMinutes(-30), 0);
  });
});

describe("roundIjpLineHours (manual edit snap)", () => {
  it("snaps hour inputs to nearest half hour with round-half-up", () => {
    assert.equal(roundIjpLineHours(1.25), 1.5);
    assert.equal(roundIjpLineHours(1.24), 1.0);
    assert.equal(roundIjpLineHours(1.75), 2.0);
    assert.equal(roundIjpLineHours(1.5), 1.5);
    assert.equal(roundIjpLineHours(0.1), 0);
    assert.equal(roundIjpLineHours(0.25), 0.5);
  });
});

describe("manual adjustment markers", () => {
  it("detects and marks manually adjusted lines", () => {
    assert.equal(invoiceLinesAreManuallyAdjusted([line({ hours: 1 })]), false);
    assert.equal(
      invoiceLinesAreManuallyAdjusted([line({ hours: 1, manuallyAdjusted: true })]),
      true
    );
    const marked = markIjpLinesManuallyAdjusted([line({ hours: 1.2 })]);
    assert.equal(marked[0].hours, 1.0);
    assert.equal(marked[0].manuallyAdjusted, true);
  });

  it("skips draft auto-refresh when compiled, archived, non-draft, or manually adjusted", () => {
    assert.equal(isIjpInvoiceEligibleForDraftLineRefresh({ status: "draft" }), true);
    assert.equal(
      isIjpInvoiceEligibleForDraftLineRefresh({ status: "draft", compiled_at: "2026-11-01" }),
      false
    );
    assert.equal(
      isIjpInvoiceEligibleForDraftLineRefresh({ status: "draft", archived_at: "2026-11-01" }),
      false
    );
    assert.equal(isIjpInvoiceEligibleForDraftLineRefresh({ status: "ready" }), false);
    assert.equal(
      isIjpInvoiceEligibleForDraftLineRefresh({
        status: "draft",
        line_items: [line({ hours: 1, manuallyAdjusted: true })],
      }),
      false
    );
  });
});

describe("ceilIjpTotalHours", () => {
  it("rounds fractional hours up to the next whole hour", () => {
    assert.equal(ceilIjpTotalHours(3.5), 4);
    assert.equal(ceilIjpTotalHours(0.5), 1);
    assert.equal(ceilIjpTotalHours(1.5), 2);
    assert.equal(ceilIjpTotalHours(2.5), 3);
  });

  it("keeps exact whole hours unchanged", () => {
    assert.equal(ceilIjpTotalHours(0), 0);
    assert.equal(ceilIjpTotalHours(3), 3);
    assert.equal(ceilIjpTotalHours(3.0), 3);
    assert.equal(ceilIjpTotalHours(12), 12);
  });

  it("treats null, undefined, NaN, and negatives as zero", () => {
    assert.equal(ceilIjpTotalHours(null), 0);
    assert.equal(ceilIjpTotalHours(undefined), 0);
    assert.equal(ceilIjpTotalHours(Number.NaN), 0);
    assert.equal(ceilIjpTotalHours(-1), 0);
    assert.equal(ceilIjpTotalHours(-0.5), 0);
  });

  it("snaps near-half-hour floating noise before ceiling", () => {
    assert.equal(ceilIjpTotalHours(2.999999999999), 3);
    assert.equal(ceilIjpTotalHours(3.0000000001), 3);
  });
});

describe("sumIjpLineItems hour ceiling", () => {
  it("ceils the summed half-hour lines and preserves raw line hours", () => {
    const lines = [line({ hours: 1.5, entryId: "a" }), line({ hours: 1.5, entryId: "b" })];
    const totals = sumIjpLineItems(lines, 6000);
    assert.equal(totals.totalHours, 3);
    assert.equal(lines[0].hours, 1.5);
    assert.equal(lines[1].hours, 1.5);
  });

  it("ceils a fractional sum of half hours", () => {
    const totals = sumIjpLineItems(
      [line({ hours: 1.5 }), line({ hours: 1.0 }), line({ hours: 0.5 })],
      6000
    );
    assert.equal(totals.totalHours, 3); // 3.0 exact
    assert.equal(
      sumIjpLineItems([line({ hours: 1.5 }), line({ hours: 1.0 })], 6000).totalHours,
      3
    ); // 2.5 → 3
  });

  it("returns zero hours for empty, zero, and nullish line hours", () => {
    assert.equal(sumIjpLineItems([]).totalHours, 0);
    assert.equal(sumIjpLineItems([line({ hours: 0 })]).totalHours, 0);
    assert.equal(
      sumIjpLineItems([line({ hours: Number.NaN })]).totalHours,
      0
    );
  });

  it("bills total amount from ceiled hours when rate is provided", () => {
    const totals = sumIjpLineItems([line({ hours: 2.5, amountCents: 15000 })], 6000);
    assert.equal(totals.totalHours, 3);
    assert.equal(totals.totalAmountCents, 18000); // 3 × $60
  });

  it("falls back to summing line amounts when rate is omitted", () => {
    const totals = sumIjpLineItems([
      line({ hours: 1.5, amountCents: 9000 }),
      line({ hours: 1.0, amountCents: 6000 }),
    ]);
    assert.equal(totals.totalHours, 3); // 2.5 → 3
    assert.equal(totals.totalAmountCents, 15000);
  });
});

describe("buildIjpInvoiceHeaderPlaceholders TotalHours", () => {
  it("formats whole-hour totals without a trailing decimal", () => {
    const placeholders = buildIjpInvoiceHeaderPlaceholders({
      invoiceDate: "2026-11-01",
      providerName: "JT",
      remitAddress: "Addr",
      providerInvoiceNumber: "INV-1",
      authorizationNumber: "A-1",
      clientName: "Client",
      serviceMonth: "2026-10-01",
      serviceMonthLabel: "October 2026",
      hourlyRateCents: 6000,
      totalHours: 4,
      totalAmountCents: 24000,
      instructorFacilitatorSummary: "ES",
    });
    assert.equal(placeholders.TotalHours, "4");
    assert.equal(placeholders.TotalAmount, "240.00");
  });
});

describe("IJP line service code and description", () => {
  it("uses GVRA service code 00270 on every line", () => {
    assert.equal(IJP_INVOICE_SERVICE_CODE, "00270");
    assert.equal(line({ hours: 1 }).serviceCode, "00270");
  });

  it("keeps only the activity / contact-log type name", () => {
    assert.equal(ijpLineServiceDescription("In-Person Meeting"), "In-Person Meeting");
    assert.equal(ijpLineServiceDescription("  Job Canvassing  "), "Job Canvassing");
    assert.equal(ijpLineServiceDescription("Intake Meeting"), "Intake Meeting");
  });

  it("does not invent notes or fallback copy when the type is missing", () => {
    assert.equal(ijpLineServiceDescription(""), "");
    assert.equal(ijpLineServiceDescription(null), "");
    assert.equal(ijpLineServiceDescription(undefined), "");
    assert.equal(ijpLineServiceDescription("   "), "");
  });
});
