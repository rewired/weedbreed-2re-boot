import { describe, expect, it } from 'vitest';
import { initializeFacade } from '../../../src/index.ts';
import { createReadModelProviders } from '../../../src/server/readModelProviders.ts';
import { createDeterministicWorld } from '@wb/facade/backend/deterministicWorldLoader';
import { EPS_REL, ROOM_DEFAULT_HEIGHT_M } from '@engine/constants/simConstants.js';
import expectations from '../../resources/readModelHydrationExpectations.json' with { type: 'json' };

type StructureCoverage = Record<string, readonly [number, number, number, number]>;
type ZoneExpectation = readonly [string, number, number, number, number, number, number];
interface SeedExpectation {
  readonly structureCoverage: StructureCoverage;
  readonly growRooms: Record<string, { readonly ach: number; readonly zones: readonly ZoneExpectation[] }>;
  readonly economy: readonly [number, number, number, number, number, number, number];
  readonly workforce: {
    readonly headcount: number;
    readonly roles: readonly [number, number, number];
    readonly morale: readonly number[];
    readonly fatigue: readonly number[];
    readonly nextShift: readonly number[];
  };
}
const HYDRATION_EXPECTATIONS = expectations as Record<string, SeedExpectation>;
function expectApproximately(actual: number, expected: number): void {
  const scale = Math.max(1, Math.abs(expected));
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(EPS_REL * scale);
}

