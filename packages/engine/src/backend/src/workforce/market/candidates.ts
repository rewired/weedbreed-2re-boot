import { DEFAULT_WORKFORCE_CONFIG, type WorkforceConfig } from '../../config/workforce.ts';
import type {
  Employee,
  EmployeeRole,
  HiringMarketHireIntent,
  HiringMarketScanIntent,
  Structure,
  WorkforceMarketCandidate,
  WorkforceMarketState,
} from '../../domain/world.ts';
import { clamp01 } from '../../util/math.ts';
import { deterministicUuid, deterministicUuidV7 } from '../../util/uuid.ts';
import { performMarketHire, performMarketScan } from '../../services/workforce/market.ts';
import { createInitialRaiseState } from '../../services/workforce/raises.ts';
import type { WorkforceMarketCharge } from '../types.ts';
import { createInitialExperience } from '../traits/effects.ts';

/* eslint-disable @typescript-eslint/no-magic-numbers -- Workforce default heuristics rely on fixed reference values */
const BASELINE_RATE_OFFSET_CC_PER_H = 5 as const;
const BASELINE_RATE_SKILL_MULTIPLIER = 10 as const;
const MIN_LABOR_MARKET_FACTOR = 0.1 as const;
const DEFAULT_MORALE01 = 0.7 as const;
const DEFAULT_FATIGUE01 = 0.2 as const;
const DEFAULT_HOURS_PER_DAY = 8 as const;
const DEFAULT_DAYS_PER_WEEK = 5 as const;
const DEFAULT_SHIFT_START_HOUR = 8 as const;
const EMPLOYEE_ID_SLICE_LENGTH = 8 as const;
/* eslint-enable @typescript-eslint/no-magic-numbers */

export interface MarketScanTelemetry {
  readonly structureId: Structure['id'];
  readonly scanCounter: number;
  readonly poolSize: number;
  readonly simDay: number;
  readonly cost_cc: number;
}

export interface MarketHireTelemetry {
  readonly employeeId: Employee['id'];
  readonly structureId: Structure['id'];
}

export interface MarketIntentProcessingResult {
  readonly market: WorkforceMarketState;
  readonly newEmployees: readonly Employee[];
  readonly charges: readonly WorkforceMarketCharge[];
  readonly scanTelemetry: readonly MarketScanTelemetry[];
  readonly hireTelemetry: readonly MarketHireTelemetry[];
}

export function resolveWorkforceConfig(config?: WorkforceConfig): WorkforceConfig {
  return config ?? DEFAULT_WORKFORCE_CONFIG;
}

