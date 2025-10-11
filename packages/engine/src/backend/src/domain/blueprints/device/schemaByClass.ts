import { z } from 'zod';

import { assertNoMonetaryFields, deviceBlueprintObjectSchema } from './schemaBase.ts';
import type { DeviceEffect } from './schemaBase.ts';

const climateModeSchema = z.enum(['thermal', 'dehumidifier', 'humidity-controller', 'co2']);
const airflowSubtypeSchema = z.enum(['exhaust', 'intake', 'recirculation', 'oscillating']);
const lightingStageSchema = z.enum(['propagation', 'vegetative', 'flowering', 'full-cycle']);
const filtrationMediaSchema = z.enum(['carbon', 'hepa', 'electrostatic', 'uv']);

function ensureNestedField(
  blueprint: Record<string, unknown>,
  path: readonly (string | number)[],
  ctx: z.RefinementCtx,
  message: string
): void {
  let cursor: unknown = blueprint;

  for (const segment of path) {
    if (cursor && typeof cursor === 'object' && segment in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[segment as string];
    } else {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: [...path]
      });
      return;
    }
  }

  if (cursor === undefined || cursor === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: [...path]
    });
  }
}

type ClimateValidator = (blueprint: Record<string, unknown>, ctx: z.RefinementCtx) => void;

const climateModeValidators: Partial<Record<z.infer<typeof climateModeSchema>, ClimateValidator>> = {
  thermal: (blueprint, ctx) => {
    ensureNestedField(blueprint, ['coverage', 'maxArea_m2'], ctx, 'Thermal units require coverage.maxArea_m2.');
    ensureNestedField(blueprint, ['limits', 'coolingCapacity_kW'], ctx, 'Thermal units require limits.coolingCapacity_kW.');
    ensureNestedField(blueprint, ['settings', 'coolingCapacity'], ctx, 'Thermal units require settings.coolingCapacity.');
    ensureNestedField(
      blueprint,
      ['settings', 'targetTemperature'],
      ctx,
      'Thermal units require settings.targetTemperature.'
    );
    ensureNestedField(
      blueprint,
      ['settings', 'targetTemperatureRange'],
      ctx,
      'Thermal units require settings.targetTemperatureRange.'
    );
  },
  co2: (blueprint, ctx) => {
    ensureNestedField(blueprint, ['limits', 'maxCO2_ppm'], ctx, 'CO₂ injectors require limits.maxCO2_ppm.');
    ensureNestedField(blueprint, ['settings', 'targetCO2'], ctx, 'CO₂ injectors require settings.targetCO2.');
    ensureNestedField(blueprint, ['settings', 'pulsePpmPerTick'], ctx, 'CO₂ injectors require settings.pulsePpmPerTick.');
  },
  dehumidifier: (blueprint, ctx) => {
    ensureNestedField(
      blueprint,
      ['limits', 'removalRate_kg_h'],
      ctx,
      'Dehumidifiers require limits.removalRate_kg_h.'
    );
    ensureNestedField(
      blueprint,
      ['settings', 'latentRemovalKgPerTick'],
      ctx,
      'Dehumidifiers require settings.latentRemovalKgPerTick.'
    );
  },
  'humidity-controller': (blueprint, ctx) => {
    ensureNestedField(
      blueprint,
      ['settings', 'humidifyRateKgPerTick'],
      ctx,
      'Humidity controllers require settings.humidifyRateKgPerTick.'
    );
    ensureNestedField(
      blueprint,
      ['settings', 'dehumidifyRateKgPerTick'],
      ctx,
      'Humidity controllers require settings.dehumidifyRateKgPerTick.'
    );
  }
};

const airflowSubtypeValidators: Partial<Record<z.infer<typeof airflowSubtypeSchema>, ClimateValidator>> = {
  exhaust: (blueprint, ctx) => {
    ensureNestedField(blueprint, ['airflow_m3_per_h'], ctx, 'Exhaust fans require airflow_m3_per_h.');
    ensureNestedField(blueprint, ['settings', 'airflow'], ctx, 'Exhaust fans require settings.airflow.');
  }
};

