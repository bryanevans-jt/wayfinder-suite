import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDistrictWorksheet,
  validateWorksheetHeaderColumns,
} from "./pre-ets-worksheet-parser";

describe("pre-ets-worksheet-parser", () => {
  it("flags missing required columns on header row", () => {
    const issues = validateWorksheetHeaderColumns(["Student Name", "Units"], 12);
    assert.ok(issues.some((i) => i.includes('missing required column "PID #')));
  });

  it("skips student rows without PID", () => {
    const csv = [
      "Joshua Tree Service Group March Pre-ETS Worksheet 2025-2026",
      "District 5 Schools",
      "Office - School",
      "Test High - WEEKLY - Instructor",
      "#,Student Name,PID #,A & I,Service,Code,Units,Class Time,Invoice #,Billed",
      "1,Jane Doe,,12345,PRE,PRE-1,1,,,",
      "2,John Smith,PID99,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.stats.studentCount, 1);
    assert.ok(parsed.stats.skippedMissingPidCount >= 1);
    assert.ok(parsed.issues.some((i) => i.includes("missing PID")));
  });
});
