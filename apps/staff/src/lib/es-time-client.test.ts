import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shiftMonthKey,
  summarizeTimeEntriesByClientService,
  type EsTimeEntryRow,
} from "./es-time-client";

function entry(partial: Partial<EsTimeEntryRow> & Pick<EsTimeEntryRow, "id">): EsTimeEntryRow {
  return {
    es_user_id: "es-1",
    client_id: "c1",
    client_name: "Ada Client",
    activity_type_id: "act-1",
    activity_code: "JT-ACT-010",
    activity_name: "In-Person Meeting",
    activity_category: "contact",
    counts_toward_client_billable: true,
    service_date: "2026-11-10",
    duration_minutes: 60,
    duration_hours: "1.0",
    client_billable_hours: "1.0",
    service_start_at: null,
    service_end_at: null,
    created_at: "2026-11-10T15:00:00.000Z",
    narrative: "Notes",
    linked_source_type: "contact_log",
    status: "approved",
    flags: {},
    service_id: "svc-ijp",
    service_name: "Individual Job Placement",
    ...partial,
  };
}

describe("summarizeTimeEntriesByClientService", () => {
  it("splits one client across services and keeps non-billable in entry counts only", () => {
    const groups = summarizeTimeEntriesByClientService([
      entry({ id: "1", duration_minutes: 60, client_billable_hours: "1.0" }),
      entry({
        id: "2",
        duration_minutes: 30,
        client_billable_hours: "0.5",
        service_id: "svc-tse",
        service_name: "Traditional Supported Employment",
      }),
      entry({
        id: "3",
        duration_minutes: 45,
        counts_toward_client_billable: false,
        client_billable_hours: "0.0",
        activity_name: "Case File Review",
      }),
    ]);

    assert.equal(groups.length, 2);
    const ijp = groups.find((g) => g.serviceId === "svc-ijp");
    const tse = groups.find((g) => g.serviceId === "svc-tse");
    assert.ok(ijp);
    assert.ok(tse);
    assert.equal(ijp.billableMinutes, 60);
    assert.equal(ijp.entryCount, 2);
    assert.equal(tse.billableMinutes, 30);
    assert.equal(tse.entryCount, 1);
  });
});

describe("shiftMonthKey", () => {
  it("shifts across year boundaries", () => {
    assert.equal(shiftMonthKey("2026-01", -1), "2025-12");
    assert.equal(shiftMonthKey("2025-12", 1), "2026-01");
  });
});
