import type {
  Employee,
  Structure,
  WorkforceKpiSnapshot,
  WorkforcePayrollState,
  WorkforceTaskInstance,
} from '../domain/world.ts';
import type { TraitEffectBreakdownEntry } from '../domain/workforce/traits.ts';

export interface WorkforceAssignment {
  readonly taskId: WorkforceTaskInstance['id'];
  readonly employeeId: Employee['id'];
  readonly baseMinutes: number;
  readonly overtimeMinutes: number;
  readonly waitTimeHours: number;
  readonly structureId: Structure['id'];
  readonly taskEffects: {
    readonly durationMinutes: number;
    readonly errorRate01: number;
    readonly deviceWearMultiplier: number;
    readonly xpRateMultiplier: number;
    readonly breakdown: readonly TraitEffectBreakdownEntry[];
  };
  readonly wellbeingEffects: {
    readonly fatigueDelta: number;
    readonly moraleDelta: number;
    readonly breakdown: readonly TraitEffectBreakdownEntry[];
  };
}

export interface WorkforceRuntime {
  readonly assignments: readonly WorkforceAssignment[];
  readonly kpiSnapshot?: WorkforceKpiSnapshot;
}

export interface WorkforceRuntimeMutable {
  assignments: WorkforceAssignment[];
  kpiSnapshot?: WorkforceKpiSnapshot;
}

export interface WorkforcePayrollAccrualSnapshot {
  readonly current: WorkforcePayrollState;
  readonly finalized?: WorkforcePayrollState;
}

export interface WorkforceMarketCharge {
  readonly structureId: Structure['id'];
  readonly amountCc: number;
  readonly scanCounter: number;
}

