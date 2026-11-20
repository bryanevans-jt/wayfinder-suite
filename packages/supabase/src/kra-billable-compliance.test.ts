import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assigneesOverlappingMonth,
  lastAssigneeInCalendarMonth,
  type AssignmentEventRow,
} from "./es-client-assignment-events";
import { KRA_ROSTER_ROLES } from "./kra-billable-compliance";
import { POSTGREST_DEFAULT_PAGE_SIZE } from "./postgrest-fetch-all";

describe("KRA roster roles", () => {
  it("includes supervisors alongside ES and transition specialists", () => {
    assert.deepEqual([...KRA_ROSTER_ROLES].sort(), [
      "es",
      "supervisor",
      "transition_specialist",
    ]);
  });
});

describe("KRA pagination contract", () => {
  it("documents PostgREST page size so KRA fetchAll loops must exceed 1000 rows", () => {
    assert.equal(POSTGREST_DEFAULT_PAGE_SIZE, 1000);
  });
});

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
