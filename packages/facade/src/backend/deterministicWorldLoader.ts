/* eslint-disable wb-sim/no-ts-import-js-extension */
import { createRng, parseCompanyWorld, type Employee, type EmployeeRole, type ParsedCompanyWorld, type SimulationWorld, type Uuid, type WorkforceState, type WorkforceTaskDefinition } from '@wb/engine';
import { HOURS_PER_DAY } from '@engine/constants/time.js';
import { AMBIENT_CO2_PPM, ROOM_DEFAULT_HEIGHT_M } from '@engine/constants/simConstants.js';
import { parseContainerBlueprint } from '@/backend/src/domain/blueprints/containerBlueprint.ts';
import { parseCultivationMethodBlueprint } from '@/backend/src/domain/blueprints/cultivationMethodBlueprint.ts';
import { parseDeviceBlueprint, toDeviceInstanceCapacity } from '@/backend/src/domain/blueprints/device/parse.ts';
import { parseIrrigationBlueprint } from '@/backend/src/domain/blueprints/irrigationBlueprint.ts';
import { parsePersonnelRoleBlueprint } from '@/backend/src/domain/blueprints/personnelBlueprint.ts';
import { parseStructureBlueprint } from '@/backend/src/domain/blueprints/structureBlueprint.ts';
import { parseSubstrateBlueprint } from '@/backend/src/domain/blueprints/substrateBlueprint.ts';
import { parseCultivationMethodPriceMap } from '@/backend/src/domain/pricing/cultivationMethodPriceMap.ts';
import { parseDevicePriceMap } from '@/backend/src/domain/pricing/devicePriceMap.ts';
import { createDeviceInstance as seedDeviceAttributes } from '@/backend/src/device/createDeviceInstance.ts';
import { deterministicUuid, deterministicUuidV7 } from '@/backend/src/util/uuid.ts';
import smallWarehouseJson from '../../../../data/blueprints/structure/small-warehouse.json' with { type: 'json' };
import mediumWarehouseJson from '../../../../data/blueprints/structure/medium-warehouse.json' with { type: 'json' };
import seaOfGreenJson from '../../../../data/blueprints/cultivation-method/sea-of-green.json' with { type: 'json' };
import screenOfGreenJson from '../../../../data/blueprints/cultivation-method/screen-of-green.json' with { type: 'json' };
import pot11Json from '../../../../data/blueprints/container/pot-11l.json' with { type: 'json' };
import pot25Json from '../../../../data/blueprints/container/pot-25l.json' with { type: 'json' };
import cocoCoirJson from '../../../../data/blueprints/substrate/coco-coir.json' with { type: 'json' };
import soilMultiJson from '../../../../data/blueprints/substrate/soil-multi-cycle.json' with { type: 'json' };
import soilSingleJson from '../../../../data/blueprints/substrate/soil-single-cycle.json' with { type: 'json' };
import dripJson from '../../../../data/blueprints/irrigation/drip-inline-fertigation-basic.json' with { type: 'json' };
import manualJson from '../../../../data/blueprints/irrigation/manual-watering-can.json' with { type: 'json' };
import lightJson from '../../../../data/blueprints/device/lighting/led-veg-light-600.json' with { type: 'json' };
import climateJson from '../../../../data/blueprints/device/climate/cool-air-split-3000.json' with { type: 'json' };
import exhaustJson from '../../../../data/blueprints/device/airflow/exhaust-fan-4-inch.json' with { type: 'json' };
import humidityJson from '../../../../data/blueprints/device/climate/humidity-control-unit-l1.json' with { type: 'json' };
import devicePricesJson from '../../../../data/prices/devicePrices.json' with { type: 'json' };
import cultivationPricesJson from '../../../../data/prices/cultivationMethodPrices.json' with { type: 'json' };
import gardenerJson from '../../../../data/blueprints/personnel/role/gardener.json' with { type: 'json' };
import technicianJson from '../../../../data/blueprints/personnel/role/technician.json' with { type: 'json' };
import workforceTasksJson from '../../../../data/configs/task_definitions.json' with { type: 'json' };
import firstNamesFemaleJson from '../../../../data/personnel/names/firstNamesFemale.json' with { type: 'json' };
import firstNamesMaleJson from '../../../../data/personnel/names/firstNamesMale.json' with { type: 'json' };
import lastNamesJson from '../../../../data/personnel/names/lastNames.json' with { type: 'json' };
import traitsJson from '../../../../data/personnel/traits.json' with { type: 'json' };
const SCHEMA_VERSION = 'sec-0.2.1';
const DEFAULT_SEED = 'deterministic-world';
const MAINTENANCE_RESTORE01 = 0.35;
const MAINTENANCE_THRESHOLD01 = 0.4;
const STRUCTURE_BLUEPRINTS = { small: parseStructureBlueprint(smallWarehouseJson), medium: parseStructureBlueprint(mediumWarehouseJson) } as const;
const CULTIVATION_BLUEPRINTS = { sog: parseCultivationMethodBlueprint(seaOfGreenJson), scrog: parseCultivationMethodBlueprint(screenOfGreenJson) } as const;
const CONTAINER_BLUEPRINTS = { pot11: parseContainerBlueprint(pot11Json), pot25: parseContainerBlueprint(pot25Json) } as const;
const SUBSTRATE_BLUEPRINTS = {
  coco: parseSubstrateBlueprint(cocoCoirJson),
  soil: parseSubstrateBlueprint(soilMultiJson),
  soilSingle: parseSubstrateBlueprint(soilSingleJson),
} as const;
const SUBSTRATE_SLUGS = Object.values(SUBSTRATE_BLUEPRINTS).map((blueprint) => blueprint.slug);
const IRRIGATION_BLUEPRINTS = {
  drip: parseIrrigationBlueprint(dripJson, { knownSubstrateSlugs: SUBSTRATE_SLUGS }),
  manual: parseIrrigationBlueprint(manualJson, { knownSubstrateSlugs: SUBSTRATE_SLUGS }),
} as const;
const DEVICE_BLUEPRINTS = { light: parseDeviceBlueprint(lightJson), climate: parseDeviceBlueprint(climateJson), exhaust: parseDeviceBlueprint(exhaustJson), humidity: parseDeviceBlueprint(humidityJson) } as const;
const DEVICE_PRICE_MAP = parseDevicePriceMap(devicePricesJson).devicePrices as Record<string, ReturnType<typeof parseDevicePriceMap>['devicePrices'][string]>;
const CULTIVATION_PRICE_MAP = parseCultivationMethodPriceMap(cultivationPricesJson).cultivationMethodPrices;
type ZoneTuple = [slug: string, area: number, method: keyof typeof CULTIVATION_BLUEPRINTS, irrigation: keyof typeof IRRIGATION_BLUEPRINTS, container: keyof typeof CONTAINER_BLUEPRINTS, substrate: keyof typeof SUBSTRATE_BLUEPRINTS, devices: (keyof typeof DEVICE_BLUEPRINTS)[], schedule: [on: number, off: number, start: number], phase: 'vegetative' | 'flowering', temperatureC: number, humidity01: number];
const STRUCTURE_DATA: readonly { blueprint: keyof typeof STRUCTURE_BLUEPRINTS; slug: string; nameSuffix: string; zones: readonly ZoneTuple[]; auxiliary: readonly string[] }[] = [
  { blueprint: 'small', slug: 'alpha-facility', nameSuffix: 'Alpha', zones: [ ['veg-a', 180, 'sog', 'drip', 'pot11', 'coco', ['light', 'climate'], [18, 6, 0], 'vegetative', 24, 0.58], ['veg-b', 140, 'scrog', 'manual', 'pot25', 'soil', ['light', 'exhaust'], [12, 12, 6], 'flowering', 22, 0.52] ], auxiliary: ['breakroom', 'storageroom'] },
  { blueprint: 'medium', slug: 'beta-facility', nameSuffix: 'Beta', zones: [ ['flower-a', 240, 'scrog', 'drip', 'pot11', 'coco', ['light', 'humidity'], [12, 12, 0], 'flowering', 25, 0.5] ], auxiliary: ['laboratory', 'storageroom'] },
];
const ROLE_BLUEPRINTS = { gardener: parsePersonnelRoleBlueprint(gardenerJson), technician: parsePersonnelRoleBlueprint(technicianJson) } as const;
const WORKFORCE_ROLES = [toEmployeeRole('gardener'), toEmployeeRole('technician')] as const;
const ROLE_BY_SLUG = new Map(WORKFORCE_ROLES.map((role) => [role.slug, role]));
const WORKFORCE_TASKS = Object.entries(workforceTasksJson as Record<string, Omit<WorkforceTaskDefinition, 'taskCode'>>).map(([taskCode, definition]) => ({ taskCode, ...definition })) as WorkforceTaskDefinition[];
const FEMALE_NAMES = firstNamesFemaleJson as readonly string[], MALE_NAMES = firstNamesMaleJson as readonly string[], LAST_NAMES = lastNamesJson as readonly string[], TRAITS = traitsJson as readonly { id: string }[];
const EMPLOYEE_DATA = [ ['gardener', 0], ['technician', 0], ['gardener', 1] ] as const;
type RoleSlug = keyof typeof ROLE_BLUEPRINTS;
export interface CreateDeterministicWorldOptions { readonly seed?: string }
export interface DeterministicWorldResult { readonly world: SimulationWorld; readonly companyWorld: ParsedCompanyWorld }
export function createDeterministicWorld(options: CreateDeterministicWorldOptions = {}): DeterministicWorldResult {
  const seed = options.seed ?? DEFAULT_SEED;
  const companyWorld = buildCompanyWorld(seed);
  const world: SimulationWorld = { id: deterministicUuid(seed, 'world:root'), schemaVersion: SCHEMA_VERSION, seed, simTimeHours: 0, company: companyWorld, workforce: buildWorkforce(seed, companyWorld) } satisfies SimulationWorld;
  return { world: structuredClone(world) as SimulationWorld, companyWorld };
}
function buildCompanyWorld(seed: string): ParsedCompanyWorld { return parseCompanyWorld({ id: deterministicUuid(seed, 'company'), slug: 'deterministic-cultivation', name: 'Deterministic Cultivation Co.', location: { lon: 9.9937, lat: 53.5511, cityName: 'Hamburg', countryName: 'Germany' }, structures: STRUCTURE_DATA.map((config) => createStructure(seed, config)) }); }
function createStructure(seed: string, config: (typeof STRUCTURE_DATA)[number]) {
  const blueprint = STRUCTURE_BLUEPRINTS[config.blueprint];
  const structureId = deterministicUuid(seed, `structure:${config.slug}`);
  const height = blueprint.footprint.height_m ?? ROOM_DEFAULT_HEIGHT_M;
  const growRoom = createGrowRoom(seed, structureId, config.slug, height, config.zones);
  const auxiliaryRooms = config.auxiliary.map((purpose, index) => ({ id: deterministicUuid(seed, `structure:${config.slug}:aux:${purpose}:${index}`), slug: `${config.slug}-${purpose}`, name: `${config.nameSuffix} ${purpose.replace('room', '')}`.replace(/-/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (ch) => ch.toUpperCase()), purpose, floorArea_m2: Math.max(25, blueprint.footprint.width_m * 4 - index * 15), height_m: height, zones: [], devices: [] }));
  return { id: structureId, slug: config.slug, name: `${blueprint.name} ${config.nameSuffix}`, floorArea_m2: blueprint.footprint.length_m * blueprint.footprint.width_m, height_m: height, rooms: [growRoom, ...auxiliaryRooms], devices: [] };
}
function createGrowRoom(seed: string, structureId: Uuid, structureSlug: string, height: number, zones: readonly ZoneTuple[]) { return { id: deterministicUuid(seed, `room:${structureSlug}:grow`), slug: `${structureSlug}-grow`, name: 'Primary Grow Room', purpose: 'growroom' as const, floorArea_m2: zones.reduce((sum, zone) => sum + zone[1], 0) * 1.1, height_m: height, zones: zones.map((zone, index) => createZone(seed, structureId, `${structureSlug}-grow`, zone, index)), devices: [] }; }
function createZone(seed: string, structureId: Uuid, roomSlug: string, zoneData: ZoneTuple, index: number) {
  const [slug, area, methodKey, irrigationKey, containerKey, substrateKey, deviceKeys, schedule, phase, temperatureC, humidity01] = zoneData;
  const method = CULTIVATION_BLUEPRINTS[methodKey];
  const irrigation = IRRIGATION_BLUEPRINTS[irrigationKey];
  const container = CONTAINER_BLUEPRINTS[containerKey];
  const substrate = SUBSTRATE_BLUEPRINTS[substrateKey];
  const zoneSeed = `zone:${structureId}:${slug}`;
  const devices = deviceKeys.map((deviceKey, deviceIndex) => createDevice(seed, zoneSeed, DEVICE_BLUEPRINTS[deviceKey], deviceIndex));
  const setupCost = CULTIVATION_PRICE_MAP.get(method.id as Uuid)?.setupCost_per_h ?? 40;
  return { id: deterministicUuid(seed, `${zoneSeed}:${index}`), slug, name: slug.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()), floorArea_m2: area, height_m: ROOM_DEFAULT_HEIGHT_M, cultivationMethodId: method.id as Uuid, irrigationMethodId: irrigation.id as Uuid, containerId: container.id as Uuid, substrateId: substrate.id as Uuid, lightSchedule: { onHours: schedule[0], offHours: schedule[1], startHour: schedule[2] }, photoperiodPhase: phase, plants: [], devices, environment: { airTemperatureC: temperatureC, relativeHumidity01: humidity01, co2_ppm: AMBIENT_CO2_PPM }, ppfd_umol_m2s: 0, dli_mol_m2d_inc: 0, nutrientBuffer_mg: { N: Math.round(setupCost * 12), P: Math.round(setupCost * 6), K: Math.round(setupCost * 8) }, moisture01: 0.5 };
}
function createDevice(seed: string, zoneSeed: string, blueprint: ReturnType<typeof parseDeviceBlueprint>, index: number) {
  const deviceId = deterministicUuid(seed, `${zoneSeed}:device:${index}`);
  const { quality01, effects, effectConfigs } = seedDeviceAttributes({ sampleQuality01: (rng) => 0.6 + rng() * 0.3 }, seed, deviceId, blueprint);
  const capacity = toDeviceInstanceCapacity(blueprint);
  const priceEntry = DEVICE_PRICE_MAP[blueprint.id];
  return { id: deviceId, slug: blueprint.slug, name: blueprint.name, blueprintId: blueprint.id as Uuid, placementScope: blueprint.placementScope, quality01, condition01: 1, powerDraw_W: capacity.powerDraw_W, dutyCycle01: 1, efficiency01: capacity.efficiency01, coverage_m2: capacity.coverage_m2, airflow_m3_per_h: capacity.airflow_m3_per_h, sensibleHeatRemovalCapacity_W: Math.max(blueprint.thermal?.max_cool_W ?? 0, blueprint.thermal?.max_heat_W ?? 0), effects, effectConfigs, maintenance: priceEntry ? { runtimeHours: 0, hoursSinceService: 0, totalMaintenanceCostCc: 0, completedServiceCount: 0, recommendedReplacement: false, policy: { lifetimeHours: blueprint.lifetime_h ?? HOURS_PER_DAY * 365, maintenanceIntervalHours: (blueprint.maintenance?.intervalDays ?? 0) * HOURS_PER_DAY, serviceHours: blueprint.maintenance?.hoursPerService ?? 0, restoreAmount01: MAINTENANCE_RESTORE01, baseCostPerHourCc: priceEntry.baseMaintenanceCostPerHour, costIncreasePer1000HoursCc: priceEntry.costIncreasePer1000Hours, serviceVisitCostCc: priceEntry.maintenanceServiceCost, replacementCostCc: priceEntry.capitalExpenditure, maintenanceConditionThreshold01: MAINTENANCE_THRESHOLD01 } } : undefined };
}
function buildWorkforce(seed: string, companyWorld: ParsedCompanyWorld): WorkforceState {
  const employees = EMPLOYEE_DATA.map((entry, index) => createEmployee(seed, entry[0] as RoleSlug, companyWorld.structures[entry[1]]?.id ?? companyWorld.structures[0].id, index));
  return { roles: WORKFORCE_ROLES, employees, taskDefinitions: WORKFORCE_TASKS, taskQueue: [], kpis: [], warnings: [], payroll: { dayIndex: 0, totals: { baseMinutes: 0, otMinutes: 0, baseCost: 0, otCost: 0, totalLaborCost: 0 }, byStructure: [] }, market: { structures: companyWorld.structures.map((structure) => ({ structureId: structure.id, scanCounter: 0, pool: [] })) } };
}
function createEmployee(seed: string, roleSlug: RoleSlug, structureId: Uuid, index: number): Employee {
  const role = ROLE_BY_SLUG.get(roleSlug) ?? WORKFORCE_ROLES[0];
  const blueprint = ROLE_BLUEPRINTS[roleSlug];
  const rng = createRng(seed, `employee:${roleSlug}:${index}`);
  const firstNames = rng() < 0.5 ? MALE_NAMES : FEMALE_NAMES;
  const primarySkill = role.coreSkills[0]?.skillKey ?? 'operations';
  const secondarySkill = role.coreSkills[1]?.skillKey ?? 'logistics';
  const skills = [ { skillKey: primarySkill, level01: 0.7 }, { skillKey: secondarySkill, level01: 0.5 } ];
  return { id: deterministicUuid(seed, `employee:${roleSlug}:${index}`), name: `${sample(firstNames, rng)} ${sample(LAST_NAMES, rng)}`, roleId: role.id, rngSeedUuid: deterministicUuidV7(seed, `employee-seed:${roleSlug}:${index}`), assignedStructureId: structureId, morale01: 0.65 + rng() * 0.2, fatigue01: 0.2 + rng() * 0.1, skills, skillTriad: { main: skills[0], secondary: [skills[1], { skillKey: 'maintenance', level01: 0.4 }] }, traits: [{ traitId: TRAITS[(index + TRAITS.length) % TRAITS.length].id, strength01: 0.5 + rng() * 0.3 }], developmentPlan: role.coreSkills, schedule: { hoursPerDay: 8, overtimeHoursPerDay: 2, daysPerWeek: 5, shiftStartHour: 6 + (index % 3) * 2 }, notes: `Seeded ${role.name} employee`, baseRateMultiplier: role.baseRateMultiplier ?? 1, experience: { hoursAccrued: index * 120, level01: Math.min(1, 0.1 + index * 0.05) }, laborMarketFactor: 1, timePremiumMultiplier: 1, employmentStartDay: index * 30, salaryExpectation_per_h: blueprint.salary.basePerTick * (role.baseRateMultiplier ?? 1), raise: { cadenceSequence: index, lastDecisionDay: 0, nextEligibleDay: 180 } };
}
function toEmployeeRole(slug: RoleSlug): EmployeeRole { const blueprint = ROLE_BLUEPRINTS[slug]; const primary = toSkillKey(blueprint.skillProfile.primary.skill); const secondary = toSkillKey(blueprint.skillProfile.secondary.skill); return { id: deterministicUuid(DEFAULT_SEED, `role:${slug}`), slug: blueprint.slug, name: blueprint.name, coreSkills: [ { skillKey: primary, minSkill01: 0.5 }, { skillKey: secondary, minSkill01: 0.3 } ], baseRateMultiplier: blueprint.salary.skillFactor.base }; }
function toSkillKey(label: string): string { return label.trim().toLowerCase().replace(/\s+/g, '-'); }
function sample(values: readonly string[], rng: ReturnType<typeof createRng>): string { return values[Math.floor(rng() * values.length) % values.length]; }
