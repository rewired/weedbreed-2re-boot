/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  selectF1Candidate,
  startF1BreedingRun,
  type SimulationWorld,
} from '@wb/engine';
import type { TransportAck, TransportIntentEnvelope } from '../../transport/adapter.js';
import {
  breedingCrossF1IntentSchema,
  breedingSelectCandidateIntentSchema,
} from './schemas.js';

export interface BreedingWorldAccess {
  readonly get: () => SimulationWorld;
  readonly set: (world: SimulationWorld) => void;
}

export interface BreedingAck extends TransportAck {
  readonly ok: true;
  readonly status: 'applied';
  readonly result: {
    readonly command: 'breeding.crossF1' | 'breeding.selectCandidate';
    readonly runId: string;
    readonly candidateIds: readonly string[];
    readonly selectedCandidateId: string | null;
    readonly customStrainId: string | null;
    readonly replayed: boolean;
  };
  readonly stateAfter: { readonly simTimeHours: number };
}

/** Adapts validated breeding intents to the authoritative, replay-safe engine commands. */
export function createBreedingIntentHandler(worldAccess: BreedingWorldAccess) {
  return async (envelope: TransportIntentEnvelope): Promise<BreedingAck> => {
    const world = worldAccess.get();
    const result = envelope.type === 'breeding.crossF1.v1'
      ? (() => {
          const intent = breedingCrossF1IntentSchema.parse(envelope);
          return {
            command: 'breeding.crossF1' as const,
            outcome: startF1BreedingRun(world, {
              intentId: intent.intentId,
              laboratoryRoomId: intent.laboratoryRoomId,
              seedParentId: intent.seedParentId,
              pollenParentId: intent.pollenParentId,
              populationSize: intent.populationSize,
            }),
          };
        })()
      : (() => {
          const intent = breedingSelectCandidateIntentSchema.parse(envelope);
          return {
            command: 'breeding.selectCandidate' as const,
            outcome: selectF1Candidate(world, {
              intentId: intent.intentId,
              runId: intent.runId,
              candidateId: intent.candidateId,
              name: intent.name,
            }),
          };
        })();

    if (!result.outcome.ok) throw new Error(`${result.outcome.code}: ${result.outcome.message}`);
    worldAccess.set(result.outcome.world);
    const run = result.outcome.run;
    return {
      ok: true,
      status: 'applied',
      appliedTick: result.outcome.world.simTimeHours,
      result: {
        command: result.command,
        runId: run.id,
        candidateIds: run.candidates.map((candidate) => candidate.id),
        selectedCandidateId: run.selectedCandidateId ?? null,
        customStrainId: run.selectedCandidateId ?? null,
        replayed: result.outcome.replayed,
      },
      stateAfter: { simTimeHours: result.outcome.world.simTimeHours },
    } satisfies BreedingAck;
  };
}
