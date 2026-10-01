import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeWorksheetHeaderKeyLoose,
  worksheetHeaderKeysMatch,
} from "./pre-ets-worksheet-parser";
import {
  resolveWorksheetGroupMapping,
  worksheetGroupMappingMatchesParsedSchool,
} from "./pre-ets-worksheet-group-mapping";
import type { PreEtsWorksheetGroupMappingRow } from "./pre-ets-worksheet-group-mapping";

describe("worksheet header keys", () => {
  it("treats CSV padding and en-dashes like Excel exports", () => {
    const csv =
      "TATTNALL COUNTY HIGH SCHOOL - BI-WEEKLY - FRIDAYS - TIFFANY POWELL,,,,,";
    const excel =
      "TATTNALL COUNTY HIGH SCHOOL – BI-WEEKLY – FRIDAYS – TIFFANY POWELL";
    assert.ok(worksheetHeaderKeysMatch(csv, excel));
    assert.equal(
      normalizeWorksheetHeaderKeyLoose(csv),
      normalizeWorksheetHeaderKeyLoose(excel)
    );
  });
});

describe("resolveWorksheetGroupMapping", () => {
  it("finds mapping when upload header differs slightly from saved sample", () => {
    const row: PreEtsWorksheetGroupMappingRow = {
      id: "1",
      school_year: "2025-2026",
      district_id: "d1",
      worksheet_header_key: normalizeWorksheetHeaderKeyLoose(
        "WHEELER COUNTY HIGH SCHOOL - MONTHLY - TIFFANY POWELL"
      ),
      header_raw_sample: "WHEELER COUNTY HIGH SCHOOL - MONTHLY - TIFFANY POWELL",
      canonical_school_name: "Wheeler County High School",
      canonical_group_name: "MONTHLY",
      canonical_instructor_name: "Tiffany Powell",
      canonical_school_id: null,
    };
    const map = new Map<string, PreEtsWorksheetGroupMappingRow>();
    map.set(row.worksheet_header_key, row);

    const fromExcel =
      "WHEELER COUNTY HIGH SCHOOL – MONTHLY – TIFFANY POWELL,,,";
    assert.equal(resolveWorksheetGroupMapping(map, fromExcel)?.canonical_school_name, row.canonical_school_name);
  });
});

describe("worksheetGroupMappingMatchesParsedSchool", () => {
  it("rejects remapping Upson Lee headers onto Pike County", () => {
    const mapping: PreEtsWorksheetGroupMappingRow = {
      id: "1",
      school_year: "2026-2027",
      district_id: "d1",
      worksheet_header_key: "upson",
      header_raw_sample: "UPSON LEE - EMERY FAIRCLOTH - INCLUSION",
      canonical_school_name: "Pike County High School",
      canonical_group_name: "INCLUSION",
      canonical_instructor_name: "Emery Faircloth",
      canonical_school_id: "pike-id",
    };
    assert.equal(
      worksheetGroupMappingMatchesParsedSchool(
        "UPSON LEE - EMERY FAIRCLOTH - INCLUSION",
        mapping
      ),
      false
    );
  });
});
