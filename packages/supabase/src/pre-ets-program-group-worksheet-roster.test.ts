import assert from "node:assert/strict";
import test from "node:test";
import { findParsedWorksheetGroupForProgramGroup } from "./pre-ets-program-group-worksheet-roster";
import type { ParsedWorksheetGroup } from "./pre-ets-worksheet-parser";

test("findParsedWorksheetGroupForProgramGroup matches Day at the Fair header without billing brackets", () => {
  const groups: ParsedWorksheetGroup[] = [
    {
      headerRaw: "APPLING COUNTY HIGH SCHOOL - FFA",
      schoolName: "APPLING COUNTY HIGH SCHOOL",
      groupName: "FFA",
      groupDesignation: "FFA",
      frequency: null,
      instructorName: null,
      classTime: null,
      serviceCode: null,
      serviceLabel: null,
      students: [
        {
          listOrder: 1,
          studentName: "A",
          participantId: "10001",
          authNumber: "",
          service: "",
          serviceCode: "",
          units: 1,
          classTime: "",
          invoiceNumber: "",
          billed: "",
          notApproved: false,
          authType: "pending",
          issues: [],
        },
      ],
    },
    {
      headerRaw: "APPLING COUNTY HIGH SCHOOL - DAY AT THE FAIR - FFA",
      schoolName: "APPLING COUNTY HIGH SCHOOL",
      groupName: "DAY AT THE FAIR - FFA",
      groupDesignation: "DAY AT THE FAIR - FFA",
      frequency: null,
      instructorName: null,
      classTime: null,
      serviceCode: null,
      serviceLabel: null,
      students: [
        {
          listOrder: 1,
          studentName: "B",
          participantId: "20001",
          authNumber: "",
          service: "",
          serviceCode: "",
          units: 1,
          classTime: "",
          invoiceNumber: "",
          billed: "",
          notApproved: false,
          authType: "pending",
          issues: [],
        },
      ],
    },
  ];

  const fair = findParsedWorksheetGroupForProgramGroup(groups, {
    headerRaw: "APPLING COUNTY HIGH SCHOOL - DAY AT THE FAIR - FFA [10, 8740]",
    headerKey: "appling county high school - day at the fair - ffa",
  });
  assert.ok(fair);
  assert.equal(fair?.students.length, 1);
  assert.equal(fair?.students[0]?.participantId, "20001");
});