describe('read-model hydration determinism — Task 5150', () => {
  for (const [seed, expected] of Object.entries(HYDRATION_EXPECTATIONS)) {
    it(`produces deterministic metrics for ${seed}`, async () => {
      const { world, companyWorld } = createDeterministicWorld({ seed });
      const { engineConfig } = initializeFacade({ scenarioId: seed, verbose: false, world: companyWorld });
      const providers = createReadModelProviders({ world, companyWorld, config: engineConfig });
      const [snapshot, workforceView, companyTree, tariffs] = await Promise.all([
        providers.readModels(),
        providers.workforceView(),
        providers.companyTree(),
        providers.structureTariffs()
      ]);
      expect(snapshot.structures).toHaveLength(Object.keys(expected.structureCoverage).length);
      expect(companyTree.structures).toHaveLength(snapshot.structures.length);

      for (const [structureName, coverage] of Object.entries(expected.structureCoverage)) {
        const structureSnapshot = snapshot.structures.find((structure) => structure.name === structureName);
        expect(structureSnapshot).toBeDefined();
        if (!structureSnapshot) {
          throw new Error(`Missing structure snapshot for ${structureName}`);
        }

        expectApproximately(structureSnapshot.coverage.lightingCoverage01, coverage[0]!);
        expectApproximately(structureSnapshot.coverage.hvacCapacity01, coverage[1]!);
        expectApproximately(structureSnapshot.coverage.airflowAch, coverage[2]!);
        expect(structureSnapshot.coverage.warnings).toHaveLength(coverage[3]!);
        const structureTree = companyTree.structures.find((structure) => structure.name === structureName);
        expect(structureTree).toBeDefined();
        if (!structureTree) {
          throw new Error(`Missing company tree node for ${structureName}`);
        }
        const growExpectation = expected.growRooms[structureName];
        if (growExpectation) {
          const growRoomSnapshot = structureSnapshot.rooms.find((room) => room.purpose === 'growroom');
          expect(growRoomSnapshot).toBeDefined();
          if (!growRoomSnapshot) {
            throw new Error(`Growroom snapshot missing for ${structureName}`);
          }
          expectApproximately(growRoomSnapshot.climateSnapshot.ach, growExpectation.ach);
          const growRoomTree = structureTree.rooms.find((room) => room.name === growRoomSnapshot.name);
          expect(growRoomTree).toBeDefined();
          if (!growRoomTree) {
            throw new Error(`Growroom tree node missing for ${structureName}`);
          }
          const expectedZones = [...growExpectation.zones].sort((left, right) => left[0]!.localeCompare(right[0]!));
          const actualZones = [...growRoomSnapshot.zones]
            .map((zone) => ({
              name: zone.name,
              area_m2: zone.area_m2,
              temperature_C: zone.climateSnapshot.temperature_C,
              relativeHumidity_percent: zone.climateSnapshot.relativeHumidity_percent,
              vpd_kPa: zone.climateSnapshot.vpd_kPa,
              ach_measured: zone.climateSnapshot.ach_measured,
              coverageWarnings: zone.coverageWarnings.length,
              tree: growRoomTree.zones.find((node) => node.name === zone.name)
            }))
            .sort((left, right) => left.name.localeCompare(right.name));

          expect(actualZones).toHaveLength(expectedZones.length);
          for (let index = 0; index < expectedZones.length; index += 1) {
            const expectedZone = expectedZones[index]!;
            const actualZone = actualZones[index]!;
            expect(actualZone.name).toBe(expectedZone[0]);
            expectApproximately(actualZone.area_m2, expectedZone[1]!);
            expectApproximately(actualZone.temperature_C, expectedZone[2]!);
            expect(actualZone.relativeHumidity_percent).toBe(expectedZone[3]);
            expectApproximately(actualZone.vpd_kPa, expectedZone[4]!);
            expectApproximately(actualZone.ach_measured, expectedZone[5]!);
            expect(actualZone.coverageWarnings).toBe(expectedZone[6]);
            expect(actualZone.tree).toBeDefined();
            const zoneTree = actualZone.tree;
            if (!zoneTree) {
              throw new Error(`Zone tree missing for ${structureName} ${actualZone.name}`);
            }
            expectApproximately(zoneTree.area_m2, expectedZone[1]!);
            expectApproximately(zoneTree.volume_m3, expectedZone[1]! * ROOM_DEFAULT_HEIGHT_M);
          }
        }
      }
      const [labour, utilities, operating, deltaHour, deltaDay, priceElectricity, priceWater] = expected.economy;
      expectApproximately(snapshot.economy.labourCostPerHour, labour);
      expectApproximately(snapshot.economy.utilitiesCostPerHour, utilities);
      expectApproximately(snapshot.economy.operatingCostPerHour, operating);
      expectApproximately(snapshot.economy.deltaPerHour, deltaHour);
      expectApproximately(snapshot.economy.deltaPerDay, deltaDay);
      expectApproximately(snapshot.economy.tariffs.price_electricity, priceElectricity);
      expectApproximately(snapshot.economy.tariffs.price_water, priceWater);
      expectApproximately(tariffs.electricity_kwh_price, priceElectricity);
      expectApproximately(tariffs.water_m3_price, priceWater);

      expect(workforceView.headcount).toBe(expected.workforce.headcount);
      expect(workforceView.roles.gardener).toBe(expected.workforce.roles[0]);
      expect(workforceView.roles.technician).toBe(expected.workforce.roles[1]);
      expect(workforceView.roles.janitor).toBe(expected.workforce.roles[2]);

      const actualMorale = [...workforceView.roster].map((entry) => entry.morale01).sort((a, b) => a - b);
      const actualFatigue = [...workforceView.roster].map((entry) => entry.fatigue01).sort((a, b) => a - b);
      const actualNextShift = [...workforceView.roster]
        .map((entry) => entry.nextShiftStartTick ?? 0)
        .sort((a, b) => a - b);

      expect(actualMorale).toHaveLength(expected.workforce.morale.length);
      expect(actualFatigue).toHaveLength(expected.workforce.fatigue.length);
      expect(actualNextShift).toEqual(expected.workforce.nextShift);
      for (let index = 0; index < expected.workforce.morale.length; index += 1) {
        expectApproximately(actualMorale[index]!, expected.workforce.morale[index]!);
        expectApproximately(actualFatigue[index]!, expected.workforce.fatigue[index]!);
      }
    });
  }
});
