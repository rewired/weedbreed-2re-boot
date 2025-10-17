import { describe, expect, it } from "vitest";
import { deterministicReadModelSnapshot } from "@ui/test-utils/readModelFixtures";
import { assessCultivationIrrigation, assessStrainCompatibility } from "@ui/lib/validation/compatibility";

const compatibility = deterministicReadModelSnapshot.compatibility;
const CULTIVATION_ID = "cm-sea-of-green";
const IRRIGATION_OK = "ir-drip-inline";
const IRRIGATION_BLOCKED = "ir-ebb-flow";
const STRAIN_ID = "strain-northern-lights";

describe("compatibility validation", () => {
  it("reports ok statuses for valid cultivation and irrigation pairs", () => {
    const assessment = assessCultivationIrrigation({
      compatibility,
      cultivationMethodId: CULTIVATION_ID,
      irrigationMethodId: IRRIGATION_OK
    });

    expect(assessment.cultivation.status).toBe("ok");
    expect(assessment.irrigation.status).toBe("ok");
  });

  it("blocks unsupported irrigation selections", () => {
    const assessment = assessCultivationIrrigation({
      compatibility,
      cultivationMethodId: CULTIVATION_ID,
      irrigationMethodId: IRRIGATION_BLOCKED
    });

    expect(assessment.irrigation.status).toBe("block");
    expect(assessment.irrigation.message).toMatch(/incompatible/);
  });

  it("derives strain compatibility statuses for cultivation and irrigation", () => {
    const assessment = assessStrainCompatibility({
      compatibility,
      strainId: STRAIN_ID,
      cultivationMethodId: CULTIVATION_ID,
      irrigationMethodId: IRRIGATION_OK
    });

    expect(assessment.cultivation.status).toBeTypeOf("string");
    expect(["ok", "warn", "block"]).toContain(assessment.irrigation.status);
  });
});
