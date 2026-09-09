import {
  AIR_DENSITY_KG_PER_M3,
  AMBIENT_CO2_PPM,
} from '../constants/simConstants.ts';
import type {
  Room,
  SimulationWorld,
  Zone,
} from '../domain/entities.ts';
import { parseCompanyWorld } from '../domain/schemas/company.ts';
import { workforceStateSchema } from '../domain/schemas/workforce.ts';
import type { WorkforceState } from '../domain/workforce/WorkforceState.ts';
import { createRng } from '../util/rng.ts';
import { deterministicUuid } from '../util/uuid.ts';
import { loadDemoScenarioBlueprints } from './demoScenarioBlueprints.ts';
import { createEconomyState, DEMO_STARTING_BALANCE_CC } from '../economy/state.ts';
import { createBreedingState } from '../breeding/schema.ts';

const DEMO_SCHEMA_VERSION = 'sec-0.2.1';

/* eslint-disable @typescript-eslint/no-magic-numbers -- Canonical demo geometry and neutral environmental baselines. */
const GROWROOM_AREA_M2 = 15 as const;
const ZONE_AREA_M2 = 7.5 as const;
const STORAGE_AREA_M2 = 5 as const;
const LABORATORY_AREA_M2 = 10 as const;
const BASE_TEMPERATURE_C = 22 as const;
const TEMPERATURE_VARIATION_C = 1.5 as const;
const BASE_HUMIDITY01 = 0.52 as const;
const HUMIDITY_VARIATION01 = 0.04 as const;
const DEFAULT_MOISTURE01 = 0.5 as const;
/* eslint-enable @typescript-eslint/no-magic-numbers */

/** Input accepted by the canonical `game.new.v1` demo scenario builder. */
export interface CreateDemoScenarioInput {
  /** Player-selected company name. Leading and trailing whitespace is removed. */
  readonly companyName: string;
  /** Reproducibility seed. Leading and trailing whitespace is removed. */
  readonly seed: string;
}

function requireTrimmedValue(value: string, field: keyof CreateDemoScenarioInput): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new TypeError(`${field} must be a non-empty string.`);
  }

  return trimmed;
}

function createZone(
  seed: string,
  index: number,
  heightM: number,
  temperatureC: number,
  humidity01: number,
): Zone {
  const blueprints = loadDemoScenarioBlueprints();
  const zoneNumber = index + 1;

  return {
    id: deterministicUuid(seed, `demo:zone:${String(zoneNumber)}`),
    slug: `demo-zone-${String(zoneNumber)}`,
    name: `Grow Zone ${String(zoneNumber)}`,
    floorArea_m2: ZONE_AREA_M2,
    height_m: heightM,
    cultivationMethodId: blueprints.cultivationMethod.id as Zone['cultivationMethodId'],
    irrigationMethodId: blueprints.irrigation.id as Zone['irrigationMethodId'],
    containerId: blueprints.container.id as Zone['containerId'],
    substrateId: blueprints.substrate.id as Zone['substrateId'],
    lightSchedule: { onHours: 18, offHours: 6, startHour: 0 },
    photoperiodPhase: 'vegetative',
    plants: [],
    devices: [],
    airMass_kg: ZONE_AREA_M2 * heightM * AIR_DENSITY_KG_PER_M3,
    environment: {
      airTemperatureC: temperatureC,
      relativeHumidity01: humidity01,
      co2_ppm: AMBIENT_CO2_PPM,
    },
    ppfd_umol_m2s: 0,
    dli_mol_m2d_inc: 0,
    nutrientBuffer_mg: {},
    moisture01: DEFAULT_MOISTURE01,
  } satisfies Zone;
}

function createWorkforce(structureId: SimulationWorld['company']['structures'][number]['id']): WorkforceState {
  return workforceStateSchema.parse({
    roles: [],
    employees: [],
    taskDefinitions: [],
    taskQueue: [],
    kpis: [],
    warnings: [],
    payroll: {
      dayIndex: 0,
      totals: { baseMinutes: 0, otMinutes: 0, baseCost: 0, otCost: 0, totalLaborCost: 0 },
      byStructure: [],
    },
    market: { structures: [{ structureId, scanCounter: 0, pool: [] }] },
  });
}

/**
 * Builds the canonical deterministic start world consumed by `game.new.v1`.
 * The returned world begins at simulation hour zero; pause/run state remains a façade concern
 * because it is not represented by the current {@link SimulationWorld} contract.
 */
export function createDemoScenario(input: CreateDemoScenarioInput): SimulationWorld {
  const companyName = requireTrimmedValue(input.companyName, 'companyName');
  const seed = requireTrimmedValue(input.seed, 'seed');
  const blueprints = loadDemoScenarioBlueprints();
  const environmentRng = createRng(seed, 'demo-scenario:initial-environment');
  const heightM = blueprints.structure.footprint.height_m;
  const structureId = deterministicUuid(seed, 'demo:structure');
  const temperatures = [0, 1].map(
    () => BASE_TEMPERATURE_C + environmentRng() * TEMPERATURE_VARIATION_C,
  );
  const humidities = [0, 1].map(
    () => BASE_HUMIDITY01 + environmentRng() * HUMIDITY_VARIATION01,
  );
  const zones = temperatures.map((temperatureC, index) =>
    createZone(seed, index, heightM, temperatureC, humidities[index] ?? BASE_HUMIDITY01),
  );
  const rooms: readonly Room[] = [
    {
      id: deterministicUuid(seed, 'demo:room:growroom'),
      slug: blueprints.growroom.slug,
      name: blueprints.growroom.name,
      purpose: 'growroom',
      floorArea_m2: GROWROOM_AREA_M2,
      height_m: heightM,
      zones,
      devices: [],
    },
    {
      id: deterministicUuid(seed, 'demo:room:storage'),
      slug: blueprints.storageRoom.slug,
      name: blueprints.storageRoom.name,
      purpose: 'storageroom',
      class: 'room.storage',
      tags: ['storage'],
      floorArea_m2: STORAGE_AREA_M2,
      height_m: heightM,
      zones: [],
      devices: [],
      inventory: { lots: [] },
    },
    {
      id: deterministicUuid(seed, 'demo:room:laboratory'),
      slug: blueprints.laboratory.slug,
      name: blueprints.laboratory.name,
      purpose: 'laboratory',
      floorArea_m2: LABORATORY_AREA_M2,
      height_m: heightM,
      zones: [],
      devices: [],
    },
  ];
  const company = parseCompanyWorld({
    id: deterministicUuid(seed, 'demo:company'),
    slug: 'demo-company',
    name: companyName,
    location: { lon: 9.9937, lat: 53.5511, cityName: 'Hamburg', countryName: 'Germany' },
    structures: [{
      id: structureId,
      slug: blueprints.structure.slug,
      name: `${companyName} ${blueprints.structure.name}`,
      floorArea_m2: blueprints.structure.footprint.length_m * blueprints.structure.footprint.width_m,
      height_m: heightM,
      rooms,
      devices: [],
    }],
  });

  return {
    id: deterministicUuid(seed, 'demo:world'),
    schemaVersion: DEMO_SCHEMA_VERSION,
    seed,
    simTimeHours: 0,
    scenarioId: 'game.new.v1',
    company,
    workforce: createWorkforce(structureId),
    economy: createEconomyState(DEMO_STARTING_BALANCE_CC),
    breeding: createBreedingState(),
  } satisfies SimulationWorld;
}
