import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDistrictWorksheet,
  parseGroupHeader,
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
    assert.equal(parsed.offices[0]?.groups[0]?.instructorName, "IVETTE CORDERO");
    assert.equal(parsed.offices[0]?.groups[0]?.groupName, "INCLUSION");
  });

  it("keeps instructor and program type in the correct fields", () => {
    const shaw = parseGroupHeader("SHAW HIGH SCHOOL - IVETTE CORDERO - INCLUSION");
    assert.equal(shaw.instructorName, "IVETTE CORDERO");
    assert.equal(shaw.groupName, "INCLUSION");

    const northgate = parseGroupHeader("NORTHGATE HIGH - EMERY FAIRCLOTH - INCLUSION - MOSELY");
    assert.equal(northgate.instructorName, "EMERY FAIRCLOTH");
    assert.equal(northgate.groupName, "INCLUSION - MOSELY");

    const kendrick = parseGroupHeader(
      "KENDRICK HIGH SCHOOL - WEEKLY - THURSDAYS - IVETTE CORDERO (Muscogee County)"
    );
    assert.equal(kendrick.instructorName, "IVETTE CORDERO (Muscogee County)");
    assert.equal(kendrick.groupName, "WEEKLY · THURSDAYS");
    assert.equal(kendrick.frequency, "WEEKLY");

    const wheeler = parseGroupHeader("WHEELER COUNTY HIGH SCHOOL - MONTHLY - TIFFANY POWELL");
    assert.equal(wheeler.schoolName, "WHEELER COUNTY HIGH SCHOOL");
    assert.equal(wheeler.instructorName, "TIFFANY POWELL");
    assert.equal(wheeler.groupName, "MONTHLY");

    const tattnall = parseGroupHeader(
      "TATTNALL COUNTY HIGH SCHOOL - BI-WEEKLY - FRIDAYS - TIFFANY POWELL"
    );
    assert.equal(tattnall.schoolName, "TATTNALL COUNTY HIGH SCHOOL");
    assert.equal(tattnall.instructorName, "TIFFANY POWELL");
    assert.equal(tattnall.frequency, "BIWEEKLY");
    assert.equal(tattnall.groupName, "BIWEEKLY · FRIDAYS");

    const tattnallEnDash = parseGroupHeader(
      "TATTNALL COUNTY HIGH SCHOOL – BI-WEEKLY – FRIDAYS – TIFFANY POWELL"
    );
    assert.equal(tattnallEnDash.schoolName, "TATTNALL COUNTY HIGH SCHOOL");
    assert.equal(tattnallEnDash.instructorName, "TIFFANY POWELL");
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
