import assert from "node:assert/strict";
import test from "node:test";
import {
  programGroupLooksLikeSpecialEvent,
  selectAuthorizationIdsForProgramGroupRoster,
} from "./pre-ets-program-group-roster";

test("event groups use single-seat auths only, not the Main group auth", () => {
  const group = {
    group_name: "Day at the Fair",
    header_raw: "APPLING COUNTY HIGH - DAY AT THE FAIR",
    service_code: "PRE-9000",
    service_label: "Day at the Fair",
  };
  assert.ok(programGroupLooksLikeSpecialEvent(group));

  const mainAuth = {
    id: "main-auth",
    auth_type: "pending",
    service_code: "PRE-3241",
    rosterCount: 12,
  };
  const fairAuths = Array.from({ length: 10 }, (_, i) => ({
    id: `fair-${i}`,
    auth_type: "individual" as const,
    service_code: "PRE-9000",
    rosterCount: 1,
  }));

  const selected = selectAuthorizationIdsForProgramGroupRoster(group, [mainAuth, ...fairAuths]);
  assert.equal(selected.length, 10);
  assert.ok(!selected.includes("main-auth"));
});

test("Main group uses the shared group authorization", () => {
  const group = {
    group_name: "Main",
    header_raw: "APPLING COUNTY HIGH - MAIN",
    service_code: "PRE-3241",
    service_label: "Pre-ETS",
  };
  assert.equal(programGroupLooksLikeSpecialEvent(group), false);

  const mainAuth = {
    id: "main-auth",
    auth_type: "pending",
    service_code: "PRE-3241",
    rosterCount: 12,
  };
  const selected = selectAuthorizationIdsForProgramGroupRoster(group, [mainAuth]);
  assert.deepEqual(selected, ["main-auth"]);
});
