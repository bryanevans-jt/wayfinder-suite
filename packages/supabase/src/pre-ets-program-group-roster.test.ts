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

test("event groups include all single-seat auths even when service codes differ on rows", () => {
  const group = {
    group_name: "Day at the Fair",
    header_raw: "APPLING COUNTY HIGH - DAY AT THE FAIR",
    service_code: "PRE-9000",
    service_label: "Day at the Fair",
  };
  const mainAuth = {
    id: "main-auth",
    auth_type: "pending",
    service_code: "PRE-3241",
    rosterCount: 12,
  };
  const fairAuths = [
    ...Array.from({ length: 9 }, (_, i) => ({
      id: `fair-pre-${i}`,
      auth_type: "individual" as const,
      service_code: "PRE-3241",
      rosterCount: 1,
    })),
    {
      id: "fair-9000",
      auth_type: "individual" as const,
      service_code: "PRE-9000",
      rosterCount: 1,
    },
  ];

  const selected = selectAuthorizationIdsForProgramGroupRoster(group, [mainAuth, ...fairAuths]);
  assert.equal(selected.length, 10);
  assert.ok(!selected.includes("main-auth"));
});

test("event groups can use one shared authorization when all students share the event code", () => {
  const group = {
    group_name: "Day at the Fair",
    header_raw: "APPLING COUNTY HIGH - DAY AT THE FAIR",
    service_code: "PRE-9000",
    service_label: "Day at the Fair",
  };
  const fairAuth = {
    id: "fair-group",
    auth_type: "pending",
    service_code: "PRE-9000",
    rosterCount: 10,
  };
  const selected = selectAuthorizationIdsForProgramGroupRoster(group, [fairAuth]);
  assert.deepEqual(selected, ["fair-group"]);
});
