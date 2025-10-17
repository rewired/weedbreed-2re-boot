import { describe, expect, it } from "vitest";
import { formatRoundedNumber } from "@ui/lib/validation/rounding";

const VALUE = 12.34567;
const MINIMUM_FRACTIONS = 3;
const MAXIMUM_FRACTIONS = 5;

describe("formatRoundedNumber", () => {
  it("defaults to two decimal places in English", () => {
    expect(formatRoundedNumber(VALUE, "en-US")).toBe("12.35");
  });

  it("supports German locale formatting", () => {
    expect(formatRoundedNumber(VALUE, "de-DE")).toBe("12,35");
  });

  it("caps fractional digits at three when requested", () => {
    expect(
      formatRoundedNumber(VALUE, "en-US", {
        minimumFractionDigits: MINIMUM_FRACTIONS,
        maximumFractionDigits: MAXIMUM_FRACTIONS
      })
    ).toBe("12.346");
  });
});
