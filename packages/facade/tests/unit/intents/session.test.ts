/* eslint-disable wb-sim/no-ts-import-js-extension */

import { describe, expect, it } from 'vitest';
import {
  reconcileJourneyProgress,
  journeyProgressSchema,
  sessionEnvelopeSchema,
  sessionLoadIntentSchema,
  sessionSaveIntentSchema,
} from '../../../src/intents/session/index.js';
import {
  createDemoScenario,
  type BreedingRun,
  type EconomyLedgerEntry,
  type SimulationWorld,
} from '@wb/engine';

const ID = '80000000-0000-4000-8000-000000000001';

describe('R-800 session schemas', () => {
  it('accepts the payload-free save command and rejects additions', () => {
    expect(sessionSaveIntentSchema.parse({ type: 'session.save.v1', intentId: ID })).toEqual({
      type: 'session.save.v1', intentId: ID,
    });
    expect(sessionSaveIntentSchema.safeParse({ type: 'session.save.v1', intentId: ID, world: {} }).success).toBe(false);
  });

  it('validates explicit playback and unique milestone evidence', () => {
    const session = {
      sessionSchemaVersion: 1, engineSave: {}, worldHash: 'a'.repeat(64),
      playback: { status: 'paused', speedMultiplier: 4 },
      journeyProgress: { milestones: [{ code: 'game-started', achievedAtSimTimeHours: 0, evidenceId: 'world' }] },
    } as const;
    expect(sessionEnvelopeSchema.parse(session)).toEqual(session);
    expect(sessionLoadIntentSchema.parse({ type: 'session.load.v1', intentId: ID, session }).session).toEqual(session);
    expect(journeyProgressSchema.safeParse({ milestones: [session.journeyProgress.milestones[0], session.journeyProgress.milestones[0]] }).success).toBe(false);
    expect(sessionEnvelopeSchema.safeParse({ ...session, sessionSchemaVersion: 2 }).success).toBe(false);
  });

  it('holds sale evidence until both parents qualify, then appends the canonical prefix once', () => {
    const base = createDemoScenario({ companyName: 'Ordered Journey', seed: 'ordered-journey' });
    const sale = {
      id: '81000000-0000-4000-8000-000000000001', category: 'sale', direction: 'credit',
      amountCc: 10, balanceAfterCc: 10, occurredAtSimTimeHours: 5,
      referenceId: 'lot', description: 'Northern sale', metadata: { strainId: '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7' },
    } satisfies EconomyLedgerEntry;
    const previous = { milestones: [
      { code: 'game-started' as const, achievedAtSimTimeHours: 0, evidenceId: base.id },
      { code: 'facility-ready' as const, achievedAtSimTimeHours: 1, evidenceId: 'zone' },
      { code: 'parents-sown' as const, achievedAtSimTimeHours: 2, evidenceId: 'plants' },
      { code: 'incident-resolved' as const, achievedAtSimTimeHours: 3, evidenceId: 'incident' },
    ] };
    const partial: SimulationWorld = {
      ...base, simTimeHours: 10,
      economy: { ...base.economy!, ledger: [sale] },
      breeding: { ...base.breeding!, qualifiedParents: [{
        strainId: '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7',
        lotId: '81000000-0000-4000-8000-000000000002',
        harvestIntentId: '81000000-0000-4000-8000-000000000003',
        quality01: 0.8, qualifiedAtSimTimeHours: 4,
      }] },
    };
    expect(reconcileJourneyProgress(previous, partial)).toEqual(previous);
    const complete: SimulationWorld = {
      ...partial,
      breeding: { ...partial.breeding!, qualifiedParents: [
        ...partial.breeding!.qualifiedParents,
        {
          strainId: '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2',
          lotId: '81000000-0000-4000-8000-000000000004',
          harvestIntentId: '81000000-0000-4000-8000-000000000005',
          quality01: 0.85, qualifiedAtSimTimeHours: 10,
        },
      ] },
    };
    const reconciled = reconcileJourneyProgress(previous, complete);
    expect(reconciled.milestones.slice(-2).map((item) => item.code)).toEqual(['parents-harvested', 'sale-completed']);
    expect(reconciled.milestones.slice(-2).map((item) => item.achievedAtSimTimeHours)).toEqual([10, 10]);
    expect(reconcileJourneyProgress(reconciled, complete)).toEqual(reconciled);
  });

  it('keeps harvested-parent evidence stable when the harvested F1 also qualifies as a future parent', () => {
    const base = createDemoScenario({ companyName: 'Stable Parent Evidence', seed: 'stable-parent-evidence' });
    const parentIds = [
      '3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7',
      '8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2',
    ] as const;
    const qualifiedParents = parentIds.map((strainId, index) => ({
      strainId,
      lotId: `82000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      harvestIntentId: `83000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      quality01: 0.8,
      qualifiedAtSimTimeHours: 10,
    }));
    const eligible: SimulationWorld = {
      ...base,
      simTimeHours: 10,
      breeding: { ...base.breeding!, qualifiedParents },
    };
    const run = {
      id: '84000000-0000-4000-8000-000000000002',
      intentId: '84000000-0000-4000-8000-000000000001',
      generation: 'F1',
      laboratoryRoomId: '84000000-0000-4000-8000-000000000003',
      status: 'candidates-generated',
      seedParentId: parentIds[0],
      pollenParentId: parentIds[1],
      qualifyingLotIds: [qualifiedParents[0]!.lotId, qualifiedParents[1]!.lotId],
      populationSize: 3,
      candidates: [],
      createdAtSimTimeHours: 10,
    } satisfies BreedingRun;
    const startedWorld: SimulationWorld = {
      ...eligible,
      breeding: { ...eligible.breeding!, runs: [run] },
    };
    const prefix = { milestones: [
      { code: 'game-started' as const, achievedAtSimTimeHours: 0, evidenceId: 'world' },
      { code: 'facility-ready' as const, achievedAtSimTimeHours: 1, evidenceId: 'zone' },
      { code: 'parents-sown' as const, achievedAtSimTimeHours: 2, evidenceId: 'plants' },
      { code: 'incident-resolved' as const, achievedAtSimTimeHours: 3, evidenceId: 'incident' },
    ] };
    const initialProgress = reconcileJourneyProgress(prefix, startedWorld);
    const parentMilestone = initialProgress.milestones.find((item) => item.code === 'parents-harvested')!;
    const withQualifiedF1: SimulationWorld = {
      ...startedWorld,
      breeding: {
        ...startedWorld.breeding!,
        qualifiedParents: [...startedWorld.breeding!.qualifiedParents, {
          strainId: '87000000-0000-4000-8000-000000000001',
          lotId: '85000000-0000-4000-8000-000000000001',
          harvestIntentId: '86000000-0000-4000-8000-000000000001',
          quality01: 0.9,
          qualifiedAtSimTimeHours: 20,
        }],
      },
    };

    expect(parentMilestone.evidenceId).toBe([...parentIds].sort().join(','));
    expect(reconcileJourneyProgress(initialProgress, withQualifiedF1)).toEqual(initialProgress);
  });
});
