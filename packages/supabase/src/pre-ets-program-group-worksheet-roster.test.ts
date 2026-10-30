import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ParsedWorksheetGroup } from "./pre-ets-worksheet-parser";
import { collectParsedWorksheetGroupsForProgramGroup } from "./pre-ets-program-group-worksheet-roster";

describe("collectParsedWorksheetGroupsForProgramGroup", () => {
  it("unions students from duplicate instructor headers with the same group name", () => {
    const groups: ParsedWorksheetGroup[] = [
      {
        headerRaw: "PROJECT UNITED - INST A - SELF CONTAINED",
        schoolName: "Project United",
        groupName: "SELF CONTAINED",
        groupDesignation: "SELF CONTAINED",
        frequency: null,
        instructorName: "INST A",
        classTime: null,
        serviceCode: null,
        serviceLabel: null,
        students: [
          {
            rowNumber: 1,
            listOrder: 1,
            studentName: "One",
            participantId: "111",
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
          {
            rowNumber: 2,
            listOrder: 2,
            studentName: "Two",
            participantId: "222",
            authNumber: "",
            service: "",
            serviceCode: "",
            units: 1,
            classTime: "",
            invoiceNumber: "",
            billed: "",
            notApproved: true,
            authType: "skipped",
            issues: [],
          },
        ],
      },
      {
        headerRaw: "PROJECT UNITED - INST B - SELF CONTAINED",
        schoolName: "Project United",
        groupName: "SELF CONTAINED",
        groupDesignation: "SELF CONTAINED",
        frequency: null,
        instructorName: "INST B",
        classTime: null,
        serviceCode: null,
        serviceLabel: null,
        students: [
          {
            rowNumber: 3,
            listOrder: 1,
            studentName: "Three",
            participantId: "333",
            authNumber: "12345",
            service: "",
            serviceCode: "",
            units: 1,
            classTime: "",
            invoiceNumber: "",
            billed: "",
            notApproved: false,
            authType: "group",
            issues: [],
          },
        ],
      },
    ];

    const matched = collectParsedWorksheetGroupsForProgramGroup(groups, {
      headerRaw: "PROJECT UNITED - INST B - SELF CONTAINED",
      headerKey: "project united inst b self contained",
      groupName: "SELF CONTAINED",
      schoolName: "Project United",
    });

    assert.equal(matched.length, 2);
    const pids = new Set<string>();
    for (const g of matched) {
      for (const s of g.students) {
        if (!s.notApproved && s.participantId.trim()) pids.add(s.participantId);
      }
    }
    assert.deepEqual([...pids].sort(), ["111", "333"]);
  });

  it("does not union Dougherty Group 1 spreadsheet rows into Group 2 allowlists", () => {
    const groups: ParsedWorksheetGroup[] = [
      {
        headerRaw: "DOUGHERTY COUNTY HIGH SCHOOL - GROUP 1 -",
        schoolName: "DOUGHERTY COUNTY HIGH SCHOOL",
        groupName: "GROUP 1",
        groupDesignation: "GROUP 1",
        frequency: null,
        instructorName: null,
        classTime: null,
        serviceCode: null,
        serviceLabel: null,
        students: [
          {
            rowNumber: 1,
            listOrder: 1,
            studentName: "One",
            participantId: "111",
            authNumber: "12345",
            service: "",
            serviceCode: "",
            units: 1,
            classTime: "",
            invoiceNumber: "",
            billed: "",
            notApproved: false,
            authType: "group",
            issues: [],
          },
        ],
      },
      {
        headerRaw: "DOUGHERTY COUNTY HIGH SCHOOL - GROUP 2 -",
        schoolName: "DOUGHERTY COUNTY HIGH SCHOOL",
        groupName: "GROUP 2",
        groupDesignation: "GROUP 2",
        frequency: null,
        instructorName: null,
        classTime: null,
        serviceCode: null,
        serviceLabel: null,
        students: [
          {
            rowNumber: 2,
            listOrder: 1,
            studentName: "Two",
            participantId: "222",
            authNumber: "67890",
            service: "",
            serviceCode: "",
            units: 1,
            classTime: "",
            invoiceNumber: "",
            billed: "",
            notApproved: false,
            authType: "group",
            issues: [],
          },
        ],
      },
    ];

    const group2 = collectParsedWorksheetGroupsForProgramGroup(groups, {
      headerRaw: "DOUGHERTY COUNTY HIGH SCHOOL - GROUP 2 -",
      headerKey: "dougherty county high school - group 2",
      groupName: "GROUP 1",
      schoolName: "Dougherty County High School",
    });

    assert.equal(group2.length, 1);
    assert.deepEqual(
      [...group2[0]!.students.map((s) => s.participantId)],
      ["222"]
    );
  });
});
