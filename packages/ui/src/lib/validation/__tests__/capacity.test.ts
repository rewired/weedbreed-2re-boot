import { describe, expect, it } from "vitest";
import { assessCapacity } from "@ui/lib/validation/capacity";

const AVAILABLE_BASE = 10;
const REQUIRED_EXCESSIVE = 15;
const AVAILABLE_NEAR_CAPACITY = 5;
const REQUIRED_NEAR_CAPACITY = 5 - 0.1;
const AVAILABLE_PLENTY = 20;
const REQUIRED_MODEST = 5;

describe("assessCapacity", () => {

  it("flags blocked status when required area exceeds availability", () => {
    const detail = assessCapacity({
      available: AVAILABLE_BASE,
      required: REQUIRED_EXCESSIVE,
      subject: "zone",
      container: "Room",
      unit: "m²"
    });

    expect(detail.status).toBe("block");
    expect(detail.message).toMatch(/Room capacity blocked/);
  });

  it("warns when remaining capacity is within one area quantum", () => {
    const detail = assessCapacity({
      available: AVAILABLE_NEAR_CAPACITY,
      required: REQUIRED_NEAR_CAPACITY,
      subject: "room",
      container: "Structure",
      unit: "m²"
    });

    expect(detail.status).toBe("warn");
  });

  it("returns ok when capacity is plentiful", () => {
    const detail = assessCapacity({
      available: AVAILABLE_PLENTY,
      required: REQUIRED_MODEST,
      subject: "room",
      container: "Structure",
      unit: "m²"
    });

    expect(detail.status).toBe("ok");
  });
});
