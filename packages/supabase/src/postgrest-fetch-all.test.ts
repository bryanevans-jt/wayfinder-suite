import assert from "node:assert/strict";
import test from "node:test";
import { POSTGREST_DEFAULT_PAGE_SIZE } from "./postgrest-fetch-all";

test("PostgREST default page size matches Supabase truncation limit", () => {
  assert.equal(POSTGREST_DEFAULT_PAGE_SIZE, 1000);
});
