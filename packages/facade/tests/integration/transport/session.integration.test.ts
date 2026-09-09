/* eslint-disable wb-sim/no-ts-import-js-extension */

import { createDemoScenario, type EconomyLedgerEntry } from '@wb/engine';
import { io as createClient } from 'socket.io-client';
import { describe, expect, it } from 'vitest';
import { INTENT_EVENT, type TransportAck } from '../../../src/transport/adapter.js';
import { startFacadeDevServer } from '../../../src/transport/devServer.js';
import type { SessionEnvelope } from '../../../src/intents/session/index.js';
import { MAX_SESSION_ENVELOPE_BYTES } from '../../../src/transport/server.js';
import { onceConnected } from './helpers.js';

const intentId = (sequence: number) => `80000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;

async function submit(socket: ReturnType<typeof createClient>, payload: Record<string, unknown>): Promise<TransportAck> {
  return new Promise((resolve) => socket.emit(INTENT_EVENT, payload, resolve));
}

function savedSession(ack: TransportAck): SessionEnvelope {
  return (ack as TransportAck & { readonly result: { readonly session: SessionEnvelope } }).result.session;
}

function createLongRunningWorld() {
  const world = createDemoScenario({ companyName: 'Long Session', seed: 'long-session' });
  const initialBalance = world.economy?.balanceCc ?? 0;
  const longRunLedger = Array.from({ length: 6_000 }, (_, index): EconomyLedgerEntry => ({
    id: `90000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    category: 'operating_expense',
    direction: 'debit',
    amountCc: 1,
    balanceAfterCc: initialBalance - index - 1,
    occurredAtSimTimeHours: index + 1,
    referenceId: `simulation-hour:${String(index + 1)}`,
    description: 'Hourly electricity, water, workforce and device operating expense accrual',
    metadata: { tick: index + 1, energyCostCc: 0.5, waterCostCc: 0.5 },
  }));

  return {
    ...world,
    simTimeHours: 6_000,
    economy: {
      ...world.economy!,
      balanceCc: initialBalance - longRunLedger.length,
      ledger: [...(world.economy?.ledger ?? []), ...longRunLedger],
    },
  };
}

async function expectOversizedDisconnect(
  socket: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Oversized packet did not disconnect.')), 10_000);
    socket.once('disconnect', (reason) => {
      clearTimeout(timeout);
      resolve(reason);
    });
    socket.emit(INTENT_EVENT, payload, () => {
      clearTimeout(timeout);
      reject(new Error('Oversized packet unexpectedly reached the intent handler.'));
    });
  });
}

