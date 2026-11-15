import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IJP_BILLING_MONTH_COMPILE_BATCH,
  IJP_BILLING_MONTH_MAX_DURATION_SEC,
  IJP_BILLING_MONTH_ROW_BATCH,
} from "@/lib/ijp-billing-month-run-constants";
import {
  formatIjpGenerateInvoicesSummary,
  isRowsDrainDone,
  mergeAttemptedSkipClientIds,
  remainingUnbilledForDrain,
  selectNextUnbilledDrainChunk,
  simulateUnbilledDrainRun,
} from "@/lib/ijp-billing-month-run-drain";

describe("IJP billing month run constants", () => {
  it("uses Vercel Pro-friendly maxDuration and batch sizes", () => {
    assert.equal(IJP_BILLING_MONTH_MAX_DURATION_SEC, 300);
    assert.ok(IJP_BILLING_MONTH_ROW_BATCH > 0);
    assert.ok(IJP_BILLING_MONTH_COMPILE_BATCH > 0);
    assert.ok(IJP_BILLING_MONTH_COMPILE_BATCH <= IJP_BILLING_MONTH_ROW_BATCH);
  });
});

describe("IJP billing rows drain (shrinking unbilled list)", () => {
  it("always takes the next chunk from the front (offset 0), never from a rising index", () => {
    const unbilled = Array.from({ length: 60 }, (_, i) => `c${String(i).padStart(2, "0")}`);
    const first = selectNextUnbilledDrainChunk(unbilled, [], 25);
    assert.equal(first.slice.length, 25);
    assert.deepEqual(first.slice[0], "c00");
    assert.deepEqual(first.slice[24], "c24");

    // After first 25 leave the unbilled queue, remaining are c25..c59 (35).
    const afterFirst = unbilled.slice(25);
    const second = selectNextUnbilledDrainChunk(afterFirst, first.slice, 25);
    // Old offset=25 bug would slice(25) on a 35-length list and skip c25..c49.
    assert.equal(second.slice.length, 25);
    assert.equal(second.slice[0], "c25");
    assert.equal(second.slice[24], "c49");
  });

  it("processes all 60+ clients with batch 25 when the list shrinks after each attempt", () => {
    const initial = Array.from({ length: 66 }, (_, i) => `client-${i}`);
    const run = simulateUnbilledDrainRun({
      initialUnbilledClientIds: initial,
      batchSize: 25,
    });
    assert.equal(run.done, true);
    assert.equal(run.hitChunkCap, false);
    assert.equal(run.processedOrder.length, 66);
    assert.deepEqual([...run.processedOrder].sort(), [...initial].sort());
    // 25 + 25 + 16 = 3 chunks
    assert.equal(run.chunks, 3);
  });

  it("skips stuck clients to avoid an infinite loop and still finishes", () => {
    const initial = Array.from({ length: 30 }, (_, i) => `client-${i}`);
    const stuck = new Set(["client-3", "client-17"]);
    const run = simulateUnbilledDrainRun({
      initialUnbilledClientIds: initial,
      batchSize: 10,
      stillUnbilledAfterAttempt: (id) => stuck.has(id),
      maxChunks: 20,
    });
    assert.equal(run.done, true);
    assert.equal(run.hitChunkCap, false);
    assert.deepEqual(run.stuckSkipped.sort(), ["client-17", "client-3"]);
    // Every client attempted once; stuck remain skipped via skipClientIds.
    assert.equal(run.processedOrder.length, 30);
    assert.ok(isRowsDrainDone([...stuck], run.skipClientIds));
  });

  it("merges skip ids without duplicates", () => {
    assert.deepEqual(
      mergeAttemptedSkipClientIds(["a", "b"], ["b", "c"]),
      ["a", "b", "c"]
    );
    assert.deepEqual(remainingUnbilledForDrain(["a", "b", "c"], ["b"]), ["a", "c"]);
  });
});

describe("IJP Generate Invoices UI summary", () => {
  it("surfaces compile errors and does not claim finished while completeness is incomplete", () => {
    const incomplete = formatIjpGenerateInvoicesSummary({
      created: 25,
      refreshed: 3,
      compiled: 0,
      compileErrors: 3,
      skippedLocked: 0,
      rowFailures: 0,
      incomplete: false,
      completenessStillMissing: true,
      missingCount: 35,
    });
    assert.equal(incomplete.tone, "error");
    assert.match(incomplete.text, /compile errors 3/);
    assert.match(incomplete.text, /failed 3/);
    assert.match(incomplete.text, /35/);
    assert.match(incomplete.text, /did not finish cleanly|Run Generate again/i);
    assert.doesNotMatch(incomplete.text, /^Generate Invoices finished \(/);
  });

  it("reports success only when completeness is clean and there are no failures", () => {
    const ok = formatIjpGenerateInvoicesSummary({
      created: 35,
      refreshed: 0,
      compiled: 35,
      compileErrors: 0,
      skippedLocked: 0,
      rowFailures: 0,
      incomplete: false,
      completenessStillMissing: false,
    });
    assert.equal(ok.tone, "success");
    assert.match(ok.text, /created 35/);
    assert.match(ok.text, /compiled 35/);
    assert.match(ok.text, /failed 0/);
  });
});
