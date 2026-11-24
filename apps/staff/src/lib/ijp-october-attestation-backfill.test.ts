import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canRunOctoberAttestationBackfill,
  executeOctoberAttestationBackfill,
  planOctoberAttestationBackfill,
  selectOctoberBackfillCopyTargets,
  type OctoberAttestationBackfillCandidate,
  type OctoberBackfillDriveOps,
} from "./ijp-october-attestation-backfill";

type FakeQuery = {
  select: (...args: unknown[]) => FakeQuery;
  eq: (...args: unknown[]) => FakeQuery;
  not: (...args: unknown[]) => FakeQuery;
  gte: (...args: unknown[]) => FakeQuery;
  lt: (...args: unknown[]) => FakeQuery;
  in: (...args: unknown[]) => FakeQuery;
  order: (...args: unknown[]) => FakeQuery;
  limit: (...args: unknown[]) => FakeQuery;
  update: (...args: unknown[]) => FakeQuery;
  insert: (...args: unknown[]) => Promise<{ data: null; error: null }>;
  upsert: (...args: unknown[]) => Promise<{ data: null; error: null }>;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  then?: unknown;
};

function candidate(
  partial: Partial<OctoberAttestationBackfillCandidate> & {
    clientId: string;
    sourceAttestationId: string;
  }
): OctoberAttestationBackfillCandidate {
  return {
    sourceServiceMonth: "2026-11-01",
    capturedAt: "2026-11-05T12:00:00.000Z",
    captureMethod: "digital",
    capturedBy: "user-1",
    facilitatorName: "Facilitator",
    signatureDataUrl: null,
    sourceDriveFileId: "drive-1",
    sourceDriveFileName: "att.pdf",
    octoberAlreadyLinked: false,
    octoberExistingDriveFileId: null,
    ...partial,
  };
}

