import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientNameSortKey,
  compareClientNameSortKeys,
} from "@wayfinder/branding";

/**
 * Roster sort behavior is owned by branding helpers; this file locks the
 * IJP Billing page contract (last → first, missing names after named).
 */
describe("IJP Billing month roster sort contract", () => {
  it("orders clients by last name then first name", () => {
    const rows = [
      {
        displayName: "Zoe Adams",
        ...clientNameSortKey({
          displayName: "Zoe Adams",
          last_name: "Adams",
          first_name: "Zoe",
        }),
      },
      {
        displayName: "Ann Adams",
        ...clientNameSortKey({
          displayName: "Ann Adams",
          last_name: "Adams",
          first_name: "Ann",
        }),
      },
      {
        displayName: "Amy Zane",
        ...clientNameSortKey({
          displayName: "Amy Zane",
          last_name: "Zane",
          first_name: "Amy",
        }),
      },
    ];
    rows.sort(compareClientNameSortKeys);
    assert.deepEqual(
      rows.map((r) => r.displayName),
      ["Ann Adams", "Zoe Adams", "Amy Zane"]
    );
  });

  it("places email / unknown labels after named clients", () => {
    const named = {
      displayName: "Zoe Quinn",
      ...clientNameSortKey({ displayName: "Zoe Quinn" }),
    };
    const email = {
      displayName: "zoe@example.com",
      ...clientNameSortKey({ displayName: "zoe@example.com" }),
    };
    const unknown = {
      displayName: "Unknown client",
      ...clientNameSortKey({ displayName: "Unknown client" }),
    };
    assert.ok(compareClientNameSortKeys(named, email) < 0);
    assert.ok(compareClientNameSortKeys(named, unknown) < 0);
  });
});
