import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import type { EngineRunContext as EngineContext } from '../engine/Engine.js';
import type {
  Room,
  SimulationWorld,
  Structure,
  Uuid,
  WorkforceState,
  WorkforceTaskDefinition,
  WorkforceTaskInstance,
  Zone,
} from '../domain/world.js';
import { parseSubstrateBlueprint, type SubstrateBlueprint } from '../domain/blueprints/substrateBlueprint.js';
import { deterministicUuid } from '../util/uuid.js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CURRENT_DIR, '../../../../../../');
const BLUEPRINTS_ROOT = path.join(REPO_ROOT, 'data', 'blueprints');
const METHOD_BLUEPRINT_ROOT = path.join(BLUEPRINTS_ROOT, 'cultivation-method');
const CONTAINER_BLUEPRINT_ROOT = path.join(BLUEPRINTS_ROOT, 'container');
const SUBSTRATE_BLUEPRINT_ROOT = path.join(BLUEPRINTS_ROOT, 'substrate');

const slugSchema = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase letters, digits, hyphen).');

const containerBlueprintSchema = z
  .object({
    id: z.string().uuid('Container blueprint id must be a UUID v4.'),
    slug: slugSchema,
    class: z.literal('container', {
      invalid_type_error: 'class must be the canonical "container" domain value.',
    }),
    name: z.string().min(1, 'Container blueprint name must not be empty.'),
    volumeInLiters: z.number().finite().positive('volumeInLiters must be a positive number.'),
    footprintArea: z.number().finite().positive('footprintArea must be a positive number.'),
    reusableCycles: z.number().int().min(1).optional(),
  })
  .passthrough();

export type ContainerBlueprintLite = z.infer<typeof containerBlueprintSchema>;

