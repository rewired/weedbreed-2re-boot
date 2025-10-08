import { createHash } from 'node:crypto';

import safeStringify from 'safe-stable-stringify';

import ledVegLightBlueprint from '../../../../../../../data/blueprints/device/lighting/led-veg-light-600.json' with { type: 'json' };
import coolAirSplitBlueprint from '../../../../../../../data/blueprints/device/climate/cool-air-split-3000.json' with { type: 'json' };
import dripInlineFertigationBlueprint from '../../../../../../../data/blueprints/irrigation/drip-inline-fertigation-basic.json' with { type: 'json' };
import ebbFlowTableBlueprint from '../../../../../../../data/blueprints/irrigation/ebb-flow-table-small.json' with { type: 'json' };
import manualWateringBlueprint from '../../../../../../../data/blueprints/irrigation/manual-watering-can.json' with { type: 'json' };
import topFeedPumpBlueprint from '../../../../../../../data/blueprints/irrigation/top-feed-pump-timer.json' with { type: 'json' };
import pot10LBlueprint from '../../../../../../../data/blueprints/container/pot-10l.json' with { type: 'json' };
import pot11LBlueprint from '../../../../../../../data/blueprints/container/pot-11l.json' with { type: 'json' };
import pot25LBlueprint from '../../../../../../../data/blueprints/container/pot-25l.json' with { type: 'json' };
import soilSingleCycleBlueprint from '../../../../../../../data/blueprints/substrate/soil-single-cycle.json' with { type: 'json' };
import soilMultiCycleBlueprint from '../../../../../../../data/blueprints/substrate/soil-multi-cycle.json' with { type: 'json' };
import cocoCoirBlueprint from '../../../../../../../data/blueprints/substrate/coco-coir.json' with { type: 'json' };
import seaOfGreenBlueprint from '../../../../../../../data/blueprints/cultivation-method/sea-of-green.json' with { type: 'json' };
import screenOfGreenBlueprint from '../../../../../../../data/blueprints/cultivation-method/screen-of-green.json' with { type: 'json' };
import basicSoilPotBlueprint from '../../../../../../../data/blueprints/cultivation-method/basic-soil-pot.json' with { type: 'json' };
import ak47Strain from '../../../../../../../data/blueprints/strain/ak47.json' with { type: 'json' };
import sourDieselStrain from '../../../../../../../data/blueprints/strain/sour-diesel.json' with { type: 'json' };
import whiteWidowStrain from '../../../../../../../data/blueprints/strain/white-widow.json' with { type: 'json' };
import northernLightsStrain from '../../../../../../../data/blueprints/strain/northern-lights.json' with { type: 'json' };
import skunk1Strain from '../../../../../../../data/blueprints/strain/skunk-1.json' with { type: 'json' };

import { createRng } from '../../util/rng.js';
import type { RoomPurpose } from '../../domain/entities.js';

const HOURS_PER_DAY = 24;
const BREAK_DURATION_MINUTES = 30;
const BREAK_ROOM_ID = '8c3c2f06-6c5a-4f36-8f43-52a6901c1d3a';
const STORAGE_ROOM_ID = 'c4545aab-8e71-4d39-bb3c-e9c5ce3d6f56';
const GROW_ROOM_ID = '7f43b718-86bd-4dc6-92f4-01a08357b6f4';
const STRUCTURE_ID = '1c6c5e04-0d0c-4c59-b7d3-dfb2f548f8a8';
const COMPANY_ID = '5d1f24be-9565-4e50-956b-16d4f557c6df';

const EPS_ABS = 1e-9;
const EPS_REL = 1e-6;

