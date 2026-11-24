import assert from "node:assert/strict";
import test from "node:test";
import {
  filterGaReferralServiceLabels,
  GA_REFERRAL_SERVICE_LABELS,
  gaServiceNameToReferralLabel,
} from "./referral-services";
import { mapReferralServiceName } from "./referral-intake";

test("GA referral labels keep existing services and append PTS options last", () => {
  assert.deepEqual([...GA_REFERRAL_SERVICE_LABELS], [
    "Workplace Readiness Training",
    "Individual Job Placement",
    "Job Coaching",
    "Traditional Supported Employment",
    "PTS Job Preparation",
    "PTS Job Placement",
  ]);
});

test("filterGaReferralServiceLabels keeps PTS services regardless of toggles", () => {
  const filtered = filterGaReferralServiceLabels(GA_REFERRAL_SERVICE_LABELS, {
    traditionalSupportedEmploymentEnabled: false,
    jobCoachingEnabled: false,
  });
  assert.ok(filtered.includes("PTS Job Preparation"));
  assert.ok(filtered.includes("PTS Job Placement"));
  assert.ok(filtered.includes("Workplace Readiness Training"));
  assert.ok(filtered.includes("Individual Job Placement"));
  assert.ok(!filtered.includes("Job Coaching"));
  assert.equal(filtered.at(-2), "PTS Job Preparation");
  assert.equal(filtered.at(-1), "PTS Job Placement");
});

test("mapReferralServiceName and gaServiceNameToReferralLabel support PTS services", () => {
  assert.equal(mapReferralServiceName("GA", "PTS Job Preparation"), "PTS Job Preparation");
  assert.equal(mapReferralServiceName("GA", "PTS Job Placement"), "PTS Job Placement");
  assert.equal(gaServiceNameToReferralLabel("PTS Job Preparation"), "PTS Job Preparation");
  assert.equal(gaServiceNameToReferralLabel("PTS Job Placement"), "PTS Job Placement");
  // Existing IJP must not be remapped through the PTS placement label.
  assert.equal(
    gaServiceNameToReferralLabel("Individual Job Placement"),
    "Individual Job Placement"
  );
});
