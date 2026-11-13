import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildIjpInvoiceHeaderPlaceholders,
  ceilIjpTotalHours,
  IJP_INVOICE_SERVICE_CODE,
  ijpLineServiceDescription,
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
  };
}

describe("ceilIjpTotalHours", () => {
  it("rounds fractional hours up to the next whole hour", () => {
    assert.equal(ceilIjpTotalHours(3.1), 4);
    assert.equal(ceilIjpTotalHours(0.1), 1);
    assert.equal(ceilIjpTotalHours(1.1), 2);
    assert.equal(ceilIjpTotalHours(2.9), 3);
    // Values are snapped to one decimal (line-hour precision) before ceil.
    assert.equal(ceilIjpTotalHours(1.01), 1);
    assert.equal(ceilIjpTotalHours(1.05), 2);
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

  it("snaps near-whole floating noise before ceiling", () => {
    // 1.1 + 1.1 + 0.8 can produce FP noise; one-decimal snap then ceil.
    assert.equal(ceilIjpTotalHours(2.999999999999), 3);
    assert.equal(ceilIjpTotalHours(3.0000000001), 3);
  });
});

describe("sumIjpLineItems hour ceiling", () => {
  it("ceils the summed line hours and preserves raw line hours", () => {
    const lines = [line({ hours: 1.5, entryId: "a" }), line({ hours: 1.6, entryId: "b" })];
    const totals = sumIjpLineItems(lines, 6000);
    assert.equal(totals.totalHours, 4); // 3.1 → 4
    assert.equal(lines[0].hours, 1.5);
    assert.equal(lines[1].hours, 1.6);
  });

  it("keeps a whole-hour sum unchanged", () => {
    const totals = sumIjpLineItems(
      [line({ hours: 1.5 }), line({ hours: 1.5 })],
      6000
    );
    assert.equal(totals.totalHours, 3);
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
    const totals = sumIjpLineItems([line({ hours: 3.1, amountCents: 18600 })], 6000);
    assert.equal(totals.totalHours, 4);
    assert.equal(totals.totalAmountCents, 24000); // 4 × $60
  });

  it("falls back to summing line amounts when rate is omitted", () => {
    const totals = sumIjpLineItems([
      line({ hours: 1.5, amountCents: 9000 }),
      line({ hours: 1.6, amountCents: 9600 }),
    ]);
    assert.equal(totals.totalHours, 4);
    assert.equal(totals.totalAmountCents, 18600);
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
