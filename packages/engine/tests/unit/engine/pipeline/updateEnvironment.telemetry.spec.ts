import { describe, expect, it } from 'vitest';

import { updateEnvironment } from '@/backend/src/engine/pipeline/updateEnvironment';
import { ensureDeviceEffectsRuntime } from '@/backend/src/engine/pipeline/applyDeviceEffects';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import type { EngineRunContext } from '@/backend/src/engine/Engine';
import { TELEMETRY_ZONE_SNAPSHOT_V1 } from '@/backend/src/telemetry/topics';

interface TelemetryEvent {
  readonly topic: string;
  readonly payload: Record<string, unknown>;
}

function createTelemetryRecorder() {
  const events: TelemetryEvent[] = [];
  return {
    events,
    emit(topic: string, payload: Record<string, unknown>) {
      events.push({ topic, payload });
    },
  };
}

describe('updateEnvironment telemetry (unit)', () => {
  it('emits per-zone snapshots with derived warnings', () => {
    const world = createDemoWorld();
    const telemetry = createTelemetryRecorder();
    const ctx: EngineRunContext = { telemetry };

    const runtime = ensureDeviceEffectsRuntime(ctx);

    const structure = world.company.structures[0];
    const growRoom = structure.rooms.find((room) => room.purpose === 'growroom');
    const zone = growRoom?.zones[0];

    if (!zone) {
      throw new Error('Demo world missing primary zone.');
    }

    runtime.zoneTemperatureDeltaC.set(zone.id, 1.2);
    runtime.zoneHumidityDelta01.set(zone.id, 0.1);
    runtime.zoneCo2Delta_ppm.set(zone.id, 150);
    runtime.zonePPFD_umol_m2s.set(zone.id, 320);
    runtime.zoneDLI_mol_m2d_inc.set(zone.id, 14);
    runtime.zoneAirChangesPerHour.set(zone.id, 0.8);
    runtime.zoneCoverageEffectiveness01.set(zone.id, 0.82);

    const nextWorld = updateEnvironment(world, ctx);

    const nextStructure = nextWorld.company.structures[0];
    const nextZone = nextStructure.rooms.find((room) => room.purpose === 'growroom')?.zones[0];
    expect(nextZone?.environment.airTemperatureC).toBeCloseTo(zone.environment.airTemperatureC + 1.2, 6);
    expect(nextZone?.environment.relativeHumidity01).toBeCloseTo(zone.environment.relativeHumidity01 + 0.1, 6);
    expect(nextZone?.environment.co2_ppm).toBeCloseTo(zone.environment.co2_ppm + 150, 6);
    expect(nextZone?.ppfd_umol_m2s).toBeCloseTo(320, 6);
    expect(nextZone?.dli_mol_m2d_inc).toBeCloseTo(14, 6);

    expect(telemetry.events).toHaveLength(1);
    const [event] = telemetry.events;
    expect(event.topic).toBe(TELEMETRY_ZONE_SNAPSHOT_V1);

    const payload = event.payload as Record<string, unknown>;
    expect(payload.zoneId).toBe(zone.id);
    expect(payload.simTime).toBe(world.simTimeHours);
    expect(payload.ppfd).toBeCloseTo(320, 6);
    expect(payload.dli_incremental).toBeCloseTo(14, 6);
    expect(payload.temp_c).toBeCloseTo((zone.environment.airTemperatureC ?? 0) + 1.2, 6);
    expect(payload.rh).toBeCloseTo((zone.environment.relativeHumidity01 + 0.1) * 100, 6);
    expect(payload.co2_ppm).toBeCloseTo((zone.environment.co2_ppm ?? 0) + 150, 6);
    expect(payload.ach).toBeCloseTo(0.8, 6);

    const warnings = payload.warnings as { code: string; severity: string }[];
    expect(Array.isArray(warnings)).toBe(true);
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'zone.airflow.low', severity: 'warning' }),
        expect.objectContaining({ code: 'zone.coverage.low', severity: 'warning' }),
      ]),
    );
  });
});
