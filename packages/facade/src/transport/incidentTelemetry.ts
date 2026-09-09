import { z } from 'zod';

/** Engine-owned topic emitted after an environmental demo incident is committed. */
export const DEMO_ENVIRONMENT_INCIDENT_TOPIC = 'telemetry.demo.environment.incident.v1';

const activeIncidentPayloadSchema = z.object({
  incidentCode: z.literal('demo.environment.temperature_high'),
  status: z.literal('active'),
  zoneId: z.string().uuid(),
  simTimeHours: z.number().finite().nonnegative(),
  measuredTemperatureC: z.number().finite(),
  targetBandC: z.object({
    minC: z.number().finite(),
    maxC: z.number().finite(),
  }),
  consequence: z.literal('plant_heat_stress'),
  recommendedIntent: z.literal('intent.zone.climate.adjust.v1'),
});

/** Identifies the authoritative post-commit incident event that must stop dev playback. */
export function shouldAutoPauseForIncident(topic: string, payload: unknown): boolean {
  return topic === DEMO_ENVIRONMENT_INCIDENT_TOPIC
    && activeIncidentPayloadSchema.safeParse(payload).success;
}
