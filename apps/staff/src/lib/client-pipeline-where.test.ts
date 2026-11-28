import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countsTowardTeamOpsCaseload,
  countsTowardThinContactCoaching,
} from "./client-pipeline-where";

describe("countsTowardTeamOpsCaseload", () => {
  it("counts active non-demo clients like the default Clients list", () => {
    assert.equal(
      countsTowardTeamOpsCaseload({
        archived_at: null,
        is_demo: false,
        intake_status: "active",
      }),
      true
    );
  });

  it("excludes fully archived clients still linked by assignment", () => {
    assert.equal(
      countsTowardTeamOpsCaseload({
        archived_at: "2020-01-01T00:00:00.000Z",
        is_demo: false,
        intake_status: "active",
      }),
      false
    );
  });

  it("still counts pending-archive clients during the grace window", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    assert.equal(
      countsTowardTeamOpsCaseload({
        archived_at: future,
        is_demo: false,
        intake_status: "active",
      }),
      true
    );
  });

  it("excludes demo and discarded clients", () => {
    assert.equal(
      countsTowardTeamOpsCaseload({
        archived_at: null,
        is_demo: true,
        intake_status: "active",
      }),
      false
    );
    assert.equal(
      countsTowardTeamOpsCaseload({
        archived_at: null,
        is_demo: false,
        intake_status: "discarded",
      }),
      false
    );
  });
});

describe("countsTowardThinContactCoaching", () => {
  it("counts only live non-demo caseload clients", () => {
    assert.equal(
      countsTowardThinContactCoaching({
        archived_at: null,
        is_demo: false,
        intake_status: "active",
      }),
      true
    );
  });

  it("excludes pending-archive and fully archived clients", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    assert.equal(
      countsTowardThinContactCoaching({
        archived_at: future,
        is_demo: false,
        intake_status: "active",
      }),
      false
    );
    assert.equal(
      countsTowardThinContactCoaching({
        archived_at: "2020-01-01T00:00:00.000Z",
        is_demo: false,
        intake_status: "active",
      }),
      false
    );
  });
});
