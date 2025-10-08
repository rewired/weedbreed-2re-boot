import { FLOAT_TOLERANCE } from '@/backend/src/constants/simConstants';
import { clamp01 } from '../util/math.ts';
import { deterministicUuid } from '../util/uuid.ts';
import type {
  DeviceMaintenancePolicy,
  DeviceMaintenanceState,
  DeviceMaintenanceWindow,
  Room,
  Structure,
  Zone,
  ZoneDeviceInstance
} from '../domain/entities.ts';
import type { Uuid } from '../domain/schemas/primitives.ts';

const DEFAULT_BASE_LIFETIME_HOURS = 8_760; // One year of continuous runtime.
const MIN_TICK_HOURS = FLOAT_TOLERANCE;

export function mDegrade(quality01: number): number {
  const quality = clamp01(Number.isFinite(quality01) ? quality01 : 0.5);
  return clamp01(0.4 + 0.6 * (1 - quality));
}

export function mMaintenance(quality01: number): number {
  const quality = clamp01(Number.isFinite(quality01) ? quality01 : 0.5);
  return clamp01(0.5 + 0.5 * (1 - quality));
}

export interface DeviceMaintenanceTaskPlan {
  readonly taskId: Uuid;
  readonly deviceId: ZoneDeviceInstance['id'];
  readonly deviceName: string;
  readonly structureId: Structure['id'];
  readonly structureName: string;
  readonly roomId: Room['id'];
  readonly roomName: string;
  readonly zoneId: Zone['id'];
  readonly zoneName: string;
  readonly workshopRoomId?: Room['id'];
  readonly workshopRoomName?: string;
  readonly startTick: number;
  readonly endTick: number;
  readonly dueTick: number;
  readonly serviceHours: number;
  readonly serviceVisitCostCc: number;
  readonly reason: DeviceMaintenanceWindow['reason'];
}

export interface DeviceMaintenanceCompletion {
  readonly taskId: Uuid;
}

export interface DeviceReplacementRecommendation {
  readonly deviceId: ZoneDeviceInstance['id'];
  readonly deviceName: string;
  readonly structureId: Structure['id'];
  readonly structureName: string;
  readonly roomId: Room['id'];
  readonly roomName: string;
  readonly zoneId: Zone['id'];
  readonly zoneName: string;
  readonly recommendedSinceTick: number;
  readonly totalMaintenanceCostCc: number;
  readonly replacementCostCc: number;
}

export interface DeviceLifecycleUpdateInput {
  readonly device: ZoneDeviceInstance;
  readonly structure: Structure;
  readonly room: Room;
  readonly zone: Zone;
  readonly workshopRoom?: Room;
  readonly seed: string;
  readonly tickHours: number;
  readonly currentTick: number;
}

export interface DeviceDegradationOutcome {
  readonly device: ZoneDeviceInstance;
  readonly costAccruedCc: number;
  readonly scheduledTask?: DeviceMaintenanceTaskPlan;
  readonly completedTaskId?: Uuid;
  readonly replacementJustRecommended?: DeviceReplacementRecommendation;
}

function resolvePolicyLifetimeHours(policy?: DeviceMaintenancePolicy): number {
  if (!policy) {
    return DEFAULT_BASE_LIFETIME_HOURS;
  }

  if (!Number.isFinite(policy.lifetimeHours) || policy.lifetimeHours <= 0) {
    return DEFAULT_BASE_LIFETIME_HOURS;
  }

  return policy.lifetimeHours;
}

