import { describe, expect, it } from "vitest";
import { formatCapacityPercentage, formatThroughputPercentage } from "@ui/lib/percentageFormatting";

const NEGATIVE_FRACTION = -0.4;
const ABOVE_MAX_FRACTION = 1.6;
const CAPACITY_FRACTION = 0.475;
const HALF_FRACTION = 0.5;

describe("percentageFormatting", () => {
  it("clamps throughput fractions outside the [0,1] range", () => {
    expect(formatThroughputPercentage(NEGATIVE_FRACTION)).toBe("0%");
    expect(formatThroughputPercentage(ABOVE_MAX_FRACTION)).toBe("100%");
  });

  it("formats capacity fractions using percent style with no decimals", () => {
    expect(formatCapacityPercentage(CAPACITY_FRACTION)).toBe("48%");
    expect(formatCapacityPercentage(HALF_FRACTION)).toBe("50%");
  });
});
