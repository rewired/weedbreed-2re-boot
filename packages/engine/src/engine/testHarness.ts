import {
  EPS_ABS,
  EPS_REL,
  HOURS_PER_DAY,
  HOURS_PER_TICK,
  PIPELINE_PHASES,
  type PipelinePhase,
} from '../constants/simConstants.js';
import { hashCanonical } from '../util/hash.js';
import { createRng } from '../util/rng.js';

export interface LightSchedule {
  onHours: number;
  offHours: number;
  startHour: number;
}

export interface LightingProfile {
  powerOn_kW: number;
  powerStandby_kW: number;
  heatToZoneFactor: number;
}

export interface IrrigationPlan {
  hours: number[];
  waterRate_m3_per_h: number;
}

export interface GrowthModel {
  onRate_kg_per_h: number;
  offRate_kg_per_h: number;
  jitter_kg_per_h: number;
  initialBiomass_kg: number;
}

export interface HarvestPlan {
  cycleDays: number;
  harvestThreshold_kg: number;
  yieldPerHarvest_kg: number;
}

export interface MaintenancePlan {
  windowHours: number[];
  tasksPerWindow: number;
  jitterTasks: number;
}

export interface ZoneSeed {
  id: string;
  name: string;
  area_m2: number;
  cultivationMethodId: string;
  lightSchedule: LightSchedule;
  lighting: LightingProfile;
  irrigation: IrrigationPlan;
  growth: GrowthModel;
  harvest: HarvestPlan;
  maintenance: MaintenancePlan;
}

export interface RoomSeed {
  id: string;
  name: string;
  purpose: 'growroom' | string;
  zones: ZoneSeed[];
}

export interface StructureSeed {
  id: string;
  name: string;
  rooms: RoomSeed[];
}

export interface Tariffs {
  price_electricity: number;
  price_water: number;
}

export interface WorldSeed {
  schemaVersion: string;
  seed: string;
  simTime: number;
  notes?: string;
  company: {
    id: string;
    name: string;
  };
  structures: StructureSeed[];
  tariffs: Tariffs;
}

export interface SimulationOptions {
  days: number;
  seed: string;
  world: WorldSeed;
}

export interface DailyTotals extends Record<string, number> {
  energy_kWh: number;
  water_m3: number;
  biomassGain_kg: number;
  heatLoad_kWh: number;
  harvestYield_kg: number;
  cost_electricity: number;
  cost_water: number;
  cost_total: number;
}

export interface DailyEvents extends Record<string, number> {
  harvests: number;
  irrigationEvents: number;
  maintenanceTasks: number;
}

export interface DailyReport {
  day: number;
  totals: DailyTotals;
  events: DailyEvents;
  hash: string;
}

export interface SimulationSummary {
  metadata: {
    days: number;
    ticks: number;
    schemaVersion: string;
    worldSeed: string;
  };
  totals: DailyTotals;
  events: DailyEvents;
}

export interface SimulationResult {
  daily: DailyReport[];
  summary: SimulationSummary;
}

interface ZoneRuntime {
  zone: ZoneSeed;
  roomPurpose: string;
  rng: () => number;
  maintenanceRng: () => number;
}

interface ZoneState {
  biomass_kg: number;
}

const NUMBER_PRECISION = 9;

function formatNumber(value: number): number {
  return Number(value.toFixed(NUMBER_PRECISION));
}

