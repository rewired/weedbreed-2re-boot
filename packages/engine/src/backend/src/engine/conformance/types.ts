import type { RoomPurpose } from '../../domain/entities.ts';

export interface BlueprintLite {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
}

export interface LightingBlueprint extends BlueprintLite {
  readonly coverage_m2: number;
  readonly allowedRoomPurposes: readonly RoomPurpose[];
  readonly placementScope: string;
}

export interface ClimateBlueprint extends BlueprintLite {
  readonly airflow_m3_per_h: number;
  readonly placementScope: string;
  readonly allowedRoomPurposes: readonly RoomPurpose[];
}

export interface CultivationBlueprint extends BlueprintLite {
  readonly technique: string;
  readonly meta?: {
    readonly defaults?: {
      readonly containerSlug?: string;
      readonly substrateSlug?: string;
    };
  };
}

export interface IrrigationBlueprint extends BlueprintLite {
  readonly method?: string;
  readonly control?: string;
}

export interface ContainerBlueprint extends BlueprintLite {
  readonly volumeInLiters: number;
  readonly footprintArea: number;
}

export interface SubstrateBlueprint extends BlueprintLite {
  readonly purchaseUnit: string;
  readonly unitPrice_per_L?: number;
  readonly unitPrice_per_kg?: number;
  readonly densityFactor_L_per_kg?: number;
  readonly densityFactor_kg_per_L?: number;
}

export interface StrainBlueprint extends BlueprintLite {
  readonly floweringTime_days?: number;
  readonly photoperiod?: Record<string, unknown>;
}

export interface ZonePlan {
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

export interface EmployeePlan {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly role: 'grower' | 'trimmer' | 'janitor';
  readonly shiftHours: number;
}

export interface HarvestLotRecord {
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

export interface DailyRecordBase {
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
