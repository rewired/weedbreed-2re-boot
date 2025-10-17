import { AREA_QUANTUM_M2 } from "@engine/constants/simConstants.ts";
import { formatRoundedNumber } from "@ui/lib/validation/rounding";
import type { SupportedLocale } from "@ui/lib/locale";
import { createValidationStatusDetail, VALIDATION_OK, type ValidationStatusDetail } from "@ui/lib/validation/types";

const DEFAULT_LOCALE: SupportedLocale = "en-US";
const EPSILON = 1e-6;

export interface CapacityAssessmentInput {
  readonly available: number;
  readonly required: number;
  readonly subject: string;
  readonly container: string;
  readonly unit: "m²" | "m³";
  readonly locale?: SupportedLocale;
}

export function assessCapacity(input: CapacityAssessmentInput): ValidationStatusDetail {
  const { available, required, subject, container, unit } = input;
  const locale = input.locale ?? DEFAULT_LOCALE;

  if (!Number.isFinite(required) || required <= 0) {
    return createValidationStatusDetail("block", `${subject} must request a positive ${unit} value.`);
  }

  if (!Number.isFinite(available) || available < 0) {
    return createValidationStatusDetail("block", `${container} capacity unavailable for ${subject}.`);
  }

  const deficit = required - available;

  if (deficit > EPSILON) {
    const formattedRequired = formatRoundedNumber(required, locale, { maximumFractionDigits: 2 });
    const formattedAvailable = formatRoundedNumber(available, locale, { maximumFractionDigits: 2 });
    return createValidationStatusDetail(
      "block",
      `${container} capacity blocked: ${subject} requires ${formattedRequired} ${unit} but only ${formattedAvailable} ${unit} free.`
    );
  }

  if (deficit > -AREA_QUANTUM_M2) {
    const formattedAvailable = formatRoundedNumber(available, locale, { maximumFractionDigits: 2 });
    return createValidationStatusDetail(
      "warn",
      `${container} capacity nearly saturated: ${formattedAvailable} ${unit} remaining.`
    );
  }

  return VALIDATION_OK;
}
