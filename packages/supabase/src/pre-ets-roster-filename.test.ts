import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPreEtsRosterFileLabel } from "./pre-ets-roster-filename";
import { resolvePreEtsWorksheetServiceFields } from "./pre-ets-settings";

describe("buildPreEtsRosterFileLabel", () => {
  it("includes school year and service month", () => {
    const label = buildPreEtsRosterFileLabel({
      schoolYear: "2025-2026",
      serviceMonth: "2025-10-01",
      schoolName: "Wheeler County High",
      groupName: "Self Contained",
    });
    assert.equal(label, "2025-2026 Oct 2025 - Wheeler County High - Self Contained");
  });

  it("appends session date when present", () => {
    const label = buildPreEtsRosterFileLabel({
      schoolYear: "2025-2026",
      serviceMonth: "2025-10-01",
      schoolName: "Wheeler County High",
      groupName: "Self Contained",
      sessionDate: "2025-10-15",
    });
    assert.equal(
      label,
      "2025-2026 Oct 2025 - Wheeler County High - Self Contained - 2025-10-15"
    );
  });
});

describe("resolvePreEtsWorksheetServiceFields", () => {
  it("matches catalog code and prefers description for topic", () => {
    const settings = {
      service_codes: [
        {
          code: "PRE-3241",
          service: "JEC",
          description: "Job Exploration Counseling Topic",
        },
      ],
    };
    const resolved = resolvePreEtsWorksheetServiceFields(
      "pre - 3241",
      "Spreadsheet Service Name",
      settings
    );
    assert.equal(resolved.serviceCode, "PRE-3241");
    assert.equal(resolved.serviceLabel, "Job Exploration Counseling Topic");
    assert.equal(resolved.catalogMatched, true);
  });
});
