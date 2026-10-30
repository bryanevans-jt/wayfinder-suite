import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyWorksheetTabDistrictHints,
  isWorksheetNotApprovedAuthCell,
  looksLikeWorksheetGroupHeaderLine,
  parseDistrictWorksheet,
  parseGroupHeader,
  parseWorksheetSupervisorInstructorLine,
  qualifyWorksheetGroupHeaderWithSchoolContext,
  validateWorksheetHeaderColumns,
} from "./pre-ets-worksheet-parser";

describe("pre-ets-worksheet-parser", () => {
  it("treats N/A in A&I as not approved", () => {
    assert.ok(isWorksheetNotApprovedAuthCell("N/A"));
    assert.ok(isWorksheetNotApprovedAuthCell("n/a"));
    const csv = [
      "JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27",
      "DISTRICT 5 SCHOOLS",
      "OFFICE SCHOOLS",
      "PROJECT UNITED - INST - SELF CONTAINED",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS",
      "1,Approved One,11111,12345,PRE,PRE-1,1",
      "2,Not Approved,22222,N/A,PRE,PRE-1,1",
    ].join("\n");
    const parsed = parseDistrictWorksheet(csv);
    const group = parsed.offices[0]?.groups[0];
    assert.equal(group?.students.length, 1);
    assert.equal(group?.students[0]?.participantId, "11111");
  });

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

  it("parses two-line group header with supervisor and instructor row", () => {
    const parsedLine = parseWorksheetSupervisorInstructorLine(
      "VICTORIA BEIL / Instructor: IVETTE CORDERO"
    );
    assert.equal(parsedLine?.supervisorName, "VICTORIA BEIL");
    assert.equal(parsedLine?.instructorName, "IVETTE CORDERO");

    const shaw = parseGroupHeader("SHAW HIGH SCHOOL - INCLUSION -");
    assert.equal(shaw.schoolName, "SHAW HIGH SCHOOL");
    assert.equal(shaw.groupName, "INCLUSION");
    assert.equal(shaw.instructorName, null);

    const csv = [
      "JOSHUA TREE NOVEMBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "SHAW HIGH SCHOOL - INCLUSION -,,,,,,,,,,,,",
      "VICTORIA BEIL / Instructor: IVETTE CORDERO,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Test Student,12345,,PRE,PRE-1,1,,,",
      "NORTHGATE HIGH - SELF CONTAINED 2 -,,,,,,,,,,,,",
      "RACHEL SMITH / Instructor: EMERY FAIRCLOTH,,,,,,,,,,,,",
      "1,Second Student,67890,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.stats.groupCount, 2);
    assert.equal(parsed.stats.studentCount, 2);
    const shawGroup = parsed.offices[0]?.groups.find((g) => g.schoolName.includes("SHAW"));
    const northgate = parsed.offices[0]?.groups.find((g) => g.schoolName.includes("NORTHGATE"));
    assert.equal(shawGroup?.instructorName, "IVETTE CORDERO");
    assert.equal(shawGroup?.groupName, "INCLUSION");
    assert.equal(northgate?.instructorName, "EMERY FAIRCLOTH");
    assert.equal(northgate?.groupName, "SELF CONTAINED 2");
    assert.equal(northgate?.students[0]?.participantId, "67890");
  });

  it("parses district line without the word Schools", () => {
    const csv = [
      "JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27",
      "DISTRICT 4",
      "OFFICE SCHOOLS",
      "EXAMPLE HIGH - MONTHLY - INST",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS",
      "1,Test Student,12345,,PRE,PRE-1,1",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.districtNumber, "4");
  });

  it("warns when tab name and district row disagree", () => {
    const csv = [
      "JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27",
      "DISTRICT 3 SCHOOLS",
      "OFFICE SCHOOLS",
      "EXAMPLE HIGH - MONTHLY - INST",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS",
      "1,Test Student,12345,,PRE,PRE-1,1",
    ].join("\n");

    const hinted = applyWorksheetTabDistrictHints(parseDistrictWorksheet(csv), "D4");
    assert.equal(hinted.districtNumber, "3");
    assert.ok(
      hinted.issues.some((i) => i.includes("Tab \"D4\" suggests district 4 but row 2 is district 3"))
    );
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

  it("recognizes Showcase Transition as a standalone group header row", () => {
    assert.ok(
      looksLikeWorksheetGroupHeaderLine("Showcase Transition,,,", ["Showcase Transition"])
    );

    const csv = [
      "JOSHUA TREE NOVEMBER PRE-ETS BILLING 2026-27",
      "DISTRICT 5 SCHOOLS",
      "Columbus Office Schools",
      "Showcase Transition - INCLUSION -",
      "Supervisor / Instructor: Terri Dudley",
      "#,Student Name,PID #,A & I,Service,Code,Units",
      "1,Sample Student,99999,,PRE,PRE-1,1",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.offices[0]?.groups[0]?.schoolName, "Showcase Transition");
    assert.equal(parsed.offices[0]?.groups[0]?.students.length, 1);
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

    const valdostaGroup1 = parseGroupHeader("VALDOSTA HIGH SCHOOL - INCLUSION - GROUP 1");
    assert.equal(valdostaGroup1.groupName, "Inclusion Group 1");

    const valdostaThomas = parseGroupHeader("VALDOSTA HIGH SCHOOL - INCLUSION - THOMAS");
    assert.equal(valdostaThomas.groupName, "INCLUSION - THOMAS");

    const valdostaThomasParen = parseGroupHeader("VALDOSTA HIGH SCHOOL - THOMAS (INCLUSION)");
    assert.equal(valdostaThomasParen.instructorName, "THOMAS");
    assert.equal(valdostaThomasParen.groupName, "INCLUSION - THOMAS");

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

  it("recognizes Pike County as a standalone group header row", () => {
    assert.ok(
      looksLikeWorksheetGroupHeaderLine("Pike County,,,,,,,,,,,,", ["Pike County"])
    );

    const csv = [
      "JOSHUA TREE NOVEMBER PRE-ETS BILLING 2026-27",
      "DISTRICT 5 SCHOOLS",
      "COLUMBUS OFFICE SCHOOLS",
      "Pike County",
      "VICTORIA BEIL / Instructor: EMERY FAIRCLOTH",
      "#,STUDENT NAME,PID #,A & I,Service,Code,Units,Class Time,Invoice #,Billed",
      "1,Only Pike,33333,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.stats.groupCount, 1);
    assert.equal(parsed.offices[0]?.groups[0]?.schoolName, "Pike County");
    assert.equal(parsed.offices[0]?.groups[0]?.groupName, "Main");
    assert.equal(parsed.offices[0]?.groups[0]?.students[0]?.participantId, "33333");
  });

  it("starts Coffee County Wiregrass when Coffe is misspelled on the billing sheet", () => {
    assert.ok(
      looksLikeWorksheetGroupHeaderLine("Coffe County Wiregrass,,,,,,,,,,,,", [
        "Coffe County Wiregrass",
      ])
    );

    const csv = [
      "JOSHUA TREE NOVEMBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "PIKE COUNTY - INCLUSION -,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Pike Student,11111,,PRE,PRE-1,1,,,",
      "Coffe County Wiregrass,,,,,,,,,,,,",
      "1,Wiregrass Student,55555,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    const group = parsed.offices[0]?.groups.find((g) => /wiregrass/i.test(g.schoolName));
    assert.ok(group);
    assert.equal(group?.schoolName, "Coffe County Wiregrass");
    assert.equal(group?.students[0]?.participantId, "55555");
  });

  it("does not prefix Transitional Learning Center onto Lee County 9th Grade Center", () => {
    assert.equal(
      qualifyWorksheetGroupHeaderWithSchoolContext(
        "Transitional Learning Center",
        "Lee County 9th Grade Center"
      ),
      "Transitional Learning Center"
    );
  });

  it("does not treat Group 2 as an instructor name on the group header", () => {
    const header = parseGroupHeader("Dougherty County High School - Group 1 - Group 2");
    assert.equal(header.instructorName, null);
    assert.match(header.groupName, /group 1/i);
    assert.match(header.groupName, /group 2/i);

    const parsedLine = parseWorksheetSupervisorInstructorLine("/ Instructor: Group 2");
    assert.equal(parsedLine?.instructorName, null);
  });

  it("starts Group 2 when the instructor line carries a group designation", () => {
    const csv = [
      "JOSHUA TREE NOVEMBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "Dougherty County High School - Group 1,,,,,,,,,,,,",
      "/ Instructor: Group 2,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Group Two Student,33333,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.stats.groupCount, 2);
    const group1 = parsed.offices[0]?.groups.find((g) => /group 1/i.test(g.groupName));
    const group2 = parsed.offices[0]?.groups.find((g) => /group 2/i.test(g.groupName));
    assert.ok(group1);
    assert.ok(group2);
    assert.equal(group1?.instructorName, null);
    assert.equal(group1?.students.length, 0);
    assert.equal(group2?.students[0]?.participantId, "33333");
  });

  it("allows a blank instructor on the supervisor or instructor row", () => {
    assert.equal(
      parseWorksheetSupervisorInstructorLine("Gracie Williams / Instructor:")?.instructorName,
      null
    );
    assert.equal(parseWorksheetSupervisorInstructorLine("Instructor:")?.instructorName, null);

    const csv = [
      "JOSHUA TREE NOVEMBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "Dougherty County High School - Group 1,,,,,,,,,,,,",
      "Gracie Williams / Instructor:,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Dougherty Student,44444,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    const group = parsed.offices[0]?.groups[0];
    assert.equal(group?.instructorName, null);
    assert.equal(group?.students[0]?.participantId, "44444");
  });

  it("removes TLC student PIDs duplicated on Lee County 9th Grade Inclusion", () => {
    const csv = [
      "JOSHUA TREE NOVEMBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "Lee County 9th Grade Center - INCLUSION -,,,,,,,,,,,,",
      "Gracie Williams / Instructor: Example,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Lee Inclusion Student,11111,,PRE,PRE-1,1,,,",
      "2,TLC Student,22222,,PRE,PRE-1,1,,,",
      "Transitional Learning Center,,,,,,,,,,,,",
      "1,TLC Student,22222,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    const lee = parsed.offices[0]?.groups.find(
      (g) => /9th/i.test(g.schoolName) && /inclusion/i.test(String(g.groupName))
    );
    const tlc = parsed.offices[0]?.groups.find((g) =>
      /transitional/i.test(g.schoolName)
    );
    assert.ok(lee && tlc);
    assert.deepEqual(
      lee.students.map((s) => s.participantId),
      ["11111"]
    );
    assert.deepEqual(
      tlc.students.map((s) => s.participantId),
      ["22222"]
    );
  });

  it("keeps Lee County 9th Grade Inclusion and Transitional Learning Center as separate rosters", () => {
    const csv = [
      "JOSHUA TREE NOVEMBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "Lee County 9th Grade Center - INCLUSION -,,,,,,,,,,,,",
      "Gracie Williams / Instructor: Example,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Lee Inclusion Student,11111,,PRE,PRE-1,1,,,",
      "Transitional Learning Center,,,,,,,,,,,,",
      "1,TLC Student,22222,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.stats.groupCount, 2);
    const lee = parsed.offices[0]?.groups.find(
      (g) => /9th/i.test(g.schoolName) && /inclusion/i.test(String(g.groupName))
    );
    const tlc = parsed.offices[0]?.groups.find((g) =>
      /transitional/i.test(g.schoolName)
    );
    assert.ok(lee, "expected Lee County 9th Grade Inclusion group");
    assert.ok(tlc, "expected Transitional Learning Center group");
    assert.equal(lee?.students.length, 1);
    assert.equal(lee?.students[0]?.participantId, "11111");
    assert.equal(tlc?.students.length, 1);
    assert.equal(tlc?.students[0]?.participantId, "22222");
  });

  it("starts Thomas County Central without High School on the billing row", () => {
    assert.ok(
      looksLikeWorksheetGroupHeaderLine("Thomas County Central,,,,,,,,,,,,", [
        "Thomas County Central",
      ])
    );

    const csv = [
      "JOSHUA TREE NOVEMBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "PIKE COUNTY - INCLUSION -,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Pike Student,11111,,PRE,PRE-1,1,,,",
      "Thomas County Central,,,,,,,,,,,,",
      "1,Thomas Student,66666,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    const group = parsed.offices[0]?.groups.find((g) => /thomas/i.test(g.schoolName));
    assert.ok(group);
    assert.equal(group?.students[0]?.participantId, "66666");
  });

  it("starts Harrell Learning Center after another school without repeating column headers", () => {
    assert.ok(
      looksLikeWorksheetGroupHeaderLine("Harrell Learning Center,,,,,,,,,,,,", [
        "Harrell Learning Center",
      ])
    );

    const csv = [
      "JOSHUA TREE NOVEMBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "PIKE COUNTY - INCLUSION -,,,,,,,,,,,,",
      "VICTORIA BEIL / Instructor: EMERY FAIRCLOTH,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Pike Student,11111,,PRE,PRE-1,1,,,",
      "Harrell Learning Center,,,,,,,,,,,,",
      "VICTORIA BEIL / Instructor: JANE DOE,,,,,,,,,,,,",
      "1,Harrell Student,44444,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.stats.groupCount, 2);
    const harrell = parsed.offices[0]?.groups.find((g) => /harrell/i.test(g.schoolName));
    assert.ok(harrell);
    assert.equal(harrell?.students[0]?.participantId, "44444");
  });

  it("starts Heard County after Pike County without repeating column headers (D5-style)", () => {
    const csv = [
      "JOSHUA TREE NOVEMBER PRE-ETS BILLING 2026-27,,,,,,,,,,,",
      "DISTRICT 5 SCHOOLS,,,,,,,,,,,,",
      "COLUMBUS OFFICE SCHOOLS,,,,,,,,,,,,",
      "PIKE COUNTY - INCLUSION -,,,,,,,,,,,,",
      "VICTORIA BEIL / Instructor: EMERY FAIRCLOTH,,,,,,,,,,,,",
      "#,STUDENT NAME,PID #,A&I,SERVICE,CODE,UNITS,Class Time,Invoice #,Billed",
      "1,Pike Student,11111,,PRE,PRE-1,1,,,",
      "HEARD COUNTY,,,,,,,,,,,,",
      "VICTORIA BEIL / Instructor: EMERY FAIRCLOTH,,,,,,,,,,,,",
      "1,Heard Student,22222,,PRE,PRE-1,1,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    assert.equal(parsed.stats.groupCount, 2);
    const pike = parsed.offices[0]?.groups.find((g) => /pike/i.test(g.schoolName));
    const heard = parsed.offices[0]?.groups.find((g) => /heard/i.test(g.schoolName));
    assert.ok(pike);
    assert.ok(heard);
    assert.equal(pike?.students[0]?.participantId, "11111");
    assert.equal(heard?.students[0]?.participantId, "22222");
    assert.equal(heard?.schoolName, "HEARD COUNTY");
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

  it("parses Ware County Main and Transportation Exploration as separate groups", () => {
    const transport = parseGroupHeader("WARE COUNTY HIGH SCHOOL - TRANSPORTATION EXPLORATION -");
    assert.equal(transport.schoolName, "WARE COUNTY HIGH SCHOOL");
    assert.equal(transport.groupName, "TRANSPORTATION EXPLORATION");
    assert.equal(transport.instructorName, null);

    const main = parseGroupHeader("WARE COUNTY HIGH SCHOOL - MAIN -");
    assert.equal(main.groupName, "Main");

    const csv = [
      "Joshua Tree November Pre-ETS Billing 2026-27",
      "District 5 Schools",
      "Statesboro Office Schools",
      "WARE COUNTY HIGH SCHOOL - MAIN -",
      "Supervisor / Instructor: Kenya Clark",
      "#,Student Name,PID #,A & I,Service,Code,Units",
      "1,Shared Student,55555,,PRE,PRE-1,1",
      "2,Main Only,11111,,PRE,PRE-1,1",
      "WARE COUNTY HIGH SCHOOL - TRANSPORTATION EXPLORATION -",
      "Supervisor / Instructor: Kenya Clark",
      "1,Shared Student,55555,,PRE,PRE-1,1",
      "2,Transport Only,22222,,PRE,PRE-1,1",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    const ware = parsed.offices[0]?.groups.filter((g) =>
      g.schoolName.toUpperCase().includes("WARE")
    );
    assert.equal(ware?.length, 2);
    const mainGroup = ware?.find((g) => /^main$/i.test(g.groupName));
    const transportGroup = ware?.find((g) =>
      /transportation exploration/i.test(g.groupName)
    );
    assert.ok(mainGroup);
    assert.ok(transportGroup);
    assert.deepEqual(mainGroup?.students.map((s) => s.participantId).sort(), ["11111", "55555"]);
    assert.deepEqual(transportGroup?.students.map((s) => s.participantId).sort(), [
      "22222",
      "55555",
    ]);
  });

  it("splits Appling FFA and Day at the Fair with FFA ID columns and billing brackets", () => {
    const csv = [
      "Joshua Tree October Pre-ETS Billing 2026-27,,,,,,,,,,,",
      "District 6 Schools,,,,,,,,,,,,",
      "VIDALIA OFFICE SCHOOLS,,,,,,,,,,,,",
      "APPLING COUNTY HIGH SCHOOL - FFA [22, 10738],,,,,,,,,,,,",
      "STUDENT NAME,FFA ID,DOB,ID #,CATEGORY,GENDER,RACE,ETHNICITY,MAILING 1,MAILING 2",
      "1,Adams Destiney,10001,,,,,,,",
      "2,Beasley Emily,10002,,,,,,,",
      "APPLING COUNTY HIGH SCHOOL - DAY AT THE FAIR - FFA [10, 8740],,,,,,,,,,,,",
      "STUDENT NAME,FFA ID,DOB,ID #,CATEGORY,GENDER,RACE,ETHNICITY,MAILING 1,MAILING 2",
      "1,Barnes Taylor,20001,,,,,,,",
      "2,Courson Kylie,20002,,,,,,,",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    const appling = parsed.offices[0]?.groups.filter((g) =>
      g.schoolName.toUpperCase().includes("APPLING")
    );
    assert.equal(appling?.length, 2);

    const ffa = appling?.find(
      (g) => /^\s*ffa\s*$/i.test(g.groupName) && !/day at the fair/i.test(g.headerRaw)
    );
    const fair = appling?.find((g) => /day at the fair/i.test(g.headerRaw));
    assert.ok(ffa);
    assert.ok(fair);
    assert.equal(ffa?.students.length, 2);
    assert.equal(fair?.students.length, 2);
    assert.deepEqual(ffa?.students.map((s) => s.participantId), ["10001", "10002"]);
    assert.deepEqual(fair?.students.map((s) => s.participantId), ["20001", "20002"]);
  });

  it("keeps students with authorization but no PID using a placeholder", () => {
    const csv = [
      "Joshua Tree November Pre-ETS Billing 2026-27",
      "District 5 Schools",
      "Columbus Office Schools",
      "EMANUEL COUNTY INSTITUTE - INCLUSION -",
      "Supervisor / Instructor: Jane Instructor",
      "#,Student Name,PID #,A & I,Service,Code,Units",
      "1,Student With Auth,,12345678,PRE,PRE-1,1",
    ].join("\n");

    const parsed = parseDistrictWorksheet(csv);
    const group = parsed.offices[0]?.groups[0];
    assert.ok(group);
    assert.equal(group?.schoolName, "EMANUEL COUNTY INSTITUTE");
    assert.equal(group?.students.length, 1);
    assert.ok(group?.students[0]?.participantId.startsWith("PENDING-PID-"));
    assert.ok(
      parsed.issues.some((i) => i.includes("add PID in Edit roster") && i.includes("Student With Auth"))
    );
  });

  it("recognizes Emanuel County Institute as a standalone header row", () => {
    assert.ok(
      looksLikeWorksheetGroupHeaderLine("Emanuel County Institute,,,", ["Emanuel County Institute"])
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
    assert.equal(parsed.stats.studentCount, 2);
    assert.ok(
      parsed.issues.some(
        (i) => i.includes("add PID in Edit roster") && i.includes("Jane Doe")
      )
    );
  });
});