function resolveIntervalHours(policy: DeviceMaintenancePolicy | undefined, quality01: number): number {
  if (!policy) {
    return Number.POSITIVE_INFINITY;
  }

  if (!Number.isFinite(policy.maintenanceIntervalHours) || policy.maintenanceIntervalHours <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return policy.maintenanceIntervalHours / Math.max(mMaintenance(quality01), MIN_TICK_HOURS);
}

function resolveConditionThreshold(policy: DeviceMaintenancePolicy | undefined): number {
  const value = policy?.maintenanceConditionThreshold01;

  if (!Number.isFinite(value)) {
    return 0.4;
  }

  return clamp01(value);
}

function resolveRestoreAmount(policy: DeviceMaintenancePolicy | undefined): number {
  const value = policy?.restoreAmount01;

  if (!Number.isFinite(value)) {
    return 0;
  }

  return clamp01(value);
}

function resolveServiceHours(policy: DeviceMaintenancePolicy | undefined, tickHours: number): number {
  if (!policy) {
    return Math.max(tickHours, MIN_TICK_HOURS);
  }

  if (!Number.isFinite(policy.serviceHours) || policy.serviceHours <= 0) {
    return Math.max(tickHours, MIN_TICK_HOURS);
  }

  return Math.max(policy.serviceHours, tickHours);
}

function computeHourlyMaintenanceCost(
  policy: DeviceMaintenancePolicy | undefined,
  runtimeHours: number
): number {
  if (!policy) {
    return 0;
  }

  const base = Number.isFinite(policy.baseCostPerHourCc) ? Math.max(0, policy.baseCostPerHourCc) : 0;
  const slope = Number.isFinite(policy.costIncreasePer1000HoursCc)
    ? Math.max(0, policy.costIncreasePer1000HoursCc)
    : 0;
  const incremental = slope * (runtimeHours / 1_000);
  return base + incremental;
}

function computeServiceVisitCost(policy: DeviceMaintenancePolicy | undefined): number {
  if (!policy) {
    return 0;
  }

  return Number.isFinite(policy.serviceVisitCostCc) ? Math.max(0, policy.serviceVisitCostCc) : 0;
}

function shouldRecommendReplacement(
  previous: DeviceMaintenanceState | undefined,
  nextTotalCostCc: number,
  policy: DeviceMaintenancePolicy | undefined
): boolean {
  if (!policy) {
    return false;
  }

  if (previous?.recommendedReplacement) {
    return true;
  }

  const threshold = Math.max(0, Number.isFinite(policy.replacementCostCc) ? policy.replacementCostCc : 0);
  if (threshold === 0) {
    return false;
  }

  return nextTotalCostCc >= threshold;
}

export function updateZoneDeviceLifecycle(
  input: DeviceLifecycleUpdateInput
): DeviceDegradationOutcome {
  const { device, structure, room, zone, workshopRoom, seed, tickHours, currentTick } = input;
  const duty = clamp01(Number.isFinite(device.dutyCycle01) ? device.dutyCycle01 : 1);
  const hoursThisTick = Math.max(0, tickHours) * duty;
  const quality = clamp01(Number.isFinite(device.quality01) ? device.quality01 : 0.5);
  const policy = device.maintenance?.policy;
  const previousMaintenance = device.maintenance;
  const previousWindow = previousMaintenance?.maintenanceWindow;
  const previousRecommended = previousMaintenance?.recommendedReplacement ?? false;
  const previousCompletedCount = previousMaintenance?.completedServiceCount ?? 0;
  const previousRuntime = previousMaintenance?.runtimeHours ?? 0;
  const previousHoursSinceService = previousMaintenance?.hoursSinceService ?? 0;
  const previousTotalCost = previousMaintenance?.totalMaintenanceCostCc ?? 0;

  const baseLifetimeHours = resolvePolicyLifetimeHours(policy);
  const intervalHours = resolveIntervalHours(policy, quality);
  const conditionThreshold = resolveConditionThreshold(policy);
  const restoreAmount01 = resolveRestoreAmount(policy);
  const serviceHours = resolveServiceHours(policy, tickHours);
  const serviceVisitCostCc = computeServiceVisitCost(policy);

  const runtimeHours = previousRuntime + hoursThisTick;
  let hoursSinceService = previousHoursSinceService + hoursThisTick;
  let condition01 = clamp01(Number.isFinite(device.condition01) ? device.condition01 : 1);
  let totalMaintenanceCostCc = previousTotalCost;
  let completedServiceCount = previousCompletedCount;
  let maintenanceWindow = previousWindow ? { ...previousWindow } : undefined;
  let lastServiceScheduledTick = previousMaintenance?.lastServiceScheduledTick;
  let lastServiceCompletedTick = previousMaintenance?.lastServiceCompletedTick;
  let scheduledTask: DeviceMaintenanceTaskPlan | undefined;
  let completedTaskId: Uuid | undefined;
  let replacementEvent: DeviceReplacementRecommendation | undefined;

  if (hoursThisTick > 0) {
    const wear = (hoursThisTick / baseLifetimeHours) * mDegrade(quality);
    condition01 = clamp01(condition01 - wear);
  }

  const hourlyCostCc = computeHourlyMaintenanceCost(policy, runtimeHours);
  const variableCostCc = hourlyCostCc * hoursThisTick;
  let costAccruedCc = variableCostCc;
  totalMaintenanceCostCc += variableCostCc;

  if (maintenanceWindow && currentTick >= maintenanceWindow.endTick) {
    hoursSinceService = 0;
    maintenanceWindow = undefined;
    lastServiceCompletedTick = currentTick;
    completedServiceCount += 1;
    condition01 = clamp01(condition01 + restoreAmount01);
    completedTaskId = previousWindow?.taskId;
  }

  const conditionDue = condition01 <= conditionThreshold;
  const intervalDue = hoursSinceService >= intervalHours;
  const hasActiveWindow = Boolean(maintenanceWindow);

  if (!hasActiveWindow && policy && (conditionDue || intervalDue)) {
    const startTick = currentTick;
    const tickDuration = Math.max(tickHours, MIN_TICK_HOURS);
    const durationTicks = Math.max(1, Math.ceil(serviceHours / tickDuration));
    const endTick = startTick + durationTicks;
    const reason: DeviceMaintenanceWindow['reason'] = conditionDue ? 'condition' : 'interval';
    const taskId = deterministicUuid(seed, `device:${device.id}:maintenance:${startTick}`);

    maintenanceWindow = {
      startTick,
      endTick,
      taskId,
      reason
    } satisfies DeviceMaintenanceWindow;

    lastServiceScheduledTick = startTick;
    totalMaintenanceCostCc += serviceVisitCostCc;
    costAccruedCc += serviceVisitCostCc;

    scheduledTask = {
      taskId,
      deviceId: device.id,
      deviceName: device.name,
      structureId: structure.id,
      structureName: structure.name,
      roomId: room.id,
      roomName: room.name,
      zoneId: zone.id,
      zoneName: zone.name,
      workshopRoomId: workshopRoom?.id,
      workshopRoomName: workshopRoom?.name,
      startTick,
      endTick,
      dueTick: endTick,
      serviceHours,
      serviceVisitCostCc,
      reason
    } satisfies DeviceMaintenanceTaskPlan;
  }

  const replacementRecommended = shouldRecommendReplacement(previousMaintenance, totalMaintenanceCostCc, policy);

  if (replacementRecommended && !previousRecommended && policy) {
    replacementEvent = {
      deviceId: device.id,
      deviceName: device.name,
      structureId: structure.id,
      structureName: structure.name,
      roomId: room.id,
      roomName: room.name,
      zoneId: zone.id,
      zoneName: zone.name,
      recommendedSinceTick: currentTick,
      totalMaintenanceCostCc,
      replacementCostCc: Math.max(0, policy.replacementCostCc)
    } satisfies DeviceReplacementRecommendation;
  }

  const nextMaintenance: DeviceMaintenanceState | undefined = previousMaintenance
    ? {
        runtimeHours,
        hoursSinceService,
        totalMaintenanceCostCc,
        completedServiceCount,
        lastServiceScheduledTick,
        lastServiceCompletedTick,
        maintenanceWindow,
        recommendedReplacement: replacementRecommended,
        policy
      }
    : policy
    ? {
        runtimeHours,
        hoursSinceService,
        totalMaintenanceCostCc,
        completedServiceCount,
        lastServiceScheduledTick,
        lastServiceCompletedTick,
        maintenanceWindow,
        recommendedReplacement: replacementRecommended,
        policy
      }
    : undefined;

  const deviceChanged =
    nextMaintenance !== previousMaintenance ||
    condition01 !== device.condition01 ||
    runtimeHours !== previousRuntime ||
    hoursSinceService !== previousHoursSinceService;

  const nextDevice = deviceChanged
    ? {
        ...device,
        condition01,
        maintenance: nextMaintenance
      }
    : device;

  return {
    device: nextDevice,
    costAccruedCc,
    scheduledTask,
    completedTaskId,
    replacementJustRecommended: replacementEvent
  } satisfies DeviceDegradationOutcome;
}
