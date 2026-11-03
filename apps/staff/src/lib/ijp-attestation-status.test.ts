import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeIjpSignatureListFlagsFromSnapshots,
  computeIjpSignatureUiStatusFromSnapshot,
  type IjpSignatureClientSnapshot,
} from "./ijp-attestation-status";

const GA_IJP = "svc-ga-ijp";
const OTHER = "svc-other";

function snapshot(partial: Partial<IjpSignatureClientSnapshot>): IjpSignatureClientSnapshot {
  return {
    client: {
      current_service_id: GA_IJP,
      archived_at: null,
      is_demo: false,
    },
    episodes: [],
    currentService: null,
    billableByMonth: {},
    hasAttestationByMonth: {},
    ...partial,
  };
}

describe("IJP signature list flag batching", () => {
  // Fixed Eastern date after the 25th so list flags can show for the current month.
  const now = new Date("2026-10-28T16:00:00.000Z");

  it("batched flags match per-client compute on fixture snapshots", () => {
    const snapshotsByClientId: Record<string, IjpSignatureClientSnapshot> = {
      "needs-flag": snapshot({
        billableByMonth: {
          "2026-10-01": [
            {
              duration_minutes: 60,
              service_activity_types: { code: "JT-ACT-001", counts_toward_client_billable: true },
            },
          ],
        },
        hasAttestationByMonth: { "2026-10-01": false },
      }),
      "has-attestation": snapshot({
        billableByMonth: {
          "2026-10-01": [
            {
              duration_minutes: 60,
              service_activity_types: { code: "JT-ACT-001", counts_toward_client_billable: true },
            },
          ],
        },
        hasAttestationByMonth: { "2026-10-01": true },
      }),
      "not-on-ijp": snapshot({
        client: {
          current_service_id: OTHER,
          archived_at: null,
          is_demo: false,
        },
        currentService: { name: "Traditional Supported Employment (GA)", state: "GA" },
        billableByMonth: {
          "2026-10-01": [
            {
              duration_minutes: 60,
              service_activity_types: { code: "JT-ACT-001", counts_toward_client_billable: true },
            },
          ],
        },
      }),
      "episode-overlap": snapshot({
        client: {
          current_service_id: OTHER,
          archived_at: null,
          is_demo: false,
        },
        currentService: { name: "Other", state: "GA" },
        episodes: [
          {
            service_id: GA_IJP,
            started_at: "2026-09-15",
            ended_at: null,
          },
        ],
        billableByMonth: {
          "2026-10-01": [
            {
              duration_minutes: 30,
              service_activity_types: { code: "JT-ACT-001", counts_toward_client_billable: true },
            },
          ],
        },
        hasAttestationByMonth: { "2026-10-01": false },
      }),
    };

    const perClient: Record<string, string> = {};
    for (const [clientId, snap] of Object.entries(snapshotsByClientId)) {
      const status = computeIjpSignatureUiStatusFromSnapshot(snap, GA_IJP, now);
      if (status?.showListFlag) perClient[clientId] = status.serviceMonthLabel;
    }

    const batched = computeIjpSignatureListFlagsFromSnapshots(snapshotsByClientId, GA_IJP, now);
    assert.deepEqual(batched, perClient);
    assert.deepEqual(Object.keys(batched).sort(), ["episode-overlap", "needs-flag"]);
    assert.equal(batched["needs-flag"], "October 2026");

    // Collect-signature affordance should also match per-client compute.
    for (const [clientId, snap] of Object.entries(snapshotsByClientId)) {
      const status = computeIjpSignatureUiStatusFromSnapshot(snap, GA_IJP, now);
      if (status?.showCollectSignature) {
        assert.equal(status.showCollectSignature, true, clientId);
      }
    }
  });
});
