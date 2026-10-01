import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregatePreEtsServingMetricsFromRosterRows,
  preEtsParticipantIdEligibleForMetrics,
} from "./pre-ets-serving-metrics";

test("preEtsParticipantIdEligibleForMetrics rejects empty and NOT APPROVED", () => {
  assert.equal(preEtsParticipantIdEligibleForMetrics(""), false);
  assert.equal(preEtsParticipantIdEligibleForMetrics("NOT APPROVED"), false);
  assert.equal(preEtsParticipantIdEligibleForMetrics("12345"), true);
});

test("aggregatePreEtsServingMetricsFromRosterRows counts groups and unique PIDs per month", () => {
  const rows = [
    {
      authorization_id: "a1",
      not_approved: false,
      pre_ets_authorizations: {
        service_month: "2026-10-01",
        program_group_id: "g1",
        school_id: "s1",
        pre_ets_program_groups: { id: "g1", hidden_at: null, merged_into_program_group_id: null },
        pre_ets_schools: { pre_ets_districts: { school_year: "2026-2027" } },
      },
      pre_ets_students: { participant_id: "111" },
    },
    {
      authorization_id: "a1",
      not_approved: false,
      pre_ets_authorizations: {
        service_month: "2026-10-01",
        program_group_id: "g1",
        school_id: "s1",
        pre_ets_program_groups: { id: "g1", hidden_at: null, merged_into_program_group_id: null },
        pre_ets_schools: { pre_ets_districts: { school_year: "2026-2027" } },
      },
      pre_ets_students: { participant_id: "222" },
    },
    {
      authorization_id: "a2",
      not_approved: false,
      pre_ets_authorizations: {
        service_month: "2026-10-01",
        program_group_id: "g2",
        school_id: "s1",
        pre_ets_program_groups: { id: "g2", hidden_at: null, merged_into_program_group_id: null },
        pre_ets_schools: { pre_ets_districts: { school_year: "2026-2027" } },
      },
      pre_ets_students: { participant_id: "111" },
    },
    {
      authorization_id: "a3",
      not_approved: false,
      pre_ets_authorizations: {
        service_month: "2026-09-01",
        program_group_id: "g3",
        school_id: "s2",
        pre_ets_program_groups: { id: "g3", hidden_at: null, merged_into_program_group_id: null },
        pre_ets_schools: { pre_ets_districts: { school_year: "2026-2027" } },
      },
      pre_ets_students: { participant_id: "333" },
    },
  ];

  const map = aggregatePreEtsServingMetricsFromRosterRows(rows, { schoolYear: "2026-2027" });
  const oct = map.get("2026-10");
  assert.ok(oct);
  assert.equal(oct?.programGroups.size, 2);
  assert.equal(oct?.students.size, 2);
  assert.equal(map.get("2026-09")?.students.size, 1);
});