export function createEmployeeFromCandidate(
  candidate: WorkforceMarketCandidate,
  roles: readonly EmployeeRole[],
  structureId: Structure['id'],
  worldSeed: string,
  currentSimDay: number,
): Employee | undefined {
  const role = roles.find((entry) => entry.slug === candidate.roleSlug);

  if (!role) {
    return undefined;
  }

  const employeeId = deterministicUuid(worldSeed, `workforce:employee:${candidate.id}`);
  const rngSeedUuid = deterministicUuidV7(worldSeed, `workforce:employee-seed:${candidate.id}`);

  const skillMap = new Map<string, number>();
  skillMap.set(candidate.skills3.main.slug, candidate.skills3.main.value01);

  for (const secondary of candidate.skills3.secondary) {
    if (!skillMap.has(secondary.slug)) {
      skillMap.set(secondary.slug, secondary.value01);
    }
  }

  const skills = Array.from(skillMap.entries()).map(([skillKey, level01]) => ({
    skillKey,
    level01,
  }));

  const skillTriad = {
    main: {
      skillKey: candidate.skills3.main.slug,
      level01: candidate.skills3.main.value01,
    },
    secondary: candidate.skills3.secondary.map((entry) => ({
      skillKey: entry.slug,
      level01: entry.value01,
    })),
  } as const;

  const traits = candidate.traits.map((trait) => ({
    traitId: trait.id,
    strength01: clamp01(trait.strength01),
  }));

  const baselineRate =
    BASELINE_RATE_OFFSET_CC_PER_H + BASELINE_RATE_SKILL_MULTIPLIER * candidate.skills3.main.value01;
  const salaryExpectation = Math.max(0, candidate.expectedBaseRate_per_h ?? baselineRate);
  const laborMarketFactor =
    baselineRate > 0 ? Math.max(MIN_LABOR_MARKET_FACTOR, salaryExpectation / baselineRate) : 1;
  const employmentStartDay = Math.max(0, Math.trunc(currentSimDay));

  return {
    id: employeeId,
    name: `${candidate.roleSlug} candidate ${employeeId.slice(0, EMPLOYEE_ID_SLICE_LENGTH)}`,
    roleId: role.id,
    rngSeedUuid,
    assignedStructureId: structureId,
    morale01: DEFAULT_MORALE01,
    fatigue01: DEFAULT_FATIGUE01,
    skills,
    skillTriad,
    traits,
    schedule: {
      hoursPerDay: DEFAULT_HOURS_PER_DAY,
      overtimeHoursPerDay: 0,
      daysPerWeek: DEFAULT_DAYS_PER_WEEK,
      shiftStartHour: DEFAULT_SHIFT_START_HOUR,
    },
    baseRateMultiplier: 1,
    experience: createInitialExperience(),
    laborMarketFactor,
    timePremiumMultiplier: 1,
    employmentStartDay,
    salaryExpectation_per_h: salaryExpectation,
    raise: createInitialRaiseState(employmentStartDay),
  } satisfies Employee;
}

export function processMarketIntents({
  intents,
  marketState,
  config,
  worldSeed,
  currentSimHours,
  currentSimDay,
  roles,
}: {
  readonly intents: readonly (HiringMarketScanIntent | HiringMarketHireIntent)[];
  readonly marketState: WorkforceMarketState;
  readonly config: WorkforceConfig['market'];
  readonly worldSeed: string;
  readonly currentSimHours: number;
  readonly currentSimDay: number;
  readonly roles: readonly EmployeeRole[];
}): MarketIntentProcessingResult {
  let nextMarket = marketState;
  const newEmployees: Employee[] = [];
  const charges: WorkforceMarketCharge[] = [];
  const scanTelemetry: MarketScanTelemetry[] = [];
  const hireTelemetry: MarketHireTelemetry[] = [];

  for (const intent of intents) {
    switch (intent.type) {
      case 'hiring.market.scan': {
        const result = performMarketScan({
          market: nextMarket,
          config,
          worldSeed,
          structureId: intent.structureId,
          currentSimHours,
          roles,
        });

        nextMarket = result.market;

        if (result.didScan && result.pool) {
          const scanCounter = result.scanCounter ?? 0;
          charges.push({
            structureId: intent.structureId,
            amountCc: config.scanCost_cc,
            scanCounter,
          });
          scanTelemetry.push({
            structureId: intent.structureId,
            scanCounter,
            poolSize: result.pool.length,
            simDay: currentSimDay,
            cost_cc: config.scanCost_cc,
          });
        }

        break;
      }

      case 'hiring.market.hire': {
        const result = performMarketHire({
          market: nextMarket,
          structureId: intent.candidate.structureId,
          candidateId: intent.candidate.candidateId,
        });

        nextMarket = result.market;

        if (result.candidate) {
          const employee = createEmployeeFromCandidate(
            result.candidate,
            roles,
            intent.candidate.structureId,
            worldSeed,
            currentSimDay,
          );

          if (employee) {
            newEmployees.push(employee);
            hireTelemetry.push({
              employeeId: employee.id,
              structureId: employee.assignedStructureId,
            });
          }
        }

        break;
      }

      default: {
        const exhaustiveCheck: never = intent;
        throw new Error(`Unsupported workforce market intent: ${JSON.stringify(exhaustiveCheck)}`);
      }
    }
  }

  return {
    market: nextMarket,
    newEmployees,
    charges,
    scanTelemetry,
    hireTelemetry,
  } satisfies MarketIntentProcessingResult;
}