function isLightOn(schedule: LightSchedule, hour: number): boolean {
  const normalizedStart = ((schedule.startHour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  const offset = ((hour - normalizedStart) % HOURS_PER_DAY + HOURS_PER_DAY) % HOURS_PER_DAY;
  return offset < schedule.onHours;
}

function assertTolerance(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Non-finite numeric value for ${label}`);
  }
  if (Math.abs(value) > 1e6) {
    throw new Error(`Unexpected magnitude for ${label}: ${value}`);
  }
}

function ensureGrowroom(room: RoomSeed): void {
  if (room.purpose !== 'growroom' && room.zones.length > 0) {
    throw new Error(`Room ${room.id} has purpose ${room.purpose} but hosts zones; zones are restricted to growrooms.`);
  }
}

export function runDeterministic(options: SimulationOptions): SimulationResult {
  const { days, seed, world } = options;
  if (days <= 0) {
    throw new Error('Simulation length must be positive.');
  }

  const tariffs = { ...world.tariffs } satisfies Tariffs;
  assertTolerance(tariffs.price_electricity, 'tariffs.price_electricity');
  assertTolerance(tariffs.price_water, 'tariffs.price_water');

  const structures = world.structures ?? [];
  if (structures.length === 0) {
    throw new Error('World seed must include at least one structure.');
  }

  const zoneRuntimes: ZoneRuntime[] = [];
  for (const structure of structures) {
    for (const room of structure.rooms) {
      ensureGrowroom(room);
      for (const zone of room.zones) {
        zoneRuntimes.push({
          zone,
          roomPurpose: room.purpose,
          rng: createRng(seed, `zone:${zone.id}:growth`),
          maintenanceRng: createRng(seed, `zone:${zone.id}:maintenance`),
        });
      }
    }
  }

  if (zoneRuntimes.length === 0) {
    throw new Error('World seed must include at least one zone.');
  }

  const zoneStates = new Map<string, ZoneState>();
  for (const runtime of zoneRuntimes) {
    zoneStates.set(runtime.zone.id, {
      biomass_kg: runtime.zone.growth.initialBiomass_kg,
    });
  }

  const dailyReports: DailyReport[] = [];
  const totals: DailyTotals = {
    energy_kWh: 0,
    water_m3: 0,
    biomassGain_kg: 0,
    heatLoad_kWh: 0,
    harvestYield_kg: 0,
    cost_electricity: 0,
    cost_water: 0,
    cost_total: 0,
  };
  const totalEvents: DailyEvents = {
    harvests: 0,
    irrigationEvents: 0,
    maintenanceTasks: 0,
  };

  const totalTicks = days * HOURS_PER_DAY;
  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const dayTotals: DailyTotals = {
      energy_kWh: 0,
      water_m3: 0,
      biomassGain_kg: 0,
      heatLoad_kWh: 0,
      harvestYield_kg: 0,
      cost_electricity: 0,
      cost_water: 0,
      cost_total: 0,
    };
    const dayEvents: DailyEvents = {
      harvests: 0,
      irrigationEvents: 0,
      maintenanceTasks: 0,
    };

    const lightStatus = new Map<string, boolean>();

    for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
      for (const phase of PIPELINE_PHASES) {
        processPhase({
          phase,
          hour,
          dayIndex,
          zoneRuntimes,
          zoneStates,
          lightStatus,
          dayTotals,
          dayEvents,
          totals,
        });
      }
    }

    dayTotals.cost_electricity = formatNumber(dayTotals.energy_kWh * tariffs.price_electricity);
    dayTotals.cost_water = formatNumber(dayTotals.water_m3 * tariffs.price_water);
    dayTotals.cost_total = formatNumber(dayTotals.cost_electricity + dayTotals.cost_water);

    totals.cost_electricity = formatNumber(totals.cost_electricity + dayTotals.cost_electricity);
    totals.cost_water = formatNumber(totals.cost_water + dayTotals.cost_water);
    totals.cost_total = formatNumber(totals.cost_total + dayTotals.cost_total);

    totalEvents.harvests += dayEvents.harvests;
    totalEvents.irrigationEvents += dayEvents.irrigationEvents;
    totalEvents.maintenanceTasks += dayEvents.maintenanceTasks;

    const dailyReport: DailyReport = {
      day: dayIndex + 1,
      totals: {
        energy_kWh: formatNumber(dayTotals.energy_kWh),
        water_m3: formatNumber(dayTotals.water_m3),
        biomassGain_kg: formatNumber(dayTotals.biomassGain_kg),
        heatLoad_kWh: formatNumber(dayTotals.heatLoad_kWh),
        harvestYield_kg: formatNumber(dayTotals.harvestYield_kg),
        cost_electricity: formatNumber(dayTotals.cost_electricity),
        cost_water: formatNumber(dayTotals.cost_water),
        cost_total: formatNumber(dayTotals.cost_total),
      },
      events: { ...dayEvents },
      hash: '',
    };

    dailyReport.hash = hashCanonical({
      day: dailyReport.day,
      totals: dailyReport.totals,
      events: dailyReport.events,
    });

    dailyReports.push(dailyReport);
  }

  const summary: SimulationSummary = {
    metadata: {
      days,
      ticks: totalTicks,
      schemaVersion: world.schemaVersion,
      worldSeed: world.seed,
    },
    totals: {
      energy_kWh: formatNumber(totals.energy_kWh),
      water_m3: formatNumber(totals.water_m3),
      biomassGain_kg: formatNumber(totals.biomassGain_kg),
      heatLoad_kWh: formatNumber(totals.heatLoad_kWh),
      harvestYield_kg: formatNumber(totals.harvestYield_kg),
      cost_electricity: formatNumber(totals.cost_electricity),
      cost_water: formatNumber(totals.cost_water),
      cost_total: formatNumber(totals.cost_total),
    },
    events: { ...totalEvents },
  };

  return { daily: dailyReports, summary };
}

interface PhaseContext {
  phase: PipelinePhase;
  hour: number;
  dayIndex: number;
  zoneRuntimes: ZoneRuntime[];
  zoneStates: Map<string, ZoneState>;
  lightStatus: Map<string, boolean>;
  dayTotals: DailyTotals;
  dayEvents: DailyEvents;
  totals: DailyTotals;
}

function processPhase(context: PhaseContext): void {
  const {
    phase,
    hour,
    dayIndex,
    zoneRuntimes,
    zoneStates,
    lightStatus,
    dayTotals,
    dayEvents,
    totals,
  } = context;

  switch (phase) {
    case 'Initialization':
      return;
    case 'EnvironmentControl':
      for (const runtime of zoneRuntimes) {
        const lightOn = isLightOn(runtime.zone.lightSchedule, hour);
        lightStatus.set(runtime.zone.id, lightOn);
        const power = lightOn ? runtime.zone.lighting.powerOn_kW : runtime.zone.lighting.powerStandby_kW;
        const energy = power * HOURS_PER_TICK;
        const heat = energy * runtime.zone.lighting.heatToZoneFactor;
        dayTotals.energy_kWh += energy;
        totals.energy_kWh += energy;
        dayTotals.heatLoad_kWh += heat;
        totals.heatLoad_kWh += heat;
      }
      return;
    case 'IrrigationAndFeeding':
      for (const runtime of zoneRuntimes) {
        if (runtime.zone.irrigation.hours.includes(hour)) {
          const water = runtime.zone.irrigation.waterRate_m3_per_h * HOURS_PER_TICK;
          dayTotals.water_m3 += water;
          totals.water_m3 += water;
          dayEvents.irrigationEvents += 1;
        }
      }
      return;
    case 'Physiology':
      for (const runtime of zoneRuntimes) {
        const state = zoneStates.get(runtime.zone.id);
        if (!state) {
          throw new Error(`Missing runtime state for zone ${runtime.zone.id}`);
        }
        const lightOn = lightStatus.get(runtime.zone.id) ?? false;
        const baseGrowth = (lightOn ? runtime.zone.growth.onRate_kg_per_h : runtime.zone.growth.offRate_kg_per_h) * HOURS_PER_TICK;
        const jitter = (runtime.rng() - 0.5) * runtime.zone.growth.jitter_kg_per_h;
        const growth = baseGrowth + jitter;
        state.biomass_kg += growth;
        dayTotals.biomassGain_kg += growth;
        totals.biomassGain_kg += growth;
      }
      return;
    case 'Maintenance':
      for (const runtime of zoneRuntimes) {
        if (runtime.zone.maintenance.windowHours.includes(hour)) {
          const base = runtime.zone.maintenance.tasksPerWindow;
          const jitter = Math.round((runtime.maintenanceRng() - 0.5) * runtime.zone.maintenance.jitterTasks);
          const tasks = Math.max(0, base + jitter);
          dayEvents.maintenanceTasks += tasks;
        }
      }
      return;
    case 'HarvestAndProcessing':
      if (hour !== HOURS_PER_DAY - 1) {
        return;
      }
      for (const runtime of zoneRuntimes) {
        const state = zoneStates.get(runtime.zone.id);
        if (!state) {
          throw new Error(`Missing runtime state for zone ${runtime.zone.id}`);
        }
        const harvestPlan = runtime.zone.harvest;
        const dayNumber = dayIndex + 1;
        const shouldHarvest = dayNumber % harvestPlan.cycleDays === 0 && state.biomass_kg >= harvestPlan.harvestThreshold_kg;
        if (shouldHarvest) {
          const yieldKg = Math.min(harvestPlan.yieldPerHarvest_kg, state.biomass_kg);
          state.biomass_kg -= yieldKg;
          dayTotals.harvestYield_kg += yieldKg;
          totals.harvestYield_kg += yieldKg;
          dayEvents.harvests += 1;
        }
      }
      return;
    case 'Economy':
      return;
    case 'Telemetry':
    case 'Commit':
      return;
    default:
      return;
  }
}

export function approximatelyEqual(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  if (diff <= EPS_ABS) {
    return true;
  }
  const largest = Math.max(1, Math.abs(a), Math.abs(b));
  return diff <= EPS_REL * largest;
}