interface BlueprintLite {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

interface LightingBlueprint extends BlueprintLite {
  readonly coverage_m2: number;
  readonly allowedRoomPurposes: readonly RoomPurpose[];
  readonly placementScope: string;
}

interface ClimateBlueprint extends BlueprintLite {
  readonly airflow_m3_per_h: number;
  readonly placementScope: string;
  readonly allowedRoomPurposes: readonly RoomPurpose[];
}

interface CultivationBlueprint extends BlueprintLite {
  readonly technique: string;
  readonly meta?: {
    readonly defaults?: {
      readonly containerSlug?: string;
      readonly substrateSlug?: string;
    };
  };
}

interface IrrigationBlueprint extends BlueprintLite {
  readonly method?: string;
  readonly control?: string;
}

interface ContainerBlueprint extends BlueprintLite {
  readonly volumeInLiters: number;
  readonly footprintArea: number;
}

interface SubstrateBlueprint extends BlueprintLite {
  readonly purchaseUnit: string;
  readonly unitPrice_per_L?: number;
  readonly unitPrice_per_kg?: number;
  readonly densityFactor_L_per_kg?: number;
  readonly densityFactor_kg_per_L?: number;
}

interface StrainBlueprint extends BlueprintLite {
  readonly floweringTime_days?: number;
  readonly photoperiod?: Record<string, unknown>;
}

interface ZonePlan {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly floorArea_m2: number;
  readonly height_m: number;
  readonly strain: StrainBlueprint;
  readonly cultivationMethod: CultivationBlueprint;
  readonly container: ContainerBlueprint;
  readonly substrate: SubstrateBlueprint;
  readonly irrigation: IrrigationBlueprint;
  readonly firstHarvestDay: number;
  readonly cycleLengthDays: number;
}

interface EmployeePlan {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly role: 'grower' | 'trimmer' | 'janitor';
  readonly shiftHours: number;
}

interface HarvestLotRecord {
  readonly id: string;
  readonly zoneId: string;
  readonly strainSlug: string;
  readonly harvestDay: number;
  readonly storedAtDay: number;
  readonly mass_kg: number;
}

export interface PlantingRecord {
  readonly zoneId: string;
  readonly day: number;
  readonly plantId: string;
}

interface DailyRecordBase {
  readonly day: number;
  readonly events: {
    readonly total: number;
    readonly harvest: number;
    readonly storageTransfer: number;
    readonly replant: number;
    readonly workforceBreakStart: number;
    readonly workforceBreakEnd: number;
    readonly janitorial: {
      readonly storage: number;
      readonly breakroom: number;
    };
  };
  readonly workforce: {
    readonly breaks: readonly {
      readonly employeeId: string;
      readonly roomId: string;
      readonly startHour: number;
      readonly durationMinutes: number;
    }[];
    readonly janitorial: readonly {
      readonly employeeId: string;
      readonly roomId: string;
      readonly task: 'cleaning';
      readonly hour: number;
    }[];
  };
  readonly inventory: {
    readonly createdLots: readonly string[];
    readonly movedToStorage: readonly string[];
    readonly storageLotIds: readonly string[];
  };
}

export interface DailyRecord extends DailyRecordBase {
  readonly hash: string;
}

export interface ScenarioSummary {
  readonly schemaVersion: string;
  readonly tolerances: {
    readonly abs: number;
    readonly rel: number;
  };
  readonly run: {
    readonly seed: string;
    readonly days: number;
    readonly ticks: number;
    readonly structureId: string;
  };
  readonly topology: {
    readonly companyId: string;
    readonly structure: {
      readonly id: string;
      readonly slug: string;
      readonly floorArea_m2: number;
      readonly rooms: readonly {
        readonly id: string;
        readonly slug: string;
        readonly purpose: 'growroom' | 'storageroom' | 'breakroom';
        readonly floorArea_m2: number;
        readonly height_m: number;
        readonly zones: readonly {
          readonly id: string;
          readonly slug: string;
          readonly strainSlug: string;
          readonly cultivationMethodSlug: string;
          readonly lighting: {
            readonly blueprintId: string;
            readonly count: number;
            readonly coverageRatio: number;
          };
          readonly climate: {
            readonly blueprintId: string;
            readonly count: number;
            readonly airChangesPerHour: number;
          };
        }[];
      }[];
    };
  };
  readonly lifecycle: {
    readonly zones: readonly {
      readonly zoneId: string;
      readonly harvests: number;
      readonly replants: number;
      readonly cycleLengthDays: number;
      readonly firstHarvestDay: number;
      readonly lastHarvestDay: number | null;
    }[];
    readonly replants: readonly PlantingRecord[];
  };
  readonly inventory: {
    readonly totalLots: number;
    readonly lots: readonly HarvestLotRecord[];
  };
  readonly workforce: {
    readonly employees: readonly EmployeePlan[];
    readonly breakCompliance: readonly {
      readonly employeeId: string;
      readonly breaksTaken: number;
      readonly required: number;
      readonly rooms: readonly string[];
    }[];
    readonly janitorialCoverage: {
      readonly storageRoomDays: readonly number[];
      readonly breakroomDays: readonly number[];
    };
  };
  readonly events: {
    readonly totals: {
      readonly harvest: number;
      readonly storageTransfer: number;
      readonly replant: number;
      readonly breakStart: number;
      readonly breakEnd: number;
      readonly janitorial: number;
    };
    readonly averagePerDay: number;
  };
  readonly hash: string;
}

export interface ScenarioRun {
  readonly summary: ScenarioSummary;
  readonly daily: readonly DailyRecord[];
}

const LIGHT_BLUEPRINT = ledVegLightBlueprint as LightingBlueprint;
const CLIMATE_BLUEPRINT = coolAirSplitBlueprint as ClimateBlueprint;
const CULTIVATION_BLUEPRINTS = [
  seaOfGreenBlueprint,
  screenOfGreenBlueprint,
  basicSoilPotBlueprint,
] as readonly CultivationBlueprint[];
const CONTAINER_BLUEPRINTS = [
  pot10LBlueprint,
  pot11LBlueprint,
  pot25LBlueprint,
] as readonly ContainerBlueprint[];
const SUBSTRATE_BLUEPRINTS = [
  soilSingleCycleBlueprint,
  soilMultiCycleBlueprint,
  cocoCoirBlueprint,
] as readonly SubstrateBlueprint[];
const IRRIGATION_BLUEPRINTS = [
  dripInlineFertigationBlueprint,
  ebbFlowTableBlueprint,
  manualWateringBlueprint,
  topFeedPumpBlueprint,
] as readonly IrrigationBlueprint[];
const STRAIN_BLUEPRINTS = [
  whiteWidowStrain,
  sourDieselStrain,
  northernLightsStrain,
  ak47Strain,
  skunk1Strain,
] as readonly StrainBlueprint[];

function requireBlueprint<T extends BlueprintLite>(
  list: readonly T[],
  slug: string,
  kind: string
): T {
  const blueprint = list.find((entry) => entry.slug === slug);

  if (!blueprint) {
    throw new Error(`Missing ${kind} blueprint for slug "${slug}".`);
  }

  return blueprint;
}

const ZONE_PLANS: readonly ZonePlan[] = [
  {
    id: 'a4be1f8d-63b7-4f08-9dcb-61e3f6b5bdc0',
    slug: 'zone-1',
    name: 'North Canopy',
    floorArea_m2: 20,
    height_m: 3,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'white-widow', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'sea-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-11l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'coco-coir', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'drip-inline-fertigation-basic', 'irrigation'),
    firstHarvestDay: 24,
    cycleLengthDays: 56,
  },
  {
    id: 'b1c8c08a-850a-4d85-bd3b-aed02716f6d1',
    slug: 'zone-2',
    name: 'East Bench',
    floorArea_m2: 20,
    height_m: 3,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'sour-diesel', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'screen-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-25l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'soil-multi-cycle', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'top-feed-pump-timer', 'irrigation'),
    firstHarvestDay: 26,
    cycleLengthDays: 63,
  },
  {
    id: 'c9b641d0-5f66-4f43-a16d-4695e07d54d3',
    slug: 'zone-3',
    name: 'Central Trellis',
    floorArea_m2: 20,
    height_m: 3,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'northern-lights', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'basic-soil-pot', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-10l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'soil-single-cycle', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'manual-watering-can', 'irrigation'),
    firstHarvestDay: 28,
    cycleLengthDays: 52,
  },
  {
    id: 'd2d7410f-7d68-4fb0-8a42-221d787600f1',
    slug: 'zone-4',
    name: 'West Bench',
    floorArea_m2: 20,
    height_m: 3,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'ak47', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'screen-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-25l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'soil-multi-cycle', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'ebb-flow-table-small', 'irrigation'),
    firstHarvestDay: 30,
    cycleLengthDays: 60,
  },
  {
    id: 'e84a23d8-9d3e-49d6-a1c6-261e7f4bb9b2',
    slug: 'zone-5',
    name: 'South Canopy',
    floorArea_m2: 20,
    height_m: 3,
    strain: requireBlueprint(STRAIN_BLUEPRINTS, 'skunk-1', 'strain'),
    cultivationMethod: requireBlueprint(CULTIVATION_BLUEPRINTS, 'sea-of-green', 'cultivation method'),
    container: requireBlueprint(CONTAINER_BLUEPRINTS, 'pot-11l', 'container'),
    substrate: requireBlueprint(SUBSTRATE_BLUEPRINTS, 'coco-coir', 'substrate'),
    irrigation: requireBlueprint(IRRIGATION_BLUEPRINTS, 'drip-inline-fertigation-basic', 'irrigation'),
    firstHarvestDay: 32,
    cycleLengthDays: 58,
  },
];

