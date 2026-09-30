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

  it("parses October billing title and district line", () => {
    const csv = [
      "JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "SHAW HIGH SCHOOL - IVETTE CORDERO - INCLUSION ,,,,,,,,,,,,",
      "SUPERVISOR: VICTORIA BEIL ,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Test Student,12345,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.districtNumber, "5");
    assert.equal(parsed.monthLabel, "OCTOBER");
    assert.equal(parsed.schoolYear, "2026-2027");
    assert.equal(parsed.serviceMonth, "2026-10-01");
    assert.equal(parsed.stats.studentCount, 1);
    assert.equal(parsed.offices[0]?.groups[0]?.schoolName, "SHAW HIGH SCHOOL");
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
