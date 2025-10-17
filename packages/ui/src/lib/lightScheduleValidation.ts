import { HOURS_PER_DAY, LIGHT_SCHEDULE_GRID_HOURS } from "@engine/constants/simConstants.ts";
import {
  createValidationStatusDetail,
  VALIDATION_OK,
  type ValidationStatusDetail
} from "@ui/lib/validation/types";

export interface LightScheduleInput {
  readonly onHours: number;
  readonly offHours: number;
  readonly startHour: number;
}

export interface LightScheduleValidationMessages {
  readonly sum: string;
  readonly grid: string;
  readonly start: string;
}

export interface LightScheduleValidationInput {
  readonly onHours: number | null | undefined;
  readonly offHours: number | null | undefined;
  readonly startHour: number | null | undefined;
}

export interface LightScheduleValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly schedule: LightScheduleInput | null;
  readonly status: LightScheduleValidationStatusMap;
}

export interface LightScheduleValidationStatusMap {
  readonly sum: ValidationStatusDetail;
  readonly grid: ValidationStatusDetail;
  readonly start: ValidationStatusDetail;
}

const EPSILON = 1e-6;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function snapToGrid(value: number): number {
  return Math.round(value / LIGHT_SCHEDULE_GRID_HOURS) * LIGHT_SCHEDULE_GRID_HOURS;
}

function normaliseStartHour(value: number): number {
  const wrapped = ((value % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  const snapped = snapToGrid(wrapped);
  if (snapped >= HOURS_PER_DAY - EPSILON) {
    return 0;
  }
  return snapped;
}

export function normalizeLightSchedule(input: LightScheduleInput): LightScheduleInput {
  const clampedOn = clamp(input.onHours, 0, HOURS_PER_DAY);
  const clampedOff = clamp(input.offHours, 0, HOURS_PER_DAY);

  const onHours = snapToGrid(clampedOn);
  let offHours = snapToGrid(clampedOff);

  if (Math.abs(onHours + offHours - HOURS_PER_DAY) > EPSILON) {
    offHours = snapToGrid(clamp(HOURS_PER_DAY - onHours, 0, HOURS_PER_DAY));
  }

  if (Math.abs(onHours + offHours - HOURS_PER_DAY) > EPSILON) {
    const adjustedOn = snapToGrid(clamp(HOURS_PER_DAY - offHours, 0, HOURS_PER_DAY));
    return {
      onHours: adjustedOn,
      offHours,
      startHour: normaliseStartHour(input.startHour)
    };
  }

  return {
    onHours,
    offHours,
    startHour: normaliseStartHour(input.startHour)
  };
}

function isMultipleOfGrid(value: number): boolean {
  return Math.abs(value / LIGHT_SCHEDULE_GRID_HOURS - Math.round(value / LIGHT_SCHEDULE_GRID_HOURS)) < EPSILON;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

export function validateLightScheduleInput(
  input: LightScheduleValidationInput,
  messages: LightScheduleValidationMessages
): LightScheduleValidationResult {
  const errors: string[] = [];
  let sumStatus: ValidationStatusDetail = VALIDATION_OK;
  let gridStatus: ValidationStatusDetail = VALIDATION_OK;
  let startStatus: ValidationStatusDetail = VALIDATION_OK;

  const pushError = (message: string) => {
    if (!errors.includes(message)) {
      errors.push(message);
    }
  };

  const { onHours, offHours, startHour } = input;

  const hasFiniteOn = isFiniteNumber(onHours);
  const hasFiniteOff = isFiniteNumber(offHours);
  const hasFiniteStart = isFiniteNumber(startHour);

  if (!hasFiniteOn || !hasFiniteOff) {
    pushError(messages.sum);
    sumStatus = createValidationStatusDetail("block", messages.sum);
  }

  if (hasFiniteOn && hasFiniteOff) {
    const totalHours = onHours + offHours;
    if (Math.abs(totalHours - HOURS_PER_DAY) > EPSILON) {
      pushError(messages.sum);
      sumStatus = createValidationStatusDetail("block", messages.sum);
    }
  }

  if (hasFiniteOn && !isMultipleOfGrid(onHours)) {
    pushError(messages.grid);
    gridStatus = createValidationStatusDetail("block", messages.grid);
  }

  if (hasFiniteOff && !isMultipleOfGrid(offHours)) {
    pushError(messages.grid);
    gridStatus = createValidationStatusDetail("block", messages.grid);
  }

  if (hasFiniteStart) {
    if (!isMultipleOfGrid(startHour)) {
      pushError(messages.grid);
      gridStatus = createValidationStatusDetail("block", messages.grid);
    }
    if (startHour < 0 - EPSILON || startHour > HOURS_PER_DAY - LIGHT_SCHEDULE_GRID_HOURS + EPSILON) {
      pushError(messages.start);
      startStatus = createValidationStatusDetail("block", messages.start);
    }
  } else {
    pushError(messages.start);
    startStatus = createValidationStatusDetail("block", messages.start);
  }

  if (!hasFiniteOn || !hasFiniteOff || !hasFiniteStart) {
    return { isValid: false, errors, schedule: null, status: { sum: sumStatus, grid: gridStatus, start: startStatus } };
  }

  if (errors.length > 0) {
    return { isValid: false, errors, schedule: null, status: { sum: sumStatus, grid: gridStatus, start: startStatus } };
  }

  const normalised = normalizeLightSchedule({
    onHours,
    offHours,
    startHour
  });

  if (Math.abs(normalised.onHours + normalised.offHours - HOURS_PER_DAY) > EPSILON) {
    pushError(messages.sum);
    return {
      isValid: false,
      errors,
      schedule: null,
      status: {
        sum: createValidationStatusDetail("block", messages.sum),
        grid: gridStatus,
        start: startStatus
      }
    };
  }

  if (normalised.startHour < 0 || normalised.startHour >= HOURS_PER_DAY) {
    pushError(messages.start);
    return {
      isValid: false,
      errors,
      schedule: null,
      status: {
        sum: sumStatus,
        grid: gridStatus,
        start: createValidationStatusDetail("block", messages.start)
      }
    };
  }

  return {
    isValid: errors.length === 0,
    errors,
    schedule: errors.length === 0 ? normalised : null,
    status: { sum: sumStatus, grid: gridStatus, start: startStatus }
  };
}

