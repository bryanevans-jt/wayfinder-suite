import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeServicesForSelect,
  displayServiceCatalogName,
  INDIVIDUAL_JOB_PLACEMENT_DISPLAY_NAME,
  isIndividualJobPlacementServiceName,
  serviceDisplayName,
} from "./service-display";

describe("Individual Job Placement identity", () => {
  it("treats IJP / bare / (GA) as the same service", () => {
    assert.equal(isIndividualJobPlacementServiceName("IJP"), true);
    assert.equal(isIndividualJobPlacementServiceName("Individual Job Placement"), true);
    assert.equal(isIndividualJobPlacementServiceName("Individual Job Placement (GA)"), true);
    assert.equal(isIndividualJobPlacementServiceName("Individual Job Placement (IJP)"), true);
    assert.equal(isIndividualJobPlacementServiceName("Job Coaching (GA)"), false);
  });

  it("displays every IJP variant as Individual Job Placement with no (GA)", () => {
    assert.equal(
      displayServiceCatalogName("Individual Job Placement (GA)"),
      INDIVIDUAL_JOB_PLACEMENT_DISPLAY_NAME
    );
    assert.equal(
      displayServiceCatalogName("Individual Job Placement"),
      INDIVIDUAL_JOB_PLACEMENT_DISPLAY_NAME
    );
    assert.equal(displayServiceCatalogName("IJP"), INDIVIDUAL_JOB_PLACEMENT_DISPLAY_NAME);
    assert.equal(
      serviceDisplayName({
        id: "1",
        name: "Individual Job Placement (GA)",
        state: "GA",
      }),
      INDIVIDUAL_JOB_PLACEMENT_DISPLAY_NAME
    );
  });

  it("dedupes IJP rows into a single dropdown option without (GA)", () => {
    const options = dedupeServicesForSelect([
      { id: "bare", name: "Individual Job Placement", state: "GA" },
      { id: "ga", name: "Individual Job Placement (GA)", state: "GA" },
      { id: "wrt", name: "Workplace Readiness Training (GA)", state: "GA" },
    ]);
    const ijp = options.filter((o) => o.name === INDIVIDUAL_JOB_PLACEMENT_DISPLAY_NAME);
    assert.equal(ijp.length, 1);
    assert.equal(ijp[0]?.name.includes("(GA)"), false);
    assert.ok(options.some((o) => o.name.includes("Workplace Readiness")));
  });
});
