import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPreEtsSearchIlikeOrFilter } from "./pre-ets-search-query";

describe("buildPreEtsSearchIlikeOrFilter", () => {
  it("quotes the pattern so commas do not add extra or-branches", () => {
    const filter = buildPreEtsSearchIlikeOrFilter(
      ["full_name", "participant_id"],
      "Smith, Jr."
    );
    assert.equal(
      filter,
      'full_name.ilike."%Smith, Jr.%",participant_id.ilike."%Smith, Jr.%"'
    );
    // Unquoted commas would create more than two or-clauses; quoted value keeps two.
    assert.match(filter, /^[^,]+\.ilike\."[^\"]*",[^,]+\.ilike\."[^\"]*"$/);
  });

  it("escapes embedded quotes and backslashes inside the quoted value", () => {
    const filter = buildPreEtsSearchIlikeOrFilter(["full_name"], 'a"b\\c');
    assert.equal(filter, 'full_name.ilike."%a\\"b\\\\c%"');
  });

  it("keeps PostgREST operator-looking text inside the quoted pattern", () => {
    const filter = buildPreEtsSearchIlikeOrFilter(
      ["full_name", "participant_id"],
      "x.eq.1)or(id.neq.0"
    );
    assert.equal(
      filter,
      'full_name.ilike."%x.eq.1)or(id.neq.0%",participant_id.ilike."%x.eq.1)or(id.neq.0%"'
    );
  });
});