const lightingValidators: ClimateValidator = (blueprint, ctx) => {
  ensureNestedField(blueprint, ['coverage', 'maxArea_m2'], ctx, 'Lighting devices require coverage.maxArea_m2.');
  ensureNestedField(blueprint, ['settings', 'ppfd'], ctx, 'Lighting devices require settings.ppfd.');
  ensureNestedField(blueprint, ['settings', 'spectralRange'], ctx, 'Lighting devices require settings.spectralRange.');
};

export const deviceBlueprintSchema = deviceBlueprintObjectSchema.superRefine((blueprint, ctx) => {
  assertNoMonetaryFields(blueprint, ctx);

  const effects = (blueprint.effects ?? []) as readonly DeviceEffect[];

  if (effects.includes('thermal') && !blueprint.thermal) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['thermal'],
      message: "thermal config is required when effects include 'thermal'."
    });
  }

  if (effects.includes('humidity') && !blueprint.humidity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['humidity'],
      message: "humidity config is required when effects include 'humidity'."
    });
  }

  if (effects.includes('lighting') && !blueprint.lighting) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lighting'],
      message: "lighting config is required when effects include 'lighting'."
    });
  }

  if (effects.includes('airflow') && !blueprint.airflow) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['airflow'],
      message: "airflow config is required when effects include 'airflow'."
    });
  }

  if (effects.includes('filtration') && !blueprint.filtration) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['filtration'],
      message: "filtration config is required when effects include 'filtration'."
    });
  }

  if (!blueprint.coverage_m2 && !blueprint.airflow_m3_per_h) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['coverage_m2'],
      message: 'Device blueprint must declare coverage_m2 or airflow_m3_per_h.'
    });
  }

  const validator =
    blueprint.class === 'device.climate'
      ? climateModeValidators[blueprint.mode as z.infer<typeof climateModeSchema>]
      : blueprint.class === 'device.airflow'
        ? airflowSubtypeValidators[blueprint.subtype as z.infer<typeof airflowSubtypeSchema>]
        : blueprint.class === 'device.lighting'
          ? lightingValidators
          : undefined;
  if (validator) {
    validator(blueprint, ctx);
  }

  if (blueprint.class === 'device.climate') {
    const parsedMode = climateModeSchema.safeParse(blueprint.mode);

    if (!parsedMode.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mode'],
        message:
          "mode is required for device.climate and must be one of 'thermal', 'dehumidifier', 'humidity-controller', 'co2'."
      });
    }
  } else if (blueprint.mode !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['mode'],
      message: 'mode is only supported for device.climate blueprints.'
    });
  }

  if (blueprint.class === 'device.airflow') {
    const parsedSubtype = airflowSubtypeSchema.safeParse(blueprint.subtype);

    if (!parsedSubtype.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subtype'],
        message: "subtype is required for device.airflow and must be one of 'exhaust', 'intake', 'recirculation', 'oscillating'."
      });
    }
  } else if (blueprint.subtype !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['subtype'],
      message: 'subtype is only supported for device.airflow blueprints.'
    });
  }

  if (blueprint.class === 'device.lighting') {
    const parsedStage = lightingStageSchema.safeParse(blueprint.stage);

    if (!parsedStage.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stage'],
        message: "stage is required for device.lighting and must be one of 'propagation', 'vegetative', 'flowering', 'full-cycle'."
      });
    }
  } else if (blueprint.stage !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stage'],
      message: 'stage is only supported for device.lighting blueprints.'
    });
  }

  if (blueprint.class === 'device.filtration') {
    const parsedMedia = filtrationMediaSchema.safeParse(blueprint.media);

    if (!parsedMedia.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['media'],
        message: "media is required for device.filtration and must be one of 'carbon', 'hepa', 'electrostatic', 'uv'."
      });
    }
  } else if (blueprint.media !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['media'],
      message: 'media is only supported for device.filtration blueprints.'
    });
  }
});

export type DeviceBlueprint = z.infer<typeof deviceBlueprintSchema>;