function createFakeAdmin(opts: {
  settings?: { drive_attestation_folder_id: string | null };
  sources?: Array<Record<string, unknown>>;
  october?: Array<Record<string, unknown>>;
  octoberLookupByClient?: Record<string, { attestation_drive_file_id: string | null } | null>;
  upserts?: Array<Record<string, unknown>>;
  audits?: Array<Record<string, unknown>>;
}) {
  return {
    from(table: string) {
      const state: {
        table: string;
        filters: Record<string, unknown>;
        mode: "select" | "update";
      } = {
        table,
        filters: {},
        mode: "select",
      };
      const query: FakeQuery = {
        select() {
          return query;
        },
        eq(col: unknown, val: unknown) {
          state.filters[String(col)] = val;
          return query;
        },
        not() {
          return query;
        },
        gte() {
          return query;
        },
        lt() {
          return query;
        },
        in() {
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        update() {
          state.mode = "update";
          return query;
        },
        async insert(row: unknown) {
          opts.audits?.push(row as Record<string, unknown>);
          return { data: null, error: null };
        },
        async upsert(row: unknown) {
          opts.upserts?.push(row as Record<string, unknown>);
          const r = row as { client_id: string; attestation_drive_file_id: string };
          if (opts.octoberLookupByClient) {
            opts.octoberLookupByClient[r.client_id] = {
              attestation_drive_file_id: r.attestation_drive_file_id,
            };
          }
          return { data: null, error: null };
        },
        async maybeSingle() {
          if (table === "ijp_billing_settings") {
            return {
              data: opts.settings ?? { drive_attestation_folder_id: "root" },
              error: null,
            };
          }
          if (
            table === "ijp_monthly_attestations" &&
            state.filters.service_month === "2026-10-01" &&
            state.filters.client_id
          ) {
            const clientId = String(state.filters.client_id);
            const hit = opts.octoberLookupByClient?.[clientId];
            return { data: hit ?? null, error: null };
          }
          return { data: null, error: null };
        },
      };
      (query as { then: typeof Promise.prototype.then }).then = ((
        onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null,
        onrejected?: ((reason: unknown) => unknown) | null
      ) => {
        let data: unknown = [];
        if (table === "ijp_monthly_attestations" && state.mode === "select") {
          if (state.filters.service_month === "2026-10-01" && !state.filters.client_id) {
            data = opts.october ?? [];
          } else if (!state.filters.service_month) {
            data = opts.sources ?? [];
          }
        }
        return Promise.resolve({ data, error: null }).then(
          onfulfilled ?? undefined,
          onrejected ?? undefined
        );
      }) as typeof Promise.prototype.then;
      return query;
    },
  };
}

describe("canRunOctoberAttestationBackfill", () => {
  it("allows Super Admin only", () => {
    assert.equal(canRunOctoberAttestationBackfill("super_admin"), true);
    assert.equal(canRunOctoberAttestationBackfill("admin"), false);
    assert.equal(canRunOctoberAttestationBackfill("accountant"), false);
    assert.equal(canRunOctoberAttestationBackfill("es"), false);
    assert.equal(canRunOctoberAttestationBackfill(null), false);
  });
});

describe("selectOctoberBackfillCopyTargets", () => {
  it("skips already-linked clients and dedupes to one source per client", () => {
    const targets = selectOctoberBackfillCopyTargets([
      candidate({
        sourceAttestationId: "a1",
        clientId: "c1",
        sourceDriveFileId: "d1",
        octoberAlreadyLinked: true,
      }),
      candidate({
        sourceAttestationId: "a2",
        clientId: "c2",
        sourceServiceMonth: "2026-11-01",
        capturedAt: "2026-11-10T00:00:00.000Z",
        sourceDriveFileId: "d2a",
      }),
      candidate({
        sourceAttestationId: "a3",
        clientId: "c2",
        sourceServiceMonth: "2026-10-01",
        capturedAt: "2026-10-20T00:00:00.000Z",
        sourceDriveFileId: "d2b",
      }),
    ]);
    assert.equal(targets.length, 1);
    assert.equal(targets[0]?.clientId, "c2");
    assert.equal(targets[0]?.sourceDriveFileId, "d2b");
  });
});

describe("planOctoberAttestationBackfill", () => {
  it("counts wouldCopy vs alreadyLinked without writing", async () => {
    const admin = createFakeAdmin({
      sources: [
        {
          id: "a1",
          client_id: "c1",
          service_month: "2026-11-01",
          captured_at: "2026-11-05T12:00:00.000Z",
          captured_by: "u1",
          facilitator_name: "F",
          capture_method: "digital",
          signature_data_url: null,
          attestation_drive_file_id: "drive-1",
          attestation_drive_file_name: "att.pdf",
          is_test: false,
        },
        {
          id: "a2",
          client_id: "c2",
          service_month: "2026-11-01",
          captured_at: "2026-11-06T12:00:00.000Z",
          captured_by: "u1",
          facilitator_name: "F",
          capture_method: "upload",
          signature_data_url: null,
          attestation_drive_file_id: "drive-2",
          attestation_drive_file_name: "att2.pdf",
          is_test: false,
        },
      ],
      october: [
        {
          client_id: "c2",
          attestation_drive_file_id: "existing-oct",
        },
      ],
    });

    const plan = await planOctoberAttestationBackfill(admin as never, { dryRun: true });
    assert.equal(plan.dryRun, true);
    assert.equal(plan.targetRelativePath, "2026/2026-10");
    assert.equal(plan.counts.sourceWithDrive, 2);
    assert.equal(plan.counts.wouldCopy, 1);
    assert.equal(plan.counts.alreadyLinkedOctober, 1);
    assert.equal(plan.toCopy[0]?.clientId, "c1");
  });
});

describe("executeOctoberAttestationBackfill idempotency", () => {
  it("copies once then skips on second run", async () => {
    const octoberLookupByClient: Record<
      string,
      { attestation_drive_file_id: string | null } | null
    > = {};
    const upserts: Array<Record<string, unknown>> = [];
    const audits: Array<Record<string, unknown>> = [];
    const copies: string[] = [];

    const sources = [
      {
        id: "a1",
        client_id: "c1",
        service_month: "2026-11-01",
        captured_at: "2026-11-05T12:00:00.000Z",
        captured_by: "u1",
        facilitator_name: "F",
        capture_method: "digital",
        signature_data_url: null,
        attestation_drive_file_id: "drive-src",
        attestation_drive_file_name: "att.pdf",
        is_test: false,
      },
    ];

    const driveOps: OctoberBackfillDriveOps = {
      async ensureTargetFolder() {
        return "folder-oct";
      },
      async copyFile({ sourceFileId }) {
        copies.push(sourceFileId);
        return { fileId: `copy-of-${sourceFileId}`, fileName: "att-oct.pdf" };
      },
    };

    const admin = createFakeAdmin({
      sources,
      october: [],
      octoberLookupByClient,
      upserts,
      audits,
    });

    const first = await executeOctoberAttestationBackfill(admin as never, {
      actorUserId: "actor",
      driveOps,
    });
    assert.equal(first.copied, 1);
    assert.equal(copies.length, 1);
    assert.equal(upserts.length, 1);
    assert.equal(upserts[0]?.service_month, "2026-10-01");
    assert.equal(upserts[0]?.attestation_drive_file_id, "copy-of-drive-src");
    assert.equal(upserts[0]?.captured_at, "2026-11-05T12:00:00.000Z");
    assert.equal(upserts[0]?.capture_method, "digital");

    // Second plan sees October link via october list
    const admin2 = createFakeAdmin({
      sources,
      october: [
        {
          client_id: "c1",
          attestation_drive_file_id: "copy-of-drive-src",
        },
      ],
      octoberLookupByClient,
      upserts,
      audits,
    });
    const second = await executeOctoberAttestationBackfill(admin2 as never, {
      actorUserId: "actor",
      driveOps,
    });
    assert.equal(second.copied, 0);
    assert.equal(copies.length, 1);
    assert.ok(second.skipped.some((s) => s.reason.includes("already linked")));
  });
});
