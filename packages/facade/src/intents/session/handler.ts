/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  createSaveGame,
  hashSaveGameWorld,
  parseSaveGamePayload,
  UnsupportedSaveGameVersionError,
  type SimulationWorld,
} from '@wb/engine';
import type { TransportAck, TransportIntentEnvelope } from '../../transport/adapter.js';
import { validateJourneyProgressForWorld, type JourneyProgress } from './journeyProgress.js';
import {
  SESSION_SCHEMA_VERSION,
  sessionEnvelopeSchema,
  sessionLoadIntentSchema,
  sessionSaveIntentSchema,
  type SessionEnvelope,
  type SessionPlayback,
} from './schemas.js';

export interface SessionRuntimeAccess {
  readonly getWorld: () => SimulationWorld;
  readonly getPlayback: () => SessionPlayback;
  readonly getJourneyProgress: () => JourneyProgress;
  readonly replace: (state: {
    readonly world: SimulationWorld;
    readonly playback: SessionPlayback;
    readonly journeyProgress: JourneyProgress;
  }) => void | Promise<void>;
}

export interface SessionSaveAck extends TransportAck {
  readonly ok: true;
  readonly status: 'applied';
  readonly result: { readonly command: 'session.save'; readonly session: SessionEnvelope; readonly replayed: boolean };
  readonly stateAfter: { readonly simTimeHours: number; readonly worldHash: string };
}

export interface SessionLoadAck extends TransportAck {
  readonly ok: true;
  readonly status: 'applied';
  readonly result: { readonly command: 'session.load'; readonly worldHash: string; readonly replayed: boolean };
  readonly stateAfter: {
    readonly simTimeHours: number;
    readonly paused: boolean;
    readonly speedMultiplier: number;
    readonly journeyMilestoneCount: number;
  };
}

function assertSupportedSessionVersion(envelope: unknown): void {
  if (!envelope || typeof envelope !== 'object') throw new Error('invalid_session: Session payload must be an object.');
  const version = (envelope as Record<string, unknown>).sessionSchemaVersion;
  if (typeof version !== 'number') throw new Error('invalid_session: Session payload has no numeric sessionSchemaVersion.');
  if (version !== SESSION_SCHEMA_VERSION) {
    throw new Error(`unsupported_session_version: Session version ${String(version)} is not supported.`);
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Creates deterministic JSON-exportable save/load commands around the engine save contract. */
export function createSessionIntentHandler(access: SessionRuntimeAccess) {
  const saved = new Map<string, SessionSaveAck>();
  const loaded = new Map<string, { readonly fingerprint: string; readonly ack: SessionLoadAck }>();
  return async (envelope: TransportIntentEnvelope): Promise<SessionSaveAck | SessionLoadAck> => {
    if (envelope.type === 'session.save.v1') {
      const intent = sessionSaveIntentSchema.parse(envelope);
      const cached = saved.get(intent.intentId);
      if (cached) return cached;
      const world = access.getWorld();
      const worldHash = hashSaveGameWorld(world);
      const session = sessionEnvelopeSchema.parse({
        sessionSchemaVersion: SESSION_SCHEMA_VERSION,
        engineSave: createSaveGame(world),
        worldHash,
        playback: access.getPlayback(),
        journeyProgress: access.getJourneyProgress(),
      });
      const ack = {
        ok: true, status: 'applied', appliedTick: world.simTimeHours,
        result: { command: 'session.save', session, replayed: false },
        stateAfter: { simTimeHours: world.simTimeHours, worldHash },
      } satisfies SessionSaveAck;
      saved.set(intent.intentId, ack);
      return ack;
    }

    assertSupportedSessionVersion((envelope as Record<string, unknown>).session);
    const intent = sessionLoadIntentSchema.parse(envelope);
    const fingerprint = canonicalJson(intent.session);
    const cached = loaded.get(intent.intentId);
    if (cached) {
      if (cached.fingerprint !== fingerprint) throw new Error('intent_conflict: Load intent id was reused with another session.');
      return cached.ack;
    }
    let engineSave;
    try {
      engineSave = await parseSaveGamePayload(intent.session.engineSave);
    } catch (error: unknown) {
      if (error instanceof UnsupportedSaveGameVersionError) throw new Error(`unsupported_save_version: ${error.message}`);
      throw new Error(`invalid_engine_save: ${error instanceof Error ? error.message : String(error)}`);
    }
    const actualHash = hashSaveGameWorld(engineSave.world);
    if (actualHash !== intent.session.worldHash) {
      throw new Error('session_world_hash_mismatch: Imported world does not match its declared hash.');
    }
    let journeyProgress;
    try {
      journeyProgress = validateJourneyProgressForWorld(intent.session.journeyProgress, engineSave.world);
    } catch (error: unknown) {
      throw new Error(`invalid_journey_progress: ${error instanceof Error ? error.message : String(error)}`);
    }
    await access.replace({ world: engineSave.world, playback: intent.session.playback, journeyProgress });
    const ack = {
      ok: true, status: 'applied', appliedTick: engineSave.world.simTimeHours,
      result: { command: 'session.load', worldHash: actualHash, replayed: false },
      stateAfter: {
        simTimeHours: engineSave.world.simTimeHours,
        paused: intent.session.playback.status === 'paused',
        speedMultiplier: intent.session.playback.speedMultiplier,
        journeyMilestoneCount: journeyProgress.milestones.length,
      },
    } satisfies SessionLoadAck;
    loaded.set(intent.intentId, { fingerprint, ack });
    return ack;
  };
}
