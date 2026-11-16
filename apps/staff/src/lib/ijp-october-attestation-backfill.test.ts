import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planOctoberAttestationBackfill } from "./ijp-october-attestation-backfill";

type FakeQuery = {
  select: (...args: unknown[]) => FakeQuery;
  eq: (...args: unknown[]) => FakeQuery;
  not: (...args: unknown[]) => FakeQuery;
  gte: (...args: unknown[]) => FakeQuery;
  lt: (...args: unknown[]) => FakeQuery;
  in: (...args: unknown[]) => FakeQuery;
  order: (...args: unknown[]) => FakeQuery;
  limit: (...args: unknown[]) => FakeQuery;
  maybeSingle: () => Promise<{ data: unknown; error: null }>;
  then?: unknown;
};

function createFakeAdmin(opts: {
  settings?: { drive_attestation_folder_id: string | null };
  sources?: Array<Record<string, unknown>>;
  october?: Array<Record<string, unknown>>;
}) {
  return {
    from(table: string) {
      const state: { table: string; filters: Record<string, unknown> } = {
        table,
        filters: {},
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
        async maybeSingle() {
          if (table === "ijp_billing_settings") {
            return { data: opts.settings ?? { drive_attestation_folder_id: "root" }, error: null };
          }
          return { data: null, error: null };
        },
      };
      // Thenable for awaited select chains that expect { data, error }
      (query as { then: typeof Promise.prototype.then }).then = ((
        onfulfilled?: ((value: { data: unknown; error: null }) => unknown) | null,
        onrejected?: ((reason: unknown) => unknown) | null
      ) => {
        let data: unknown = [];
        if (table === "ijp_monthly_attestations") {
          if (state.filters.service_month === "2026-10-01") {
            data = opts.october ?? [];
          } else {
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

describe("planOctoberAttestationBackfill", () => {
  it("counts wouldCopy vs alreadyLinked without writing", async () => {
    const admin = createFakeAdmin({
      sources: [
        {
          id: "a1",
          client_id: "c1",
          service_month: "2026-11-01",
          captured_at: "2026-11-05T12:00:00.000Z",
          attestation_drive_file_id: "drive-1",
          attestation_drive_file_name: "att.pdf",
          is_test: false,
        },
        {
          id: "a2",
          client_id: "c2",
          service_month: "2026-11-01",
          captured_at: "2026-11-06T12:00:00.000Z",
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
    assert.equal(plan.counts.skippedMissingDrive, 0);
  });
});
