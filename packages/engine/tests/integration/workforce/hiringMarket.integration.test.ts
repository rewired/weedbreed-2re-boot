import { describe, expect, it } from 'vitest';

import { createDemoWorld, runStages } from '@/backend/src/engine/testHarness';
import type { EngineRunContext } from '@/backend/src/engine/Engine';
import {
  consumeWorkforceMarketCharges,
  configureWorkforceContext,
  queueWorkforceIntents,
} from '@/backend/src/engine/pipeline/applyWorkforce';
import { DEFAULT_WORKFORCE_CONFIG } from '@/backend/src/config/workforce';
import { HOURS_PER_DAY } from '@/backend/src/constants/simConstants';
import type { EmployeeRole, SimulationWorld, WorkforceState } from '@/backend/src/domain/world';
import { expectDefined } from '../../util/expectors';

function createRole(): EmployeeRole {
  return {
    id: '00000000-0000-0000-0000-00000000hr01' as EmployeeRole['id'],
    slug: 'gardener',
    name: 'Gardener',
    coreSkills: [{ skillKey: 'gardening', minSkill01: 0.5 }],
  } satisfies EmployeeRole;
}

function createWorkforce(structureId: string, role: EmployeeRole): WorkforceState {
  return {
    roles: [role],
    employees: [],
    taskDefinitions: [],
    taskQueue: [],
    kpis: [],
    warnings: [],
    payroll: {
      dayIndex: 0,
      totals: { baseMinutes: 0, otMinutes: 0, baseCost: 0, otCost: 0, totalLaborCost: 0 },
      byStructure: [],
    },
    market: { structures: [] },
  } satisfies WorkforceState;
}

function createTelemetryCollector(): {
  readonly bus: NonNullable<EngineRunContext['telemetry']>;
  readonly events: { topic: string; payload: Record<string, unknown> }[];
} {
  const events: { topic: string; payload: Record<string, unknown> }[] = [];
  return {
    events,
    bus: {
      emit(topic: string, payload: Record<string, unknown>): void {
        events.push({ topic, payload });
      },
    },
  };
}

describe('hiring market pipeline integration', () => {
  it('performs scans, enforces cooldowns, and hires candidates', () => {
    const world = createDemoWorld();
    const structureId = world.company.structures[0].id;
    const role = createRole();
    world.simTimeHours = 2 * HOURS_PER_DAY;
    world.workforce = createWorkforce(structureId, role);

    const telemetry = createTelemetryCollector();
    const ctx: EngineRunContext = { telemetry: telemetry.bus } satisfies EngineRunContext;
    configureWorkforceContext(ctx, DEFAULT_WORKFORCE_CONFIG);
    queueWorkforceIntents(ctx, [
      {
        type: 'hiring.market.scan',
        structureId,
      },
    ]);

    const scannedWorld = runStages(world, ctx, ['applyWorkforce']);
    const marketState = scannedWorld.workforce.market.structures.find(
      (entry) => entry.structureId === structureId,
    );

    expect(marketState).toBeDefined();
    expect(marketState?.pool).toHaveLength(DEFAULT_WORKFORCE_CONFIG.market.poolSize);
    expect(marketState?.scanCounter).toBe(1);
    expect(marketState?.lastScanDay).toBe(Math.floor(world.simTimeHours / HOURS_PER_DAY));

    const charges = consumeWorkforceMarketCharges(ctx);
    expect(charges).toEqual([
      {
        structureId,
        amountCc: DEFAULT_WORKFORCE_CONFIG.market.scanCost_cc,
        scanCounter: 1,
      },
    ]);

    const scanEvent = telemetry.events.find(
      (event) => event.topic === 'telemetry.hiring.market_scan.completed.v1',
    );
    expect(scanEvent?.payload).toMatchObject({
      structureId,
      scanCounter: 1,
      poolSize: DEFAULT_WORKFORCE_CONFIG.market.poolSize,
    });

    const cooldownTelemetry = createTelemetryCollector();
    const cooldownContext: EngineRunContext = { telemetry: cooldownTelemetry.bus } satisfies EngineRunContext;
    configureWorkforceContext(cooldownContext, DEFAULT_WORKFORCE_CONFIG);
    queueWorkforceIntents(cooldownContext, [
      {
        type: 'hiring.market.scan',
        structureId,
      },
    ]);

    const cooldownWorld: SimulationWorld = {
      ...scannedWorld,
      simTimeHours: scannedWorld.simTimeHours + 5 * HOURS_PER_DAY,
    };

    const afterCooldownAttempt = runStages(cooldownWorld, cooldownContext, ['applyWorkforce']);
    const unchangedMarket = afterCooldownAttempt.workforce.market.structures.find(
      (entry) => entry.structureId === structureId,
    );

    expect(unchangedMarket?.scanCounter).toBe(1);

    const hiringEventsDuringCooldown = cooldownTelemetry.events.filter((event) =>
      event.topic.startsWith('telemetry.hiring.'),
    );

    expect(hiringEventsDuringCooldown).toEqual([]);

    const hireTelemetry = createTelemetryCollector();
    const candidate = expectDefined(marketState?.pool[0]);

    const hireContext: EngineRunContext = { telemetry: hireTelemetry.bus } satisfies EngineRunContext;
    configureWorkforceContext(hireContext, DEFAULT_WORKFORCE_CONFIG);
    queueWorkforceIntents(hireContext, [
      {
        type: 'hiring.market.hire',
        candidate: {
          structureId,
          candidateId: candidate.id,
        },
      },
    ]);

    const hiredWorld = runStages(afterCooldownAttempt, hireContext, ['applyWorkforce']);
    const hiredMarket = expectDefined(
      hiredWorld.workforce.market.structures.find((entry) => entry.structureId === structureId),
    );

    expect(hiredMarket.pool).toHaveLength((marketState?.pool.length ?? 1) - 1);
    expect(hiredWorld.workforce.employees).toHaveLength(1);

    const hireEvent = expectDefined(
      hireTelemetry.events.find(
        (event) => event.topic === 'telemetry.hiring.employee.onboarded.v1',
      ),
    );
    expect(hireEvent.payload).toMatchObject({ structureId });
  });
});
