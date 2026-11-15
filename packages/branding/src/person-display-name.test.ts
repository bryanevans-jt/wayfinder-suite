import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientDisplayName,
  clientDisplayNameFromRosterAndProfile,
  clientNameSortKey,
  compareClientNameSortKeys,
} from "./person-display-name";

describe("clientDisplayName / roster+profile fallback", () => {
  it("uses clients.full_name when present", () => {
    assert.equal(
      clientDisplayNameFromRosterAndProfile(
        { full_name: "Ada Lovelace", contact_email: "ada@example.com" },
        { full_name: "Other" }
      ),
      "Ada Lovelace"
    );
  });

  it("falls back to linked profile full_name before email", () => {
    assert.equal(
      clientDisplayNameFromRosterAndProfile(
        { full_name: null, contact_email: "ada@example.com" },
        { full_name: "Ada Lovelace" }
      ),
      "Ada Lovelace"
    );
  });

  it("falls back to profile first+last before email", () => {
    assert.equal(
      clientDisplayNameFromRosterAndProfile(
        { full_name: null, contact_email: "ada@example.com" },
        { full_name: null, first_name: "Ada", last_name: "Lovelace" }
      ),
      "Ada Lovelace"
    );
  });

  it("uses email only when no name fields exist", () => {
    assert.equal(
      clientDisplayNameFromRosterAndProfile(
        { full_name: null, contact_email: "ada@example.com" },
        null
      ),
      "ada@example.com"
    );
  });

  it("uses Unknown client when nothing is available", () => {
    assert.equal(clientDisplayName({ full_name: null }), "Unknown client");
    assert.equal(
      clientDisplayNameFromRosterAndProfile({ full_name: null }, null),
      "Unknown client"
    );
  });
});

describe("client name sort keys", () => {
  it("sorts by last name then first name", () => {
    const rows = [
      { displayName: "Ada Lovelace", ...clientNameSortKey({ displayName: "Ada Lovelace" }) },
      { displayName: "Grace Hopper", ...clientNameSortKey({ displayName: "Grace Hopper" }) },
      {
        displayName: "Alan Turing",
        ...clientNameSortKey({ displayName: "Alan Turing", last_name: "Turing", first_name: "Alan" }),
      },
    ];
    rows.sort(compareClientNameSortKeys);
    assert.deepEqual(
      rows.map((r) => r.displayName),
      ["Grace Hopper", "Ada Lovelace", "Alan Turing"]
    );
  });

  it("puts missing / email labels after named clients", () => {
    const named = clientNameSortKey({ displayName: "Zoe Quinn" });
    const email = clientNameSortKey({ displayName: "zoe@example.com" });
    const unknown = clientNameSortKey({ displayName: "Unknown client" });
    assert.ok(compareClientNameSortKeys({ ...named, displayName: "Zoe Quinn" }, { ...email, displayName: "zoe@example.com" }) < 0);
    assert.ok(compareClientNameSortKeys({ ...named, displayName: "Zoe Quinn" }, { ...unknown, displayName: "Unknown client" }) < 0);
  });
});
