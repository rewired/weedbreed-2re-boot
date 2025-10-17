import type { CompatibilityStatus } from "@ui/state/readModels.types";

export type ValidationStatus = CompatibilityStatus;

export interface ValidationStatusDetail {
  readonly status: ValidationStatus;
  readonly message: string | null;
}

export function createValidationStatusDetail(
  status: ValidationStatus,
  message: string | null
): ValidationStatusDetail {
  return { status, message };
}

export const VALIDATION_OK: ValidationStatusDetail = Object.freeze({
  status: "ok",
  message: null
});