const EMPLOYEES: readonly EmployeePlan[] = [
  {
    id: '3ce46ea4-5524-4cd0-b7f2-9e5b6f0a6f41',
    slug: 'lead-grower',
    name: 'Lead Grower',
    role: 'grower',
    shiftHours: 8,
  },
  {
    id: '7f20f2f2-bd0c-48ae-b30a-8c0807f67641',
    slug: 'post-harvest-tech',
    name: 'Post Harvest Tech',
    role: 'trimmer',
    shiftHours: 8,
  },
  {
    id: 'a20958ae-f0e8-4e41-b391-2a8ea56f4baf',
    slug: 'facility-janitor',
    name: 'Facility Janitor',
    role: 'janitor',
    shiftHours: 8,
  },
];

function deterministicUuid(seed: string): string {
  const digest = createHash('sha256').update(seed).digest('hex');
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    digest.slice(12, 16),
    digest.slice(16, 20),
    digest.slice(20, 32),
  ].join('-');
}

function computeLightingCount(area_m2: number, coverage_m2: number): number {
  return Math.ceil(area_m2 / coverage_m2);
}

function computeCoverageRatio(area_m2: number, coverage_m2: number, count: number): number {
  return (coverage_m2 * count) / area_m2;
}

function computeClimateCount(volume_m3: number, airflow_m3_per_h: number): number {
  return Math.ceil(volume_m3 / airflow_m3_per_h);
}