const cultivationMethodBlueprintSchema = z
  .object({
    id: z.string().uuid('Cultivation method blueprint id must be a UUID v4.'),
    slug: slugSchema,
    class: z.literal('cultivation-method', {
      invalid_type_error: 'class must be the canonical "cultivation-method" domain value.',
    }),
    name: z.string().min(1, 'Cultivation method name must not be empty.'),
    containers: z.array(slugSchema).min(1, 'Cultivation method must list at least one container option.'),
    substrates: z.array(slugSchema).min(1, 'Cultivation method must list at least one substrate option.'),
    maxCycles: z.number().int().min(1).optional(),
    meta: z
      .object({
        defaults: z
          .object({
            containerSlug: slugSchema.optional(),
            substrateSlug: slugSchema.optional(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

export type CultivationMethodBlueprintLite = z.infer<typeof cultivationMethodBlueprintSchema>;

interface ContainerRegistry {
  readonly byId: Map<Uuid, ContainerBlueprintLite>;
  readonly bySlug: Map<string, ContainerBlueprintLite>;
}

interface SubstrateRegistry {
  readonly byId: Map<Uuid, SubstrateBlueprint>;
  readonly bySlug: Map<string, SubstrateBlueprint>;
}

function readJsonFile(filePath: string): unknown {
  const raw = readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as unknown;
}

function listJsonFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(path.join(root, entry.name));
      continue;
    }

    if (entry.isDirectory()) {
      const nestedRoot = path.join(root, entry.name);
      const nestedEntries = readdirSync(nestedRoot, { withFileTypes: true });

      for (const nestedEntry of nestedEntries) {
        if (nestedEntry.isFile() && nestedEntry.name.endsWith('.json')) {
          files.push(path.join(nestedRoot, nestedEntry.name));
        }
      }
    }
  }

  return files;
}

let containerRegistryCache: ContainerRegistry | null = null;
let substrateRegistryCache: SubstrateRegistry | null = null;

function ensureContainerRegistry(): ContainerRegistry {
  if (containerRegistryCache) {
    return containerRegistryCache;
  }

  const byId = new Map<Uuid, ContainerBlueprintLite>();
  const bySlug = new Map<string, ContainerBlueprintLite>();

  for (const filePath of listJsonFiles(CONTAINER_BLUEPRINT_ROOT)) {
    const blueprint = containerBlueprintSchema.parse(readJsonFile(filePath));
    byId.set(blueprint.id as Uuid, blueprint);
    bySlug.set(blueprint.slug, blueprint);
  }

  containerRegistryCache = { byId, bySlug } satisfies ContainerRegistry;
  return containerRegistryCache;
}

function ensureSubstrateRegistry(): SubstrateRegistry {
  if (substrateRegistryCache) {
    return substrateRegistryCache;
  }

  const byId = new Map<Uuid, SubstrateBlueprint>();
  const bySlug = new Map<string, SubstrateBlueprint>();

  for (const filePath of listJsonFiles(SUBSTRATE_BLUEPRINT_ROOT)) {
    const blueprint = parseSubstrateBlueprint(readJsonFile(filePath), { filePath });
    byId.set(blueprint.id as Uuid, blueprint);
    bySlug.set(blueprint.slug, blueprint);
  }

  substrateRegistryCache = { byId, bySlug } satisfies SubstrateRegistry;
  return substrateRegistryCache;
}

function resolveContainerPolicyById(containerId: Uuid): ContainerPolicy | undefined {
  const registry = ensureContainerRegistry();
  const entry = registry.byId.get(containerId);

  if (!entry) {
    return undefined;
  }

  return toContainerPolicy(entry);
}

function resolveSubstratePolicyById(substrateId: Uuid): SubstratePolicy | undefined {
  const registry = ensureSubstrateRegistry();
  const entry = registry.byId.get(substrateId);

  if (!entry) {
    return undefined;
  }

  return toSubstratePolicy(entry);
}

export interface ContainerPolicy {
  readonly id: Uuid;
  readonly slug: string;
  readonly serviceLife_cycles: number;
  readonly volume_L: number;
  readonly footprintArea_m2: number;
}

export interface SubstratePolicy {
  readonly id: Uuid;
  readonly slug: string;
  readonly maxCycles: number;
  readonly sterilizationTaskCode?: string;
  readonly sterilizationInterval_cycles?: number;
}

export interface CultivationMethodDescriptor {
  readonly id: Uuid;
  readonly slug: string;
  readonly containerOptions: readonly ContainerPolicy[];
  readonly substrateOptions: readonly SubstratePolicy[];
  readonly defaultContainerId?: Uuid;
  readonly defaultSubstrateId?: Uuid;
}

let cultivationMethodCatalogCache: Map<Uuid, CultivationMethodDescriptor> | null = null;

function toContainerPolicy(entry: ContainerBlueprintLite): ContainerPolicy {
  const serviceLife = entry.reusableCycles && entry.reusableCycles > 0 ? entry.reusableCycles : 1;

  return {
    id: entry.id as Uuid,
    slug: entry.slug,
    serviceLife_cycles: serviceLife,
    volume_L: entry.volumeInLiters,
    footprintArea_m2: entry.footprintArea,
  } satisfies ContainerPolicy;
}

function toSubstratePolicy(entry: SubstrateBlueprint): SubstratePolicy {
  const reusePolicy = entry.reusePolicy;

  return {
    id: entry.id as Uuid,
    slug: entry.slug,
    maxCycles: Math.max(1, reusePolicy.maxCycles),
    sterilizationTaskCode: reusePolicy.sterilizationTaskCode,
    sterilizationInterval_cycles: reusePolicy.sterilizationInterval_cycles,
  } satisfies SubstratePolicy;
}

function buildCultivationMethodCatalog(): Map<Uuid, CultivationMethodDescriptor> {
  const { bySlug: containerBySlug } = ensureContainerRegistry();
  const { bySlug: substrateBySlug } = ensureSubstrateRegistry();
  const catalog = new Map<Uuid, CultivationMethodDescriptor>();

  for (const filePath of listJsonFiles(METHOD_BLUEPRINT_ROOT)) {
    const blueprint = cultivationMethodBlueprintSchema.parse(readJsonFile(filePath));
    const containerOptions = blueprint.containers
      .map((slug) => containerBySlug.get(slug))
      .filter((entry): entry is ContainerBlueprintLite => Boolean(entry))
      .map(toContainerPolicy);

    const substrateOptions = blueprint.substrates
      .map((slug) => substrateBySlug.get(slug))
      .filter((entry): entry is SubstrateBlueprint => Boolean(entry))
      .map(toSubstratePolicy);

    const defaultContainerId = blueprint.meta?.defaults?.containerSlug
      ? containerBySlug.get(blueprint.meta.defaults.containerSlug)?.id
      : undefined;
    const defaultSubstrateId = blueprint.meta?.defaults?.substrateSlug
      ? substrateBySlug.get(blueprint.meta.defaults.substrateSlug)?.id
      : undefined;

    catalog.set(blueprint.id as Uuid, {
      id: blueprint.id as Uuid,
      slug: blueprint.slug,
      containerOptions,
      substrateOptions,
      defaultContainerId: defaultContainerId as Uuid | undefined,
      defaultSubstrateId: defaultSubstrateId as Uuid | undefined,
    });
  }

  return catalog;
}

export function getCultivationMethodCatalog(): ReadonlyMap<Uuid, CultivationMethodDescriptor> {
  if (!cultivationMethodCatalogCache) {
    cultivationMethodCatalogCache = buildCultivationMethodCatalog();
  }

  return cultivationMethodCatalogCache;
}

export function getCultivationMethodDescriptor(id: Uuid): CultivationMethodDescriptor | undefined {
  return getCultivationMethodCatalog().get(id);
}

export const CULTIVATION_REPOT_TASK_CODE = 'cultivation.repot';
export const CULTIVATION_SUBSTRATE_STERILIZE_TASK_CODE = 'cultivation.substrate.sterilize';
export const CULTIVATION_SUBSTRATE_DISPOSAL_TASK_CODE = 'cultivation.substrate.dispose';

export interface ZoneCultivationRuntimeState {
  lastHarvestTick?: number;
  containerCyclesUsed: number;
  substrateCyclesUsed: number;
  lastSterilizedCycle?: number;
  totalCyclesCompleted: number;
}

interface CultivationTaskRuntimeMutable {
  readonly zones: Map<Zone['id'], ZoneCultivationRuntimeState>;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

type CultivationRuntimeCarrier = Mutable<EngineContext> & {
  [CULTIVATION_RUNTIME_CONTEXT_KEY]?: CultivationTaskRuntimeMutable;
};

const CULTIVATION_RUNTIME_CONTEXT_KEY = '__wb_cultivationTaskRuntime' as const;

export function ensureCultivationTaskRuntime(ctx: EngineContext): CultivationTaskRuntimeMutable {
  const carrier = ctx as CultivationRuntimeCarrier;
  let runtime = carrier[CULTIVATION_RUNTIME_CONTEXT_KEY];

  if (!runtime) {
    runtime = { zones: new Map() };
    carrier[CULTIVATION_RUNTIME_CONTEXT_KEY] = runtime;
  }

  return runtime;
}

export function clearCultivationTaskRuntime(ctx: EngineContext): void {
  const carrier = ctx as CultivationRuntimeCarrier;
  if (carrier[CULTIVATION_RUNTIME_CONTEXT_KEY]) {
    delete carrier[CULTIVATION_RUNTIME_CONTEXT_KEY];
  }
}

function resolveZoneRuntime(
  runtime: CultivationTaskRuntimeMutable,
  zoneId: Zone['id'],
): ZoneCultivationRuntimeState {
  let state = runtime.zones.get(zoneId);

  if (!state) {
    state = {
      containerCyclesUsed: 0,
      substrateCyclesUsed: 0,
      totalCyclesCompleted: 0,
    } satisfies ZoneCultivationRuntimeState;
    runtime.zones.set(zoneId, state);
  }

  return state;
}

interface ScheduleZoneTasksOptions {
  readonly world: SimulationWorld;
  readonly structure: Structure;
  readonly room: Room;
  readonly zone: Zone;
  readonly workforce?: WorkforceState;
  readonly runtime: CultivationTaskRuntimeMutable;
  readonly currentTick: number;
  readonly methodCatalog: ReadonlyMap<Uuid, CultivationMethodDescriptor>;
}

function findTaskDefinition(
  workforce: WorkforceState | undefined,
  taskCode: string,
): WorkforceTaskDefinition | undefined {
  if (!workforce) {
    return undefined;
  }

  return workforce.taskDefinitions.find((definition) => definition.taskCode === taskCode);
}

function createTask(
  world: SimulationWorld,
  zone: Zone,
  taskCode: string,
  definition: WorkforceTaskDefinition | undefined,
  baseContext: Record<string, unknown>,
  currentTick: number,
  eventKey: string,
): WorkforceTaskInstance | null {
  if (!definition) {
    return null;
  }

  const id = deterministicUuid(world.seed, `cultivation:${taskCode}:${zone.id}:${eventKey}`);

  return {
    id,
    taskCode: definition.taskCode,
    status: 'queued',
    createdAtTick: currentTick,
    context: baseContext,
  } satisfies WorkforceTaskInstance;
}

function hasCompletedHarvest(zone: Zone): boolean {
  if (zone.plants.length === 0) {
    return false;
  }

  return zone.plants.every((plant) => plant.status === 'harvested' && typeof plant.harvestedAt_tick === 'number');
}

function resolveLatestHarvestTick(zone: Zone): number | null {
  const harvestedTicks = zone.plants
    .map((plant) => (typeof plant.harvestedAt_tick === 'number' ? Math.trunc(plant.harvestedAt_tick) : null))
    .filter((tick): tick is number => tick !== null);

  if (harvestedTicks.length === 0) {
    return null;
  }

  return Math.max(...harvestedTicks);
}

export function scheduleCultivationTasksForZone(
  options: ScheduleZoneTasksOptions,
): readonly WorkforceTaskInstance[] {
  const { world, structure, room, zone, workforce, runtime, currentTick, methodCatalog } = options;

  if (!hasCompletedHarvest(zone)) {
    return [];
  }

  const latestHarvestTick = resolveLatestHarvestTick(zone);

  if (latestHarvestTick === null) {
    return [];
  }

  const descriptor = methodCatalog.get(zone.cultivationMethodId);

  const containerPolicy =
    descriptor?.containerOptions.find((option) => option.id === zone.containerId) ??
    resolveContainerPolicyById(zone.containerId as Uuid);
  const substratePolicy =
    descriptor?.substrateOptions.find((option) => option.id === zone.substrateId) ??
    resolveSubstratePolicyById(zone.substrateId as Uuid);

  if (!containerPolicy || !substratePolicy) {
    return [];
  }

  const state = resolveZoneRuntime(runtime, zone.id);

  state.lastHarvestTick = latestHarvestTick;
  state.totalCyclesCompleted += 1;
  const cycleSequence = state.totalCyclesCompleted;
  state.containerCyclesUsed += 1;
  state.substrateCyclesUsed += 1;

  const baseContext = {
    zoneId: zone.id,
    roomId: room.id,
    structureId: structure.id,
    area_m2: zone.floorArea_m2,
    plantCount: zone.plants.length,
    cycleIndex: state.substrateCyclesUsed,
    cycleSequence,
  } satisfies Record<string, unknown>;

  const tasks: WorkforceTaskInstance[] = [];

  if (state.containerCyclesUsed >= containerPolicy.serviceLife_cycles) {
    const definition = findTaskDefinition(workforce, CULTIVATION_REPOT_TASK_CODE);
    const task = createTask(
      world,
      zone,
      CULTIVATION_REPOT_TASK_CODE,
      definition,
      {
        ...baseContext,
        containerId: zone.containerId,
        containerServiceLife: containerPolicy.serviceLife_cycles,
        containerCycleCount: state.containerCyclesUsed,
      },
      currentTick,
      `repot:${cycleSequence}:tick:${latestHarvestTick}`,
    );

    if (task) {
      tasks.push(task);
      state.containerCyclesUsed = 0;
    }
  }

  const sterilizeTaskCode = substratePolicy.sterilizationTaskCode ?? CULTIVATION_SUBSTRATE_STERILIZE_TASK_CODE;
  const definitionSterilize = findTaskDefinition(workforce, sterilizeTaskCode);
  const definitionDispose = findTaskDefinition(workforce, CULTIVATION_SUBSTRATE_DISPOSAL_TASK_CODE);

  const shouldDispose = state.substrateCyclesUsed >= substratePolicy.maxCycles;
  const shouldSterilize = !shouldDispose && substratePolicy.sterilizationTaskCode;

  if (shouldDispose && definitionDispose) {
    const task = createTask(
      world,
      zone,
      CULTIVATION_SUBSTRATE_DISPOSAL_TASK_CODE,
      definitionDispose,
      {
        ...baseContext,
        substrateId: zone.substrateId,
        substrateMaxCycles: substratePolicy.maxCycles,
        substrateCycleCount: state.substrateCyclesUsed,
      },
      currentTick,
      `dispose:${cycleSequence}:tick:${latestHarvestTick}`,
    );

    if (task) {
      tasks.push(task);
      state.substrateCyclesUsed = 0;
      state.lastSterilizedCycle = undefined;
    }
  } else if (shouldSterilize && definitionSterilize) {
    const interval = substratePolicy.sterilizationInterval_cycles ?? 1;
    const nextSterilization = (state.lastSterilizedCycle ?? 0) + interval;

    if (state.substrateCyclesUsed >= nextSterilization) {
      const task = createTask(
        world,
        zone,
        sterilizeTaskCode,
        definitionSterilize,
        {
          ...baseContext,
          substrateId: zone.substrateId,
          sterilizationInterval_cycles: interval,
          substrateCycleCount: state.substrateCyclesUsed,
        },
        currentTick,
        `sterilize:${cycleSequence}:tick:${latestHarvestTick}`,
      );

      if (task) {
        tasks.push(task);
        state.lastSterilizedCycle = state.substrateCyclesUsed;
      }
    }
  }

  return tasks;
}

export interface ScheduleCultivationTasksResult {
  readonly newTasks: readonly WorkforceTaskInstance[];
}

export function scheduleCultivationTasks(
  options: Omit<ScheduleZoneTasksOptions, 'zone'> & { readonly zones: readonly Zone[] },
): ScheduleCultivationTasksResult {
  const { zones, ...rest } = options;
  const tasks: WorkforceTaskInstance[] = [];

  for (const zone of zones) {
    const zoneTasks = scheduleCultivationTasksForZone({
      ...rest,
      zone,
    });

    if (zoneTasks.length > 0) {
      tasks.push(...zoneTasks);
    }
  }

  return { newTasks: tasks } satisfies ScheduleCultivationTasksResult;
}

