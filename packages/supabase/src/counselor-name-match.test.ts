import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  counselorDuplicatePairKey,
  findCounselorDuplicatePairs,
} from "./counselor-name-match";

describe("findCounselorDuplicatePairs", () => {
  it("excludes dismissed pair keys", () => {
    const rows = [
      { id: "a", full_name: "Jane Smith", contact_email: "jane.a@gvs.ga.gov" },
      { id: "b", full_name: "Jane Smith", contact_email: "jane.b@gvs.ga.gov" },
      { id: "c", full_name: "John Doe", contact_email: "john@gvs.ga.gov" },
    ];
    const all = findCounselorDuplicatePairs(rows);
    assert.ok(all.length >= 1);

    const key = counselorDuplicatePairKey("a", "b");
    const filtered = findCounselorDuplicatePairs(rows, { excludePairKeys: new Set([key]) });
    assert.equal(
      filtered.some(
        (p) =>
          (p.left.id === "a" && p.right.id === "b") || (p.left.id === "b" && p.right.id === "a")
      ),
      false
    );
  });
});