describe('R-800 authoritative session export/import', () => {
  it('round-trips JSON, restores playback/journey, resets staged commands, and resumes deterministically', async () => {
    const world = createDemoScenario({ companyName: 'Session Roundtrip', seed: 'session-roundtrip' });
    const devServer = await startFacadeDevServer({ host: '127.0.0.1', port: 0, world });
    const socket = createClient(`${devServer.server.url}/intents`, { transports: ['websocket'], forceNew: true });
    try {
      await onceConnected(socket);
      await submit(socket, { type: 'simulation.control.pause' });
      await submit(socket, { type: 'simulation.control.speed', multiplier: 4 });
      const firstSave = await submit(socket, { type: 'session.save.v1', intentId: intentId(1) });
      expect(firstSave).toMatchObject({ ok: true, result: { command: 'session.save', replayed: false } });
      const session = JSON.parse(JSON.stringify(savedSession(firstSave))) as SessionEnvelope;
      expect(session).not.toHaveProperty('readModels');
      expect(session.playback).toEqual({ status: 'paused', speedMultiplier: 4 });
      expect(session.journeyProgress.milestones[0]?.code).toBe('game-started');

      await submit(socket, { type: 'intent.structure.rename.v1', structureId: world.company.structures[0]!.id, name: 'Staged Future' });
      const loaded = await submit(socket, { type: 'session.load.v1', intentId: intentId(3), session });
      expect(loaded).toMatchObject({
        ok: true, result: { command: 'session.load', worldHash: session.worldHash, replayed: false },
        stateAfter: { simTimeHours: session.engineSave.simTime.hoursElapsed, paused: true, speedMultiplier: 4, journeyMilestoneCount: session.journeyProgress.milestones.length },
      });
      await submit(socket, { type: 'simulation.control.step' });
      const firstContinuation = savedSession(await submit(socket, { type: 'session.save.v1', intentId: intentId(4) }));
      expect(firstContinuation.engineSave.world.company.structures[0]!.name).not.toBe('Staged Future');
      const secondLoad = await submit(socket, { type: 'session.load.v1', intentId: intentId(5), session });
      await submit(socket, { type: 'simulation.control.step' });
      const continued = savedSession(await submit(socket, { type: 'session.save.v1', intentId: intentId(6) }));
      expect(continued.worldHash).toBe(firstContinuation.worldHash);
      expect(await submit(socket, { type: 'session.load.v1', intentId: intentId(5), session })).toEqual(secondLoad);

      const conflict = await submit(socket, {
        type: 'session.load.v1', intentId: intentId(5),
        session: { ...session, playback: { ...session.playback, speedMultiplier: 2 } },
      });
      expect(conflict).toMatchObject({ ok: false, error: { message: expect.stringContaining('intent_conflict') } });
    } finally {
      socket.disconnect();
      await devServer.stop();
    }
  });

  it('rejects future/corrupt versions atomically without changing world or playback', async () => {
    const world = createDemoScenario({ companyName: 'Atomic Session', seed: 'atomic-session' });
    const devServer = await startFacadeDevServer({ host: '127.0.0.1', port: 0, world });
    const socket = createClient(`${devServer.server.url}/intents`, { transports: ['websocket'], forceNew: true });
    try {
      await onceConnected(socket);
      await submit(socket, { type: 'simulation.control.pause' });
      const before = savedSession(await submit(socket, { type: 'session.save.v1', intentId: intentId(10) }));
      const unsupportedSession = await submit(socket, {
        type: 'session.load.v1', intentId: intentId(11), session: { ...before, sessionSchemaVersion: 99 },
      });
      expect(unsupportedSession).toMatchObject({ ok: false, error: { message: expect.stringContaining('unsupported_session_version') } });
      const unsupportedSave = await submit(socket, {
        type: 'session.load.v1', intentId: intentId(12),
        session: { ...before, engineSave: { ...before.engineSave, schemaVersion: 999 } },
      });
      expect(unsupportedSave).toMatchObject({ ok: false, error: { message: expect.stringContaining('unsupported_save_version') } });
      const after = savedSession(await submit(socket, { type: 'session.save.v1', intentId: intentId(13) }));
      expect(after.worldHash).toBe(before.worldHash);
      expect(after.playback).toEqual(before.playback);
    } finally {
      socket.disconnect();
      await devServer.stop();
    }
  });

  it('loads a measured 6000-hour envelope above 1 MiB and rejects packets above the bounded ingress without mutation', async () => {
    const devServer = await startFacadeDevServer({
      host: '127.0.0.1', port: 0, world: createLongRunningWorld(),
    });
    const socket = createClient(`${devServer.server.url}/intents`, { transports: ['websocket'], forceNew: true });
    const oversizedSocket = createClient(`${devServer.server.url}/intents`, { transports: ['websocket'], forceNew: true });
    try {
      await Promise.all([onceConnected(socket), onceConnected(oversizedSocket)]);
      await submit(socket, { type: 'simulation.control.pause' });
      const before = savedSession(await submit(socket, { type: 'session.save.v1', intentId: intentId(20) }));
      const measuredBytes = Buffer.byteLength(JSON.stringify(before), 'utf8');
      expect(measuredBytes).toBeGreaterThan(2 * 1024 * 1024);
      expect(measuredBytes).toBeLessThan(MAX_SESSION_ENVELOPE_BYTES);

      const loaded = await submit(socket, { type: 'session.load.v1', intentId: intentId(21), session: before });
      expect(loaded).toMatchObject({
        ok: true,
        result: { command: 'session.load', worldHash: before.worldHash, replayed: false },
      });

      const oversizedPayload = {
        type: 'session.load.v1',
        intentId: intentId(22),
        session: before,
        transportPadding: 'x'.repeat(MAX_SESSION_ENVELOPE_BYTES),
      };
      expect(Buffer.byteLength(JSON.stringify(oversizedPayload), 'utf8')).toBeGreaterThan(MAX_SESSION_ENVELOPE_BYTES);
      await expect(expectOversizedDisconnect(oversizedSocket, oversizedPayload)).resolves.toMatch(/transport close|parse error/);

      const after = savedSession(await submit(socket, { type: 'session.save.v1', intentId: intentId(23) }));
      expect(after.worldHash).toBe(before.worldHash);
      expect(after.playback).toEqual(before.playback);
    } finally {
      socket.disconnect();
      oversizedSocket.disconnect();
      await devServer.stop();
    }
  }, 30_000);
});
