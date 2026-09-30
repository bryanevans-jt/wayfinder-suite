import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  detectWorksheetUploadFormat,
  readWorkbookDistrictSheets,
} from "./pre-ets-worksheet-workbook";
import { parseDistrictWorksheet } from "./pre-ets-worksheet-parser";

test("detectWorksheetUploadFormat accepts csv and excel extensions", () => {
  assert.equal(detectWorksheetUploadFormat("billing.csv"), "csv");
  assert.equal(detectWorksheetUploadFormat("billing.XLSX"), "xlsx");
  assert.equal(detectWorksheetUploadFormat("legacy.xls"), "xls");
  assert.equal(detectWorksheetUploadFormat("notes.txt"), null);
});

test("readWorkbookDistrictSheets parses each tab as district CSV", () => {
  const sheetA = XLSX.utils.aoa_to_sheet([
    ["JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27"],
    ["DISTRICT 5 SCHOOLS"],
    ["OFFICE SCHOOLS"],
    ["SHAW HIGH - INST - INCL"],
    ["#", "STUDENT NAME", "PID #", "A&I", "SERVICE", "CODE", "UNITS"],
    ["1", "Alice", "11111", "", "PRE", "PRE-1", "1"],
  ]);
  const sheetB = XLSX.utils.aoa_to_sheet([
    ["JOSHUA TREE OCTOBER PRE-ETS BILLING 2026-27"],
    ["DISTRICT 8 SCHOOLS"],
    ["OFFICE SCHOOLS"],
    ["TATTNALL COUNTY HIGH SCHOOL - MONTHLY - POWELL"],
    ["#", "STUDENT NAME", "PID #", "A&I", "SERVICE", "CODE", "UNITS"],
    ["1", "Bob", "22222", "", "PRE", "PRE-1", "1"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetA, "D5");
  XLSX.utils.book_append_sheet(wb, sheetB, "D8");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const sheets = readWorkbookDistrictSheets(buffer);
  assert.equal(sheets.length, 2);

  const d5 = parseDistrictWorksheet(sheets[0]?.csvText ?? "");
  const d8 = parseDistrictWorksheet(sheets[1]?.csvText ?? "");
  assert.equal(d5.districtNumber, "5");
  assert.equal(d8.districtNumber, "8");
  assert.equal(d8.offices[0]?.groups[0]?.schoolName, "TATTNALL COUNTY HIGH SCHOOL");
});
