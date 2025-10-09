import { FLOAT_TOLERANCE } from '@/backend/src/constants/simConstants';

import {
  type DeviceInstance,
  type DevicePlacementScope
} from '../entities.ts';

/**
 * Validation issue emitted when the world tree violates SEC guardrails.
 */
export interface WorldValidationIssue {
  /** JSON pointer-esque path locating the problematic node. */
  readonly path: string;
  /** Human-readable explanation of the violation. */
  readonly message: string;
}

/**
 * Determines whether the provided value lies within the canonical unit interval.
 *
 * @param value - Value to evaluate.
 * @returns True when {@link value} ∈ [0,1].
 */
export function isWithinUnitInterval(value: number): boolean {
  return value >= 0 - FLOAT_TOLERANCE && value <= 1 + FLOAT_TOLERANCE;
}

/**
 * Validates a device instance against canonical invariants and placement scope.
 *
 * @param device - Device instance to evaluate.
 * @param expectedScope - Placement scope enforced by the containing node.
 * @param path - Path to the device within the world tree.
 * @param issues - Mutable issue collection.
 */
export function validateDevice(
  device: DeviceInstance,
  expectedScope: DevicePlacementScope,
  path: string,
  issues: WorldValidationIssue[]
): void {
  if (device.placementScope !== expectedScope) {
    issues.push({
      path: `${path}.placementScope`,
      message: `device placement scope must be "${expectedScope}"`
    });
  }

  if (!isWithinUnitInterval(device.quality01)) {
    issues.push({
      path: `${path}.quality01`,
      message: 'device quality01 must lie within [0,1]'
    });
  }

  if (!isWithinUnitInterval(device.condition01)) {
    issues.push({
      path: `${path}.condition01`,
      message: 'device condition01 must lie within [0,1]'
    });
  }

  if (device.powerDraw_W < 0) {
    issues.push({
      path: `${path}.powerDraw_W`,
      message: 'device power draw must be non-negative'
    });
  }

  if (!isWithinUnitInterval(device.dutyCycle01)) {
    issues.push({
      path: `${path}.dutyCycle01`,
      message: 'device dutyCycle01 must lie within [0,1]'
    });
  }

  if (!isWithinUnitInterval(device.efficiency01)) {
    issues.push({
      path: `${path}.efficiency01`,
      message: 'device efficiency01 must lie within [0,1]'
    });
  }

  if (device.sensibleHeatRemovalCapacity_W < 0) {
    issues.push({
      path: `${path}.sensibleHeatRemovalCapacity_W`,
      message: 'device sensible heat removal capacity must be non-negative'
    });
  }

  if (device.coverage_m2 < 0) {
    issues.push({
      path: `${path}.coverage_m2`,
      message: 'device coverage_m2 must be non-negative'
    });
  }

  if (device.airflow_m3_per_h < 0) {
    issues.push({
      path: `${path}.airflow_m3_per_h`,
      message: 'device airflow_m3_per_h must be non-negative'
    });
  }

  const maintenance = device.maintenance;

  if (maintenance) {
    if (!Number.isFinite(maintenance.runtimeHours) || maintenance.runtimeHours < 0) {
      issues.push({
        path: `${path}.maintenance.runtimeHours`,
        message: 'maintenance.runtimeHours must be a finite non-negative number'
      });
    }

    if (
      !Number.isFinite(maintenance.hoursSinceService) ||
      maintenance.hoursSinceService < 0
    ) {
      issues.push({
        path: `${path}.maintenance.hoursSinceService`,
        message: 'maintenance.hoursSinceService must be a finite non-negative number'
      });
    }

    if (
      !Number.isFinite(maintenance.totalMaintenanceCostCc) ||
      maintenance.totalMaintenanceCostCc < 0
    ) {
      issues.push({
        path: `${path}.maintenance.totalMaintenanceCostCc`,
        message: 'maintenance.totalMaintenanceCostCc must be a finite non-negative number'
      });
    }

    if (maintenance.maintenanceWindow) {
      const { startTick, endTick } = maintenance.maintenanceWindow;

      if (endTick <= startTick) {
        issues.push({
          path: `${path}.maintenance.maintenanceWindow`,
          message: 'maintenance windows must end after they start'
        });
      }
    }

    if (maintenance.policy) {
      const policy = maintenance.policy;

      if (!Number.isFinite(policy.lifetimeHours) || policy.lifetimeHours <= 0) {
        issues.push({
          path: `${path}.maintenance.policy.lifetimeHours`,
          message: 'maintenance.policy.lifetimeHours must be a positive finite number'
        });
      }

      if (
        !Number.isFinite(policy.maintenanceIntervalHours) ||
        policy.maintenanceIntervalHours < 0
      ) {
        issues.push({
          path: `${path}.maintenance.policy.maintenanceIntervalHours`,
          message: 'maintenance.policy.maintenanceIntervalHours must be non-negative'
        });
      }

      if (!Number.isFinite(policy.serviceHours) || policy.serviceHours < 0) {
        issues.push({
          path: `${path}.maintenance.policy.serviceHours`,
          message: 'maintenance.policy.serviceHours must be non-negative'
        });
      }

      if (
        !Number.isFinite(policy.baseCostPerHourCc) ||
        policy.baseCostPerHourCc < 0
      ) {
        issues.push({
          path: `${path}.maintenance.policy.baseCostPerHourCc`,
          message: 'maintenance.policy.baseCostPerHourCc must be non-negative'
        });
      }

      if (
        !Number.isFinite(policy.costIncreasePer1000HoursCc) ||
        policy.costIncreasePer1000HoursCc < 0
      ) {
        issues.push({
          path: `${path}.maintenance.policy.costIncreasePer1000HoursCc`,
          message: 'maintenance.policy.costIncreasePer1000HoursCc must be non-negative'
        });
      }

      if (
        !Number.isFinite(policy.serviceVisitCostCc) ||
        policy.serviceVisitCostCc < 0
      ) {
        issues.push({
          path: `${path}.maintenance.policy.serviceVisitCostCc`,
          message: 'maintenance.policy.serviceVisitCostCc must be non-negative'
        });
      }

      if (
        !Number.isFinite(policy.replacementCostCc) ||
        policy.replacementCostCc < 0
      ) {
        issues.push({
          path: `${path}.maintenance.policy.replacementCostCc`,
          message: 'maintenance.policy.replacementCostCc must be non-negative'
        });
      }

      if (
        !Number.isFinite(policy.maintenanceConditionThreshold01) ||
        policy.maintenanceConditionThreshold01 < 0 ||
        policy.maintenanceConditionThreshold01 > 1
      ) {
        issues.push({
          path: `${path}.maintenance.policy.maintenanceConditionThreshold01`,
          message: 'maintenance.policy.maintenanceConditionThreshold01 must lie within [0,1]'
        });
      }
    }
  }
}
