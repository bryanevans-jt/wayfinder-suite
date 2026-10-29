import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assigneesOverlappingMonth,
  lastAssigneeInCalendarMonth,
  type AssignmentEventRow,
} from "./es-client-assignment-events";

describe("KRA assignment month helpers", () => {
  const events: AssignmentEventRow[] = [
    {
      client_id: "c1",
      es_user_id: "es-a",
      effective_at: "2026-01-05T12:00:00.000Z",
    },
    {
      client_id: "c1",
      es_user_id: "es-b",
      effective_at: "2026-01-16T12:00:00.000Z",
    },
  ];

  it("includes both assignees when handoff is mid-month", () => {
    const ids = assigneesOverlappingMonth(events, "2026-01");
    assert.deepEqual(new Set(ids), new Set(["es-a", "es-b"]));
  });

  it("last assignee in month is the latest event on or before month end", () => {
    assert.equal(lastAssigneeInCalendarMonth(events, "2026-01"), "es-b");
  });

  it("single assignee all month", () => {
    const onlyA: AssignmentEventRow[] = [
      {
        client_id: "c1",
        es_user_id: "es-a",
        effective_at: "2025-12-01T00:00:00.000Z",
      },
    ];
    assert.deepEqual(assigneesOverlappingMonth(onlyA, "2026-01"), ["es-a"]);
    assert.equal(lastAssigneeInCalendarMonth(onlyA, "2026-01"), "es-a");
  });
});
