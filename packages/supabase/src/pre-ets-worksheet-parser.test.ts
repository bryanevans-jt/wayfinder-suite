import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  looksLikeWorksheetGroupHeaderLine,
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

  it("recognizes Scintilla Charter School group headers on D9-style sheets", () => {
    const header = "SCINTILLA CHARTER SCHOOL VALDOSTA - MADISON HEWETT - INCLUSION";
    assert.ok(looksLikeWorksheetGroupHeaderLine(`${header},,,,,,,,,,,,`, [header]));

    const csv = [
      "JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 9 SCHOOLS,,,,,,,,,,,,",
      "DOUGLAS OFFICE SCHOOLS,,,,,,,,,,,,",
      "ATKINSON COUNTY HIGH SCHOOL - MONTHLY - INST A,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Alice,11111,,PRE,PRE-1,1,,,",
      `${header},,,,,,,,,,,,`,
      "1,Bob,44444,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    const scintilla = parsed.offices[0]?.groups.find((g) =>
      /scintilla/i.test(g.schoolName)
    );
    assert.ok(scintilla);
    assert.equal(scintilla?.groupName, "INCLUSION");
    assert.equal(scintilla?.students[0]?.participantId, "44444");
  });

  it("recognizes Project United group headers without High School in the label", () => {
    const header = "PROJECT UNITED - MONTHLY - JANE DOE";
    assert.ok(looksLikeWorksheetGroupHeaderLine(`${header},,,,,,,,,,,,`, [header]));

    const csv = [
      "JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "PIKE COUNTY HIGH - MONTHLY - INST A,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Alice,11111,,PRE,PRE-1,1,,,",
      `${header},,,,,,,,,,,,`,
      "1,Bob,33333,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    const project = parsed.offices[0]?.groups.find((g) => /project united/i.test(g.schoolName));
    assert.ok(project, "expected Project United group");
    assert.equal(project?.students[0]?.participantId, "33333");
  });

  it("recognizes Upson Lee without High in the school segment", () => {
    const header = "UPSON LEE - EMERY FAIRCLOTH - INCLUSION";
    assert.ok(
      looksLikeWorksheetGroupHeaderLine(`${header},,,,,,,,,,,,`, [header])
    );
    const csv = [
      "JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "PIKE COUNTY HIGH - MONTHLY - EMERY FAIRCLOTH,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Alice,11111,,PRE,PRE-1,1,,,",
      `${header},,,,,,,,,,,,`,
      "1,Bob,22222,,PRE,PRE-1,1,,,",
    ].join("\n");
    const parsed = parseDistrictWorksheet(csv);
    const pike = parsed.offices[0]?.groups.find((g) => g.schoolName.includes("PIKE"));
    const upson = parsed.offices[0]?.groups.find((g) => /upson/i.test(g.schoolName));
    assert.equal(pike?.students.length, 1);
    assert.equal(pike?.students[0]?.participantId, "11111");
    assert.ok(upson);
    assert.equal(upson?.students[0]?.participantId, "22222");
  });

  it("recognizes Northgate High and Upson Lee High group headers without repeating column headers", () => {
    assert.ok(
      looksLikeWorksheetGroupHeaderLine(
        "NORTHGATE HIGH - INCLUSION - FEELY,,,,,,,,,,,,",
        ["NORTHGATE HIGH - INCLUSION - FEELY"]
      )
    );
    assert.ok(
      looksLikeWorksheetGroupHeaderLine(
        "UPSON LEE HIGH - MONTHLY - JANE DOE,,,,,,,,,,,,",
        ["UPSON LEE HIGH - MONTHLY - JANE DOE"]
      )
    );

    const feely = parseGroupHeader("NORTHGATE HIGH - INCLUSION - FEELY");
    assert.equal(feely.schoolName, "NORTHGATE HIGH");
    assert.equal(feely.groupName, "INCLUSION - FEELY");
    assert.equal(feely.instructorName, null);

    const selfContained = parseGroupHeader("NORTHGATE HIGH - SELF CONTAINED 2");
    assert.equal(selfContained.groupName, "SELF CONTAINED 2");

    const csv = [
      "JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "PIKE COUNTY HIGH - MONTHLY - INST A,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Alice,11111,,PRE,PRE-1,1,,,",
      "UPSON LEE HIGH - MONTHLY - INST B,,,,,,,,,,,,",
      "1,Bob,22222,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.stats.groupCount, 2);
    const upson = parsed.offices[0]?.groups.find((g) => g.schoolName.includes("UPSON"));
    assert.ok(upson);
    assert.equal(upson?.students[0]?.participantId, "22222");
  });

  it("recognizes a standalone school name line as a new group header (D9 Atkinson-style)", () => {
    const schoolOnly = "ATKINSON COUNTY HIGH SCHOOL,,,,,,,,,,,,,";
    assert.ok(looksLikeWorksheetGroupHeaderLine(schoolOnly, ["ATKINSON COUNTY HIGH SCHOOL"]));

    const csv = [
      "JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 9 SCHOOLS,,,,,,,,,,,,",
      "DOUGLAS OFFICE SCHOOLS,,,,,,,,,,,,",
      "FIRST HIGH SCHOOL - MONTHLY - INST A,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Alice,11111,,PRE,PRE-1,1,,,",
      "ATKINSON COUNTY HIGH SCHOOL,,,,,,,,,,,,",
      "1,Bob,22222,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.stats.groupCount, 2);
    const atkinson = parsed.offices[0]?.groups.find((g) =>
      g.schoolName.toUpperCase().includes("ATKINSON")
    );
    assert.ok(atkinson, "expected Atkinson group");
    assert.equal(atkinson?.students.length, 1);
    assert.equal(atkinson?.students[0]?.participantId, "22222");
  });

  it("starts a new school when column headers are not repeated (D8-style)", () => {
    const csv = [
      "JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 8 SCHOOLS,,,,,,,,,,,,",
      "STATESBORO OFFICE SCHOOLS,,,,,,,,,,,,",
      "FIRST HIGH SCHOOL - MONTHLY - INST A,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Alice,11111,,PRE,PRE-1,1,,,",
      "TATTNALL COUNTY HIGH SCHOOL - BI-WEEKLY - FRIDAYS - TIFFANY POWELL,,,,,,,,,,,,",
      "SUPERVISOR: Rachel,,,,,,,,,,,,",
      "1,Bob,22222,,PRE,PRE-1,1,,,",
      "2,Carol,NOT APPROVED,,PRE,PRE-1,1,,,",
      "3,Dave,33333,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.stats.groupCount, 2);
    const tattnall = parsed.offices[0]?.groups.find((g) =>
      g.schoolName.includes("TATTNALL")
    );
    assert.ok(tattnall);
    assert.deepEqual(
      tattnall?.students.map((s) => s.participantId),
      ["22222", "33333"]
    );
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
