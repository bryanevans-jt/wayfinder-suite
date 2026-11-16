import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeIjpSignatureUiStatusFromSnapshot,
  type IjpSignatureClientSnapshot,
} from "./ijp-attestation-status";

const GA_IJP = "svc-ga-ijp";

function snapshot(partial: Partial<IjpSignatureClientSnapshot> = {}): IjpSignatureClientSnapshot {
  return {
    client: {
      current_service_id: GA_IJP,
      archived_at: null,
      is_demo: false,
    },
    episodes: [],
    currentService: null,
    billableByMonth: {
      "2026-10-01": [
        {
          duration_minutes: 60,
          service_activity_types: { code: "JT-ACT-001", counts_toward_client_billable: true },
        },
      ],
      "2026-11-01": [
        {
          duration_minutes: 30,
          service_activity_types: { code: "JT-ACT-001", counts_toward_client_billable: true },
        },
      ],
    },
    hasAttestationByMonth: {
      "2026-10-01": false,
      "2026-11-01": false,
    },
    ...partial,
  };
}

describe("grace-window attestation month preference", () => {
  it("defaults Collect to October during November grace window", () => {
    const now = new Date("2026-11-10T16:00:00.000Z");
    const status = computeIjpSignatureUiStatusFromSnapshot(snapshot(), GA_IJP, now);
    assert.ok(status);
    assert.equal(status.serviceMonth, "2026-10-01");
    assert.equal(status.serviceMonthLabel, "October 2026");
    assert.ok(status.availableMonths?.some((m) => m.serviceMonth === "2026-10-01"));
    assert.ok(status.availableMonths?.some((m) => m.serviceMonth === "2026-11-01"));
  });

  it("uses November after October grace closes", () => {
    const now = new Date("2026-11-20T16:00:00.000Z");
    const status = computeIjpSignatureUiStatusFromSnapshot(snapshot(), GA_IJP, now);
    assert.ok(status);
    assert.equal(status.serviceMonth, "2026-11-01");
  });
});
