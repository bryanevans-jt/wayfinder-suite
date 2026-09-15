import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterRetiredMarketClients,
  filterRetiredMarketCounselors,
  filterRetiredMarketOffices,
  filterRetiredMarketServices,
  isRetiredMarketClient,
  retiredMarketContextFromOffices,
} from "./retired-market";

describe("retired-market filters", () => {
  const ctx = retiredMarketContextFromOffices([
    { id: "ga-1", state: "GA", name: "Atlanta" },
    { id: "tn-1", state: "TN", name: "Nashville" },
    { id: "legacy-1", state: null, name: "Legacy (TN)" },
  ]);

  it("excludes retired offices and services", () => {
    const offices = filterRetiredMarketOffices([
      { id: "ga-1", state: "GA", name: "Atlanta" },
      { id: "tn-1", state: "TN", name: "Nashville" },
    ]);
    assert.equal(offices.length, 1);
    assert.equal(offices[0]?.id, "ga-1");

    const services = filterRetiredMarketServices([
      { id: "s1", name: "WRT (GA)", state: "GA" },
      { id: "s2", name: "IJP (TN)", state: "TN" },
    ]);
    assert.equal(services.length, 1);
    assert.equal(services[0]?.id, "s1");
  });

  it("excludes counselors assigned only to retired offices", () => {
    const counselors = filterRetiredMarketCounselors(
      [
        { id: "c1", office_ids: ["ga-1"] },
        { id: "c2", office_ids: ["tn-1"] },
        { id: "c3", office_ids: ["ga-1", "tn-1"] },
      ],
      ctx
    );
    assert.deepEqual(
      counselors.map((c) => c.id).sort(),
      ["c1", "c3"]
    );
  });

  it("excludes clients tied to retired market", () => {
    const servicesById = new Map([
      ["s-ga", { state: "GA", name: "WRT (GA)" }],
      ["s-tn", { state: "TN", name: "IJP (TN)" }],
    ]);
    assert.equal(
      isRetiredMarketClient({ office_id: "tn-1", referral_state: "GA" }, ctx, servicesById),
      true
    );
    assert.equal(
      isRetiredMarketClient({ office_id: "ga-1", referral_state: "TN" }, ctx, servicesById),
      true
    );
    assert.equal(
      isRetiredMarketClient(
        { office_id: "ga-1", referral_state: "GA", current_service_id: "s-tn" },
        ctx,
        servicesById
      ),
      true
    );

    const clients = filterRetiredMarketClients(
      [
        { id: "1", office_id: "ga-1", referral_state: "GA" },
        { id: "2", office_id: "tn-1", referral_state: "GA" },
      ],
      ctx,
      servicesById
    );
    assert.equal(clients.length, 1);
    assert.equal(clients[0]?.id, "1");
  });
});
