import { describe, expect, it } from "vitest";
import { HOURS_PER_DAY, LIGHT_SCHEDULE_GRID_HOURS } from "@engine/constants/simConstants.ts";
import {
  normalizeLightSchedule,
  type LightScheduleInput,
  type LightScheduleValidationMessages,
  validateLightScheduleInput
} from "@ui/lib/lightScheduleValidation";

const messages: LightScheduleValidationMessages = {
  sum: "Sum must be 24 hours.",
  grid: "Values must align to the 15-minute grid.",
  start: "Start hour must be within range."
};

const fractionalOnHours = 17.33;
const fractionalOffHours = 6.9;
const fractionalStartHour = -0.12;
const overflowStartHour = 26.5;
const invalidOnHours = 12.1;
const invalidOffHours = 11.5;
const outOfRangeStartHour = 25;
const validStartHour = 1.5;

describe("lightScheduleValidation", () => {
  it("normalizes values to the 15-minute grid and enforces a 24 hour total", () => {
    const schedule: LightScheduleInput = {
      onHours: fractionalOnHours,
      offHours: fractionalOffHours,
      startHour: fractionalStartHour
    };

    const result = normalizeLightSchedule(schedule);
    expect(result.onHours % LIGHT_SCHEDULE_GRID_HOURS).toBe(0);
    expect(result.offHours % LIGHT_SCHEDULE_GRID_HOURS).toBe(0);
    expect(result.onHours + result.offHours).toBeCloseTo(HOURS_PER_DAY, 6);
    expect(result.startHour).toBeGreaterThanOrEqual(0);
    expect(result.startHour).toBeLessThan(HOURS_PER_DAY);
  });

  it("wraps start hours beyond the daily range", () => {
    const schedule: LightScheduleInput = {
      onHours: 12,
      offHours: 12,
      startHour: overflowStartHour
    };

    const result = normalizeLightSchedule(schedule);
    expect(result.startHour).toBeGreaterThanOrEqual(0);
    expect(result.startHour).toBeLessThan(HOURS_PER_DAY);
  });

  it("rejects schedules missing required values", () => {
    const result = validateLightScheduleInput(
      { onHours: null, offHours: 6, startHour: 0 },
      messages
    );

    expect(result.isValid).toBe(false);
    expect(result.schedule).toBeNull();
    expect(result.errors).toContain(messages.sum);
  });

  it("surfaces grid and range errors when values drift off the contract", () => {
    const result = validateLightScheduleInput(
      { onHours: invalidOnHours, offHours: invalidOffHours, startHour: outOfRangeStartHour },
      messages
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([messages.grid, messages.start]));
  });

  it("returns a normalized schedule when the inputs satisfy validation", () => {
    const result = validateLightScheduleInput(
      { onHours: 18, offHours: 6, startHour: validStartHour },
      messages
    );

    expect(result.isValid).toBe(true);
    expect(result.schedule).toEqual({ onHours: 18, offHours: 6, startHour: validStartHour });
    expect(result.errors).toHaveLength(0);
  });
});

