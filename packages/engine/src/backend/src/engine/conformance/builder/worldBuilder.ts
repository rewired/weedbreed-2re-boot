import { createHash } from 'node:crypto';

import { HOURS_PER_DAY } from '@/backend/src/constants/simConstants';

import { createRng } from '../../../util/rng.ts';
import { BREAK_DURATION_MINUTES, EMPLOYEES } from '../recipes/employees.ts';
import {
  BREAK_ROOM_ID,
  COMPANY_ID,
  ROOM_RECIPES,
  STORAGE_ROOM_ID,
  STRUCTURE_ID,
} from '../recipes/rooms.ts';
import { CLIMATE_BLUEPRINT, LIGHT_BLUEPRINT, ZONE_PLANS } from '../recipes/zones.ts';
import type {
  DailyRecord,
  DailyRecordBase,
  HarvestLotRecord,
  PlantingRecord,
  ScenarioRun,
  ScenarioSummary,
  ZonePlan,
} from '../types.ts';
import { EPS_ABS, EPS_REL, computeSummaryHash, recordDailyHash } from '../verify/hashes.ts';

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

function computeHarvestYieldKg(zone: ZonePlan, cycleIndex: number, rng: () => number): number {
  const baseYieldPerM2 = 0.42;
  const methodModifier = zone.cultivationMethod.slug === 'screen-of-green' ? 1.12 : 1;
  const variation = 0.9 + rng() * 0.2;
  const productivity = zone.floorArea_m2 * baseYieldPerM2 * methodModifier * variation;
  const ageModifier = 1 - Math.min(0.1, cycleIndex * 0.015);
  return Number((productivity * ageModifier).toFixed(3));
}

export function buildGoldenScenarioRun(days: number, seed: string): ScenarioRun {
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

  const structureFloorArea = ROOM_RECIPES.reduce((area, room) => area + room.floorArea_m2, 0);
  const zoneIndex = new Map(ZONE_PLANS.map((zone, index) => [zone.id, index] as const));

  const topologySummary: ScenarioSummary['topology'] = {
    companyId: COMPANY_ID,
    structure: {
      id: STRUCTURE_ID,
      slug: 'golden-master-structure',
      floorArea_m2: structureFloorArea,
      rooms: ROOM_RECIPES.map((room) => ({
        id: room.id,
        slug: room.slug,
        purpose: room.purpose,
        floorArea_m2: room.floorArea_m2,
        height_m: room.height_m,
        zones:
          room.purpose === 'growroom'
            ? room.zones.map((zone) => {
                const index = zoneIndex.get(zone.id);

                if (index === undefined) {
                  throw new Error(`Missing zone index for ${zone.id}`);
                }

                return {
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
                    airChangesPerHour: Number(
                      adjustedAirChangesPerHourPerZone[index]?.toFixed(3) ?? '0'
                    ),
                  },
                };
              })
            : [],
      })),
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
