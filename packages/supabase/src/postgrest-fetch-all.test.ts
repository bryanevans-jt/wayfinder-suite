import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchAllPostgrestRows,
  POSTGREST_DEFAULT_PAGE_SIZE,
} from "./postgrest-fetch-all";

describe("postgrest-fetch-all", () => {
  it("PostgREST default page size matches Supabase truncation limit", () => {
    assert.equal(POSTGREST_DEFAULT_PAGE_SIZE, 1000);
  });

  it("pages with .range() until a short page so totals are not truncated at 1000", async () => {
    const pageSize = 100;
    const total = 1005;
    const allIds = Array.from({ length: total }, (_, i) => `row-${i}`);
    const rangeCalls: Array<{ from: number; to: number }> = [];

    const admin = {
      from(_table: string) {
        return {
          select(_cols: string) {
            const builder: {
              order: () => typeof builder;
              range: (from: number, to: number) => Promise<{ data: { id: string }[]; error: null }>;
            } = {
              order() {
                return builder;
              },
              async range(from: number, to: number) {
                rangeCalls.push({ from, to });
                const page = allIds.slice(from, to + 1).map((id) => ({ id }));
                return { data: page, error: null };
              },
            };
            return builder;
          },
        };
      },
    };

    const rows = await fetchAllPostgrestRows<{ id: string }>(
      admin as never,
      "es_time_entries",
      "id",
      { order: { column: "id", ascending: true }, pageSize }
    );

    assert.equal(rows.length, total);
    assert.equal(rows[0]?.id, "row-0");
    assert.equal(rows[total - 1]?.id, `row-${total - 1}`);
    assert.deepEqual(rangeCalls, [
      { from: 0, to: 99 },
      { from: 100, to: 199 },
      { from: 200, to: 299 },
      { from: 300, to: 399 },
      { from: 400, to: 499 },
      { from: 500, to: 599 },
      { from: 600, to: 699 },
      { from: 700, to: 799 },
      { from: 800, to: 899 },
      { from: 900, to: 999 },
      { from: 1000, to: 1099 },
    ]);
  });
});
