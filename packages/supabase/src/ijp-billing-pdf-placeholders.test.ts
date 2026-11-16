import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IJP_PDF_EMPTY_HEADER_SPACES,
  ijpPdfHeaderField,
  withIjpPdfEmptyHeaderSpaces,
} from "./ijp-billing-pdf-placeholders";

describe("ijpPdfHeaderField", () => {
  it("keeps non-empty values and maps empty/whitespace to seven spaces", () => {
    assert.equal(ijpPdfHeaderField("INV-1"), "INV-1");
    assert.equal(ijpPdfHeaderField(""), IJP_PDF_EMPTY_HEADER_SPACES);
    assert.equal(ijpPdfHeaderField("   "), IJP_PDF_EMPTY_HEADER_SPACES);
    assert.equal(ijpPdfHeaderField(null), IJP_PDF_EMPTY_HEADER_SPACES);
    assert.equal(IJP_PDF_EMPTY_HEADER_SPACES.length, 7);
  });
});

describe("withIjpPdfEmptyHeaderSpaces", () => {
  it("rewrites blank header placeholders only", () => {
    const mapped = withIjpPdfEmptyHeaderSpaces({
      ProviderInvoiceNumber: "",
      ClientName: "Ada",
      AuthorizationNumber: "  ",
    });
    assert.equal(mapped.ProviderInvoiceNumber, IJP_PDF_EMPTY_HEADER_SPACES);
    assert.equal(mapped.ClientName, "Ada");
    assert.equal(mapped.AuthorizationNumber, IJP_PDF_EMPTY_HEADER_SPACES);
  });
});
