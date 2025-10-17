import type { CompatibilityMaps } from "@ui/state/readModels.types";
import { createValidationStatusDetail, VALIDATION_OK, type ValidationStatusDetail } from "@ui/lib/validation/types";

export interface CultivationIrrigationInput {
  readonly compatibility: CompatibilityMaps;
  readonly cultivationMethodId: string;
  readonly irrigationMethodId: string;
}

export interface CultivationIrrigationAssessment {
  readonly cultivation: ValidationStatusDetail;
  readonly irrigation: ValidationStatusDetail;
}

export interface StrainCompatibilityInput {
  readonly compatibility: CompatibilityMaps;
  readonly strainId: string;
  readonly cultivationMethodId: string;
  readonly irrigationMethodId: string;
}

export interface StrainCompatibilityAssessment {
  readonly cultivation: ValidationStatusDetail;
  readonly irrigation: ValidationStatusDetail;
}

function resolveStatusDetail(
  status: "ok" | "warn" | "block",
  okMessage: string,
  warnMessage: string,
  blockMessage: string
): ValidationStatusDetail {
  switch (status) {
    case "ok":
      return VALIDATION_OK;
    case "warn":
      return createValidationStatusDetail("warn", warnMessage);
    default:
      return createValidationStatusDetail("block", blockMessage);
  }
}

export function assessCultivationIrrigation(
  input: CultivationIrrigationInput
): CultivationIrrigationAssessment {
  const { compatibility, cultivationMethodId, irrigationMethodId } = input;
  const irrigationMap = Object.hasOwn(compatibility.cultivationToIrrigation, cultivationMethodId)
    ? compatibility.cultivationToIrrigation[cultivationMethodId]
    : undefined;

  if (!irrigationMap) {
    return {
      cultivation: createValidationStatusDetail(
        "block",
        "Cultivation method unavailable: no irrigation compatibility defined."
      ),
      irrigation: createValidationStatusDetail(
        "block",
        "Irrigation method is incompatible with the selected cultivation method."
      )
    };
  }

  const irrigationStatus = irrigationMap[irrigationMethodId] ?? "block";
  const availableStatuses = Object.values(irrigationMap);
  const cultivationStatus = availableStatuses.includes("ok")
    ? "ok"
    : availableStatuses.includes("warn")
      ? "warn"
      : "block";

  return {
    cultivation: resolveStatusDetail(
      cultivationStatus,
      "Cultivation method compatible.",
      "Cultivation method has partial irrigation coverage.",
      "Cultivation method unavailable for selection."
    ),
    irrigation: resolveStatusDetail(
      irrigationStatus,
      "Irrigation method compatible.",
      "Irrigation method may require adjustments.",
      "Irrigation method is incompatible with the selected cultivation method."
    )
  };
}

export function assessStrainCompatibility(
  input: StrainCompatibilityInput
): StrainCompatibilityAssessment {
  const { compatibility, strainId, cultivationMethodId, irrigationMethodId } = input;
  const strainEntry = Object.hasOwn(compatibility.strainToCultivation, strainId)
    ? compatibility.strainToCultivation[strainId]
    : undefined;

  if (!strainEntry) {
    return {
      cultivation: createValidationStatusDetail(
        "block",
        "Strain compatibility data unavailable."
      ),
      irrigation: createValidationStatusDetail(
        "block",
        "Strain irrigation compatibility missing."
      )
    };
  }

  const cultivationStatus = strainEntry.cultivation[cultivationMethodId] ?? "block";
  const irrigationStatus = strainEntry.irrigation[irrigationMethodId] ?? "block";

  return {
    cultivation: resolveStatusDetail(
      cultivationStatus,
      "Strain compatible with cultivation method.",
      "Strain may experience reduced performance with cultivation method.",
      "Selected strain is incompatible with the zone's cultivation method."
    ),
    irrigation: resolveStatusDetail(
      irrigationStatus,
      "Strain compatible with irrigation method.",
      "Strain may require irrigation adjustments.",
      "Selected strain is incompatible with the zone's irrigation method."
    )
  };
}