function computeAirChangesPerHour(
  volume_m3: number,
  airflow_m3_per_h: number,
  count: number
): number {
  return (airflow_m3_per_h * count) / volume_m3;
}

function computeHarvestYieldKg(
  zone: ZonePlan,
  cycleIndex: number,
  rng: () => number
): number {
  const baseYieldPerM2 = 0.42;
  const methodModifier = zone.cultivationMethod.slug === 'screen-of-green' ? 1.12 : 1;
  const variation = 0.9 + rng() * 0.2;
  const productivity = zone.floorArea_m2 * baseYieldPerM2 * methodModifier * variation;
  const ageModifier = 1 - Math.min(0.1, cycleIndex * 0.015);
  return Number((productivity * ageModifier).toFixed(3));
}

function recordDailyHash(payload: DailyRecordBase): string {
  const canonical = safeStringify(payload);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function computeSummaryHash(summary: Omit<ScenarioSummary, 'hash'>, daily: readonly DailyRecord[]): string {
  const canonical = safeStringify({ summary, daily });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 24);
}

export function generateGoldenScenarioRun(days: number, seed: string): ScenarioRun {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('days must be a positive finite number');
  }

  if (!seed) {
    throw new Error('seed must be provided');
  }

  const lightingCountPerZone = ZONE_PLANS.map((zone) =>
    computeLightingCount(zone.floorArea_m2, LIGHT_BLUEPRINT.coverage_m2)
  );
  const lightingCoveragePerZone = lightingCountPerZone.map((count, index) =>
    computeCoverageRatio(
      ZONE_PLANS[index]?.floorArea_m2 ?? 0,
      LIGHT_BLUEPRINT.coverage_m2,
      count
    )
  );
  const climateCountPerZone = ZONE_PLANS.map((zone) =>
    computeClimateCount(zone.floorArea_m2 * zone.height_m, CLIMATE_BLUEPRINT.airflow_m3_per_h)
  );
  const adjustedAirChangesPerHourPerZone = climateCountPerZone.map((count, index) => {
    const zone = ZONE_PLANS[index];

    if (!zone) {
      return 0;
    }

    const volume = zone.floorArea_m2 * zone.height_m;
    return computeAirChangesPerHour(volume, CLIMATE_BLUEPRINT.airflow_m3_per_h, count);
  });

  const harvestLots: HarvestLotRecord[] = [];
  const replants: PlantingRecord[] = [];
  const dailyRecords: DailyRecord[] = [];
  const storageLotIds: string[] = [];
  const janitorialStorageDays = new Set<number>();
  const janitorialBreakroomDays = new Set<number>();

  const zoneRngs = new Map<string, () => number>();
  const replantSchedule = new Map<number, PlantingRecord[]>();

  for (const zone of ZONE_PLANS) {
    zoneRngs.set(zone.id, createRng(seed, `golden:zone:${zone.id}`));
  }

  for (let day = 1; day <= days; day += 1) {
    const createdLots: string[] = [];
    const movedToStorage: string[] = [];
    let harvestEvents = 0;
    let storageTransfers = 0;
    let replantEvents = 0;
    const workforceBreaks: DailyRecord['workforce']['breaks'] = [];
    const workforceJanitorial: DailyRecord['workforce']['janitorial'] = [];

    for (const employee of EMPLOYEES) {
      if (employee.shiftHours >= 8) {
        workforceBreaks.push({
          employeeId: employee.id,
          roomId: BREAK_ROOM_ID,
          startHour: 4,
          durationMinutes: BREAK_DURATION_MINUTES,
        });
      }
    }

    const janitor = EMPLOYEES.find((employee) => employee.role === 'janitor');

    if (janitor) {
      if (day % 7 === 0) {
        workforceJanitorial.push({
          employeeId: janitor.id,
          roomId: STORAGE_ROOM_ID,
          task: 'cleaning',
          hour: 6,
        });
        janitorialStorageDays.add(day);
      }

      if (day % 14 === 0) {
        workforceJanitorial.push({
          employeeId: janitor.id,
          roomId: BREAK_ROOM_ID,
          task: 'cleaning',
          hour: 7,
        });
        janitorialBreakroomDays.add(day);
      }
    }

    const scheduledReplants = replantSchedule.get(day) ?? [];

    if (scheduledReplants.length > 0) {
      replantSchedule.delete(day);

      for (const replant of scheduledReplants) {
        replants.push(replant);
        replantEvents += 1;
      }
    }

    for (const zone of ZONE_PLANS) {
      const cycleLength = zone.cycleLengthDays;
      const firstHarvest = zone.firstHarvestDay;

      if (day < firstHarvest) {
        continue;
      }

      if ((day - firstHarvest) % cycleLength === 0) {
        const cycleIndex = Math.floor((day - firstHarvest) / cycleLength);
        const zoneRng = zoneRngs.get(zone.id);

        if (!zoneRng) {
          throw new Error(`Missing RNG for zone ${zone.id}`);
        }

        harvestEvents += 1;

        const yieldKg = computeHarvestYieldKg(zone, cycleIndex, zoneRng);
        const lotId = deterministicUuid(`lot:${zone.id}:${day}:${cycleIndex}`);
        const lotRecord: HarvestLotRecord = {
          id: lotId,
          zoneId: zone.id,
          strainSlug: zone.strain.slug,
          harvestDay: day,
          storedAtDay: day,
          mass_kg: yieldKg,
        };

        harvestLots.push(lotRecord);
        createdLots.push(lotId);
        movedToStorage.push(lotId);
        storageTransfers += 1;

        if (!storageLotIds.includes(lotId)) {
          storageLotIds.push(lotId);
        }

        const plantId = deterministicUuid(`plant:${zone.id}:${day}:${cycleIndex}`);
        const replantDay = day + 1;

        if (replantDay <= days) {
          const replantRecord: PlantingRecord = {
            zoneId: zone.id,
            day: replantDay,
            plantId,
          };

          const bucket = replantSchedule.get(replantDay);

          if (bucket) {
            bucket.push(replantRecord);
          } else {
            replantSchedule.set(replantDay, [replantRecord]);
          }
        }
      }
    }

    const storageSnapshot = [...storageLotIds].sort();

    const totalEvents =
      harvestEvents +
      storageTransfers +
      replantEvents +
      workforceBreaks.length * 2 +
      workforceJanitorial.length;

    const baseRecord: DailyRecordBase = {
      day,
      events: {
        total: totalEvents,
        harvest: harvestEvents,
        storageTransfer: storageTransfers,
        replant: replantEvents,
        workforceBreakStart: workforceBreaks.length,
        workforceBreakEnd: workforceBreaks.length,
        janitorial: {
          storage: workforceJanitorial.filter((entry) => entry.roomId === STORAGE_ROOM_ID).length,
          breakroom: workforceJanitorial.filter((entry) => entry.roomId === BREAK_ROOM_ID).length,
        },
      },
      workforce: {
        breaks: workforceBreaks,
        janitorial: workforceJanitorial,
      },
      inventory: {
        createdLots,
        movedToStorage,
        storageLotIds: storageSnapshot,
      },
    };

    const hash = recordDailyHash(baseRecord);
    dailyRecords.push({ ...baseRecord, hash });
  }

  const lifecycleSummary = ZONE_PLANS.map((zone) => {
    const zoneHarvests = harvestLots.filter((lot) => lot.zoneId === zone.id);
    const zoneReplants = replants.filter((record) => record.zoneId === zone.id);
    return {
      zoneId: zone.id,
      harvests: zoneHarvests.length,
      replants: zoneReplants.length,
      cycleLengthDays: zone.cycleLengthDays,
      firstHarvestDay: zone.firstHarvestDay,
      lastHarvestDay:
        zoneHarvests.length > 0 ? zoneHarvests[zoneHarvests.length - 1]?.harvestDay ?? null : null,
    };
  });

  const breakCompliance = EMPLOYEES.map((employee) => {
    const breaksTaken = dailyRecords.reduce((count, day) => {
      return (
        count +
        day.workforce.breaks.filter(
          (entry) => entry.employeeId === employee.id && entry.roomId === BREAK_ROOM_ID
        ).length
      );
    }, 0);

    const rooms = Array.from(
      new Set(
        dailyRecords
          .flatMap((record) => record.workforce.breaks)
          .filter((entry) => entry.employeeId === employee.id)
          .map((entry) => entry.roomId)
      )
    );

    return {
      employeeId: employee.id,
      breaksTaken,
      required: days,
      rooms,
    };
  });

  const totals = dailyRecords.reduce(
    (acc, day) => {
      acc.harvest += day.events.harvest;
      acc.storageTransfer += day.events.storageTransfer;
      acc.replant += day.events.replant;
      acc.breakStart += day.events.workforceBreakStart;
      acc.breakEnd += day.events.workforceBreakEnd;
      acc.janitorial += day.events.janitorial.storage + day.events.janitorial.breakroom;
      return acc;
    },
    {
      harvest: 0,
      storageTransfer: 0,
      replant: 0,
      breakStart: 0,
      breakEnd: 0,
      janitorial: 0,
    }
  );

  const topologySummary: ScenarioSummary['topology'] = {
    companyId: COMPANY_ID,
    structure: {
      id: STRUCTURE_ID,
      slug: 'golden-master-structure',
      floorArea_m2: 140,
      rooms: [
        {
          id: GROW_ROOM_ID,
          slug: 'grow-room',
          purpose: 'growroom',
          floorArea_m2: 100,
          height_m: 3,
          zones: ZONE_PLANS.map((zone, index) => ({
            id: zone.id,
            slug: zone.slug,
            strainSlug: zone.strain.slug,
            cultivationMethodSlug: zone.cultivationMethod.slug,
            lighting: {
              blueprintId: LIGHT_BLUEPRINT.id,
              count: lightingCountPerZone[index],
              coverageRatio: Number(lightingCoveragePerZone[index]?.toFixed(3) ?? '0'),
            },
            climate: {
              blueprintId: CLIMATE_BLUEPRINT.id,
              count: climateCountPerZone[index],
              airChangesPerHour: Number(adjustedAirChangesPerHourPerZone[index]?.toFixed(3) ?? '0'),
            },
          })),
        },
        {
          id: STORAGE_ROOM_ID,
          slug: 'storage-room',
          purpose: 'storageroom',
          floorArea_m2: 20,
          height_m: 3,
          zones: [],
        },
        {
          id: BREAK_ROOM_ID,
          slug: 'break-room',
          purpose: 'breakroom',
          floorArea_m2: 20,
          height_m: 3,
          zones: [],
        },
      ],
    },
  };

  const totalEventsAcrossDays = dailyRecords.reduce((sum, day) => sum + day.events.total, 0);

  const summaryWithoutHash: Omit<ScenarioSummary, 'hash'> = {
    schemaVersion: 'sec-0.2.1',
    tolerances: {
      abs: EPS_ABS,
      rel: EPS_REL,
    },
    run: {
      seed,
      days,
      ticks: days * HOURS_PER_DAY,
      structureId: STRUCTURE_ID,
    },
    topology: topologySummary,
    lifecycle: {
      zones: lifecycleSummary,
      replants,
    },
    inventory: {
      totalLots: harvestLots.length,
      lots: harvestLots,
    },
    workforce: {
      employees: EMPLOYEES,
      breakCompliance,
      janitorialCoverage: {
        storageRoomDays: Array.from(janitorialStorageDays).sort((a, b) => a - b),
        breakroomDays: Array.from(janitorialBreakroomDays).sort((a, b) => a - b),
      },
    },
    events: {
      totals,
      averagePerDay: Number((totalEventsAcrossDays / days).toFixed(3)),
    },
  };

  const hash = computeSummaryHash(summaryWithoutHash, dailyRecords);

  return {
    summary: { ...summaryWithoutHash, hash },
    daily: dailyRecords,
  } satisfies ScenarioRun;
}
