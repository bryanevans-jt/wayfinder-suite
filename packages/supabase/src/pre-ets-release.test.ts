import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatPreEtsAuthNumberForPdf,
  isOnOrAfterPreEtsFieldReleaseCutoff,
  isPreEtsAuthorizationReleasedToField,
  isPreEtsServiceMonthBlockedForField,
  nextPreEtsServiceMonthFromDate,
  PRE_ETS_AUTH_NUMBER_PLACEHOLDER,
} from "./pre-ets-release";

describe("pre-ets-release", () => {
  it("releases when field_released_at is set even without auth number", () => {
    assert.equal(
      isPreEtsAuthorizationReleasedToField({
        auth_number: null,
        auth_type: "pending",
        field_released_at: "2026-11-20T12:00:00.000Z",
      }),
      true
    );
  });

  it("keeps legacy finalized-auth release when field_released_at missing", () => {
    assert.equal(
      isPreEtsAuthorizationReleasedToField({
        auth_number: "12345",
        auth_type: "group",
        field_released_at: null,
      }),
      true
    );
    assert.equal(
      isPreEtsAuthorizationReleasedToField({
        auth_number: null,
        auth_type: "pending",
        field_released_at: null,
      }),
      false
    );
  });

  it("treats month as blocked only while unblocked_at is null", () => {
    assert.equal(isPreEtsServiceMonthBlockedForField({ unblocked_at: null }), true);
    assert.equal(
      isPreEtsServiceMonthBlockedForField({ unblocked_at: "2026-11-21T00:00:00.000Z" }),
      false
    );
    assert.equal(isPreEtsServiceMonthBlockedForField(null), false);
  });

  it("maps Nov 20 to December service month", () => {
    assert.equal(
      nextPreEtsServiceMonthFromDate(new Date("2026-11-20T15:00:00.000Z")),
      "2026-12-01"
    );
    assert.equal(
      nextPreEtsServiceMonthFromDate(new Date("2026-12-20T15:00:00.000Z")),
      "2027-01-01"
    );
  });

  it("uses a 20-space auth placeholder on PDFs", () => {
    assert.equal(PRE_ETS_AUTH_NUMBER_PLACEHOLDER.length, 20);
    assert.equal(PRE_ETS_AUTH_NUMBER_PLACEHOLDER.trim(), "");
    assert.equal(formatPreEtsAuthNumberForPdf(null), PRE_ETS_AUTH_NUMBER_PLACEHOLDER);
    assert.equal(formatPreEtsAuthNumberForPdf(" 98765 "), "98765");
  });

  it("treats Eastern day 20 as on/after cutoff for next service month", () => {
    assert.equal(
      isOnOrAfterPreEtsFieldReleaseCutoff(
        "2026-12-01",
        new Date("2026-11-20T15:00:00.000Z")
      ),
      true
    );
    assert.equal(
      isOnOrAfterPreEtsFieldReleaseCutoff(
        "2026-12-01",
        new Date("2026-11-19T15:00:00.000Z")
      ),
      false
    );
  });
});
