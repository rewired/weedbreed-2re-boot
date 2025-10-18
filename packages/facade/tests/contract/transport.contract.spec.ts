import { afterEach, describe, expect, it, vi } from 'vitest';
import { io as createClient, type Socket } from 'socket.io-client';

import {
  INTENT_ERROR_EVENT,
  INTENT_EVENT,
  SOCKET_ERROR_CODES,
  TELEMETRY_ERROR_EVENT,
  assertTransportAck,
  type TransportAck,
} from '../../src/transport/adapter.ts';
import {
  COMPANY_TREE_SCHEMA_VERSION,
  STRUCTURE_TARIFFS_SCHEMA_VERSION,
  WORKFORCE_VIEW_SCHEMA_VERSION,
} from '../../src/readModels/api/schemas.ts';
import type { ReadModelProviders } from '../../src/server/http.ts';
import { createContractServerHarness, type ContractServerHarness } from './utils/server.ts';
import { TEST_READ_MODEL_SNAPSHOT } from '../fixtures/readModelSnapshot.ts';

const READ_MODEL_PROVIDERS: ReadModelProviders = {
  companyTree: () => ({
    schemaVersion: COMPANY_TREE_SCHEMA_VERSION,
    simTime: 0,
    companyId: '00000000-0000-0000-0000-000000000321',
    name: 'Contract Harness Company',
    structures: [
      {
        id: '00000000-0000-0000-0000-000000000322',
        name: 'Main Campus',
        rooms: [
          {
            id: '00000000-0000-0000-0000-000000000323',
            name: 'Growroom A',
            zones: [
              {
                id: '00000000-0000-0000-0000-000000000324',
                name: 'Zone A1',
                area_m2: 30,
                volume_m3: 90,
              },
            ],
          },
        ],
      },
    ],
  }),
  structureTariffs: () => ({
    schemaVersion: STRUCTURE_TARIFFS_SCHEMA_VERSION,
    simTime: 0,
    electricity_kwh_price: 0.4,
    water_m3_price: 3.2,
    currency: null,
  }),
  workforceView: () => ({
    schemaVersion: WORKFORCE_VIEW_SCHEMA_VERSION,
    simTime: 0,
    headcount: 4,
    roles: {
      gardener: 2,
      technician: 1,
      janitor: 1,
    },
    roster: [
      {
        employeeId: '00000000-0000-0000-0000-000000000801',
        displayName: 'Jordan Blake',
        structureId: '00000000-0000-0000-0000-000000000301',
        roleSlug: 'gardener',
        morale01: 0.68,
        fatigue01: 0.22,
        currentTaskId: null,
        nextShiftStartTick: 8,
        baseHoursPerDay: 8,
        overtimeHoursPerDay: 2,
        daysPerWeek: 5,
        shiftStartHour: 6,
        assignment: {
          scope: 'structure',
          targetId: '00000000-0000-0000-0000-000000000301',
        },
      },
    ],
    kpis: {
      utilizationPercent: 66,
      overtimeMinutes: 40,
      warnings: [],
    },
  }),
  readModels: () => TEST_READ_MODEL_SNAPSHOT,
};

const activeSockets = new Set<Socket>();
const activeHarnesses = new Set<ContractServerHarness>();

afterEach(async () => {
  const socketClosures = Array.from(activeSockets, (socket) => disconnectClient(socket));
  activeSockets.clear();

  const harnessClosures = Array.from(activeHarnesses, (harness) => harness.close());
  activeHarnesses.clear();

  await Promise.all([...socketClosures, ...harnessClosures]);
});

async function connectToNamespace(
  harness: ContractServerHarness,
  namespace: '/telemetry' | '/intents',
): Promise<Socket> {
  const socket = createClient(`${harness.transport.url}${namespace}`, {
    transports: ['websocket'],
    forceNew: true,
  });

  activeSockets.add(socket);
  await onceConnected(socket);
  return socket;
}

function onceConnected(socket: Socket): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      socket.off('connect', handleConnect);
      reject(error);
    };

    const handleConnect = () => {
      socket.off('connect_error', handleError);
      resolve();
    };

    socket.once('connect_error', handleError);
    socket.once('connect', handleConnect);
  });
}

function disconnectClient(socket: Socket): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!socket.connected) {
      socket.disconnect();
      resolve();
      return;
    }

    socket.once('disconnect', () => {
      resolve();
    });
    socket.disconnect();
  });
}

describe('contract — transport server', () => {
  it('rejects telemetry writes with deterministic acknowledgements', async () => {
    const harness = await createContractServerHarness({ providers: READ_MODEL_PROVIDERS });
    activeHarnesses.add(harness);

    const telemetryClient = await connectToNamespace(harness, '/telemetry');

    const ackPromise = new Promise<TransportAck>((resolve) => {
      telemetryClient.emit('telemetry:rogue', { attempt: true }, (ack: TransportAck) => {
        resolve(ack);
      });
    });

    const errorEvent = new Promise<TransportAck>((resolve) => {
      telemetryClient.once(TELEMETRY_ERROR_EVENT, (ack: TransportAck) => {
        resolve(ack);
      });
    });

    const ack = await ackPromise;
    assertTransportAck(ack);
    expect(ack.ok).toBe(false);
    expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED);

    const mirroredAck = await errorEvent;
    assertTransportAck(mirroredAck);
    expect(mirroredAck.ok).toBe(false);
    expect(mirroredAck.error?.code).toBe(SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED);
  });

  it('acknowledges valid intents with ok=true', async () => {
    const onIntent = vi.fn(() => undefined);
    const harness = await createContractServerHarness({
      providers: READ_MODEL_PROVIDERS,
      onIntent,
    });
    activeHarnesses.add(harness);

    const intentsClient = await connectToNamespace(harness, '/intents');
    const intentPayload = {
      type: 'workforce.scan',
      structureId: '00000000-0000-0000-0000-000000000400',
    };

    const ack = await new Promise<TransportAck>((resolve) => {
      intentsClient.emit(INTENT_EVENT, intentPayload, (response: TransportAck) => {
        resolve(response);
      });
    });

    assertTransportAck(ack);
    expect(ack).toEqual({ ok: true });
    expect(onIntent).toHaveBeenCalledTimes(1);
    expect(onIntent).toHaveBeenCalledWith(intentPayload);
  });

  it('rejects unexpected intent namespace events', async () => {
    const harness = await createContractServerHarness({ providers: READ_MODEL_PROVIDERS });
    activeHarnesses.add(harness);

    const intentsClient = await connectToNamespace(harness, '/intents');

    const ackPromise = new Promise<TransportAck>((resolve) => {
      intentsClient.emit('intent:rogue', { attempt: true }, (ack: TransportAck) => {
        resolve(ack);
      });
    });

    const errorEvent = new Promise<TransportAck>((resolve) => {
      intentsClient.once(INTENT_ERROR_EVENT, (ack: TransportAck) => {
        resolve(ack);
      });
    });

    const ack = await ackPromise;
    assertTransportAck(ack);
    expect(ack.ok).toBe(false);
    expect(ack.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_CHANNEL_INVALID);

    const mirroredAck = await errorEvent;
    assertTransportAck(mirroredAck);
    expect(mirroredAck.ok).toBe(false);
    expect(mirroredAck.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_CHANNEL_INVALID);
  });
});
