import { z } from 'zod';

import { breedingStateSchema } from '../../breeding/schema.ts';
import { economyStateSchema } from '../../economy/state.ts';
import type { SimulationWorld } from '../entities.ts';
import { companySchema } from './company.ts';
import { finiteNumber, nonEmptyString, uuidSchema } from './primitives.ts';
import { workforceStateSchema } from './workforce.ts';

const healthStateSchema = z.object({
  pestDisease: z.object({
    zoneRisks: z.array(z.object({
      zoneId: uuidSchema,
      roomId: uuidSchema,
      structureId: uuidSchema,
      risk01: finiteNumber.min(0).max(1),
      riskLevel: z.enum(['low', 'moderate', 'high']),
      hygieneScore01: finiteNumber.min(0).max(1),
      updatedTick: z.number().int().nonnegative(),
      lastInspectionTick: z.number().int().nonnegative().optional(),
      lastTreatmentTick: z.number().int().nonnegative().optional(),
      quarantineUntilTick: z.number().int().nonnegative().optional(),
    }).strict()).readonly(),
    hygieneSignals: z.array(z.object({
      roomId: uuidSchema,
      hygieneScore01: finiteNumber.min(0).max(1),
      updatedTick: z.number().int().nonnegative(),
    }).strict()).readonly(),
  }).strict(),
}).strict();

const demoIncidentSchema = z.object({
  code: z.literal('demo.environment.temperature_high'),
  zoneId: uuidSchema,
  status: z.enum(['active', 'resolved']),
  triggeredAtSimTimeHours: finiteNumber.nonnegative(),
  resolvedAtSimTimeHours: finiteNumber.nonnegative().optional(),
  measuredTemperatureC: finiteNumber,
  targetBandC: z.tuple([finiteNumber, finiteNumber]).readonly(),
  consequence: z.literal('plant_heat_stress'),
  recommendedIntent: z.literal('intent.zone.climate.adjust.v1'),
}).strict().refine((incident) => incident.targetBandC[0] < incident.targetBandC[1], {
  message: 'Incident target band must be ordered.',
  path: ['targetBandC'],
});

/** Complete persisted engine world. Transport state and derived read models are forbidden. */
export const simulationWorldSchema: z.ZodType<SimulationWorld, z.ZodTypeDef, unknown> = z.object({
  id: uuidSchema,
  schemaVersion: nonEmptyString,
  seed: nonEmptyString,
  simTimeHours: finiteNumber.nonnegative(),
  scenarioId: z.literal('game.new.v1').optional(),
  company: companySchema,
  workforce: workforceStateSchema,
  health: healthStateSchema.optional(),
  demoIncident: demoIncidentSchema.optional(),
  economy: economyStateSchema.optional(),
  breeding: breedingStateSchema.optional(),
}).strict();

/** Parses a complete save-safe simulation world. */
export function parseSimulationWorld(input: unknown): SimulationWorld {
  return simulationWorldSchema.parse(input);
}
