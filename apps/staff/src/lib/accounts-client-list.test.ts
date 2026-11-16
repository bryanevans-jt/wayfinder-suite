import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessAccountsClientsList,
  filterAccountsClientListRows,
  resolveAccountsClientSupervisorUserId,
  type AccountsClientListRow,
} from "./accounts-client-list";

function row(
  partial: Partial<AccountsClientListRow> & { clientId: string; clientName: string }
): AccountsClientListRow {
  return {
    sortLastName: "Z",
    sortFirstName: "A",
    serviceName: null,
    stageTitle: null,
    assignedEsName: null,
    supervisorName: null,
    ...partial,
  };
}

describe("canAccessAccountsClientsList", () => {
  it("allows accountant and other view-profile roles that are not field specialists", () => {
    assert.equal(canAccessAccountsClientsList("accountant"), true);
    assert.equal(canAccessAccountsClientsList("admin"), true);
    assert.equal(canAccessAccountsClientsList("super_admin"), true);
    assert.equal(canAccessAccountsClientsList("hr"), true);
    assert.equal(canAccessAccountsClientsList("hospitality_specialist"), true);
  });

  it("denies field specialists and unrelated roles", () => {
    assert.equal(canAccessAccountsClientsList("es"), false);
    assert.equal(canAccessAccountsClientsList("transition_specialist"), false);
    assert.equal(canAccessAccountsClientsList("supervisor"), false);
    assert.equal(canAccessAccountsClientsList("counselor"), false);
    assert.equal(canAccessAccountsClientsList(null), false);
  });
});

describe("resolveAccountsClientSupervisorUserId", () => {
  it("prefers clients.supervisor_user_id over ES supervisor link", () => {
    const id = resolveAccountsClientSupervisorUserId({
      clientSupervisorUserId: "sup-direct",
      assignedEsUserId: "es-1",
      supervisorByEsUserId: new Map([["es-1", "sup-from-es"]]),
    });
    assert.equal(id, "sup-direct");
  });

  it("falls back to supervisor_es_assignments via assigned ES", () => {
    const id = resolveAccountsClientSupervisorUserId({
      clientSupervisorUserId: null,
      assignedEsUserId: "es-1",
      supervisorByEsUserId: new Map([["es-1", "sup-from-es"]]),
    });
    assert.equal(id, "sup-from-es");
  });

  it("returns null when neither source has a supervisor", () => {
    const id = resolveAccountsClientSupervisorUserId({
      clientSupervisorUserId: "  ",
      assignedEsUserId: "es-1",
      supervisorByEsUserId: new Map(),
    });
    assert.equal(id, null);
  });
});

describe("filterAccountsClientListRows", () => {
  const rows = [
    row({
      clientId: "c1",
      clientName: "Ada Lovelace",
      sortLastName: "Lovelace",
      sortFirstName: "Ada",
      serviceName: "Individual Job Placement",
      assignedEsName: "Pat Specialist",
    }),
    row({
      clientId: "c2",
      clientName: "Grace Hopper",
      sortLastName: "Hopper",
      sortFirstName: "Grace",
      stageTitle: "Job Development",
      supervisorName: "Sam Supervisor",
    }),
  ];

  it("filters by client name case-insensitively", () => {
    const hit = filterAccountsClientListRows(rows, "lovelace");
    assert.equal(hit.length, 1);
    assert.equal(hit[0]?.clientId, "c1");
  });

  it("returns all rows for empty query", () => {
    assert.equal(filterAccountsClientListRows(rows, "  ").length, 2);
  });
});
