import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IJP_BILLING_MONTH_COMPILE_BATCH,
  IJP_BILLING_MONTH_MAX_DURATION_SEC,
  IJP_BILLING_MONTH_ROW_BATCH,
} from "@/lib/ijp-billing-month-run-constants";

describe("IJP billing month run constants", () => {
  it("uses Vercel Pro-friendly maxDuration and batch sizes", () => {
    assert.equal(IJP_BILLING_MONTH_MAX_DURATION_SEC, 300);
    assert.ok(IJP_BILLING_MONTH_ROW_BATCH > 0);
    assert.ok(IJP_BILLING_MONTH_COMPILE_BATCH > 0);
    assert.ok(IJP_BILLING_MONTH_COMPILE_BATCH <= IJP_BILLING_MONTH_ROW_BATCH);
  });
});
