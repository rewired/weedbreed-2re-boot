import { describe, expect, it } from 'vitest';
import { io as createClient, type Socket } from 'socket.io-client';
/* eslint-disable wb-sim/no-ts-import-js-extension */
import type { Employee, EmployeeRole, Structure, Zone, ZoneDeviceInstance } from '@/backend/src/domain/world.ts';
import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';
import type { EngineRunContext } from '@/backend/src/engine/Engine.ts';
import { INTENT_EVENT, SOCKET_ERROR_CODES, type TransportAck } from '../../../src/transport/adapter.ts';
import { createEngineCommandPipeline } from '../../../src/transport/engineCommandPipeline.js';
import { startFacadeDevServer } from '../../../src/transport/devServer.ts';
import { createNamespaceClient, createTransportHarness, disconnectClient, onceConnected } from './helpers.ts';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
const ack = (client: Socket, intent: Record<string, unknown>) => new Promise<TransportAck>((resolve) => client.emit(INTENT_EVENT, intent, resolve));
const LIGHT_DEVICE_ID = '00000000-0000-4000-8000-000000000201';
const LIGHT_BLUEPRINT_ID = '00000000-0000-4000-8000-000000000501';
const EMPLOYEE_ID = '00000000-0000-4000-8000-000000000301';
const ROLE_ID = '00000000-0000-4000-8000-000000000302';
const createEmployee = (structureId: Structure['id']): Employee => ({ id: EMPLOYEE_ID as Employee['id'], name: 'Jordan Cultivator', roleId: ROLE_ID as EmployeeRole['id'], rngSeedUuid: '018f43f1-8b44-7b74-b3ce-5fbd7be3c201', assignedStructureId: structureId, morale01: 0.75, fatigue01: 0.1, skills: [], traits: [], schedule: { hoursPerDay: 8, overtimeHoursPerDay: 0, daysPerWeek: 5, shiftStartHour: 6 }, baseRateMultiplier: 1, experience: { hoursAccrued: 0, level01: 0 }, laborMarketFactor: 1, timePremiumMultiplier: 1, employmentStartDay: 0, salaryExpectation_per_h: 10, raise: { cadenceSequence: 0, nextEligibleDay: 180 } });
const createSimulationClient = async (url: string) => { const socket = createClient(`${url}/intents`, { transports: ['websocket'], forceNew: true }); await onceConnected(socket); return socket; };

describe('intent regression coverage', () => {
  it('acknowledges rename and move intents with deterministic metadata', async () => {
    let world = createDemoWorld();
    const context: EngineRunContext = {};
    const structure = world.company.structures[0] as Mutable<Structure> | undefined;
    const growRoom = structure?.rooms.find((room) => room.purpose === 'growroom') as (Mutable<Structure['rooms'][0]> & { zones: Mutable<Zone>[] }) | undefined;
    if (!structure || !growRoom) throw new Error('Demo world missing growroom.');
    const targetRoomId = '00000000-0000-4000-8000-000000000210' as Structure['rooms'][0]['id'];
    structure.rooms = [...structure.rooms, { id: targetRoomId, slug: 'veg-annex', name: 'Vegetative Annex', purpose: 'growroom', floorArea_m2: growRoom.floorArea_m2, height_m: growRoom.height_m, devices: [], zones: [] }];
    const pipeline = createEngineCommandPipeline({ world: { get: () => world, set: (next) => (world = next) }, context });
    const harness = await createTransportHarness(async (intent) => { const overlay = await pipeline.handle(intent); pipeline.advanceTick(); return overlay; });
    let client: Socket | null = null;
    try {
      client = await createNamespaceClient(harness, '/intents');
      expect(await ack(client, { type: 'intent.structure.rename.v1', structureId: structure.id, name: 'Renamed Structure', intentId: 'intent-rename-1', correlationId: 'corr-rename-1' })).toMatchObject({ ok: true, status: 'queued', intentId: 'intent-rename-1', correlationId: 'corr-rename-1' });
      expect(world.company.structures[0]?.name).toBe('Renamed Structure');
      const renameFailure = await ack(client, { type: 'intent.structure.rename.v1', structureId: structure.id, name: ' ', intentId: 'intent-rename-fail', correlationId: 'corr-rename-fail' });
      expect(renameFailure).toMatchObject({ ok: false, status: 'rejected' });
      expect(renameFailure.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR);
      expect(renameFailure.error?.message).toMatch(/Name must not be empty/i);
      const zone = growRoom.zones[0];
      if (!zone) throw new Error('Missing cultivation zone.');
      expect(await ack(client, { type: 'intent.zone.move.v1', structureId: structure.id, zoneId: zone.id, targetRoomId, intentId: 'intent-move-1', correlationId: 'corr-move-1' })).toMatchObject({ ok: true, status: 'queued', intentId: 'intent-move-1', correlationId: 'corr-move-1' });
      expect(world.company.structures[0]?.rooms.find((room) => room.id === targetRoomId)?.zones.some((candidate) => candidate.id === zone.id)).toBe(true);
      const duplicateMove = await ack(client, { type: 'intent.zone.move.v1', structureId: structure.id, zoneId: zone.id, targetRoomId, intentId: 'intent-move-fail', correlationId: 'corr-move-fail' });
      expect(duplicateMove.ok).toBe(false);
      expect(duplicateMove.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR);
      expect(duplicateMove.error?.message).toMatch(/already assigned/i);
    } finally {
      if (client) await disconnectClient(client);
      await harness.close();
    }
  });
  it('surfaces environment adjustment acknowledgements and validation failures', async () => {
    let world = createDemoWorld();
    const context: EngineRunContext = {};
    const structure = world.company.structures[0] as Mutable<Structure> | undefined;
    const growRoom = structure?.rooms.find((room) => room.purpose === 'growroom') as (Mutable<Structure['rooms'][0]> & { zones: Mutable<Zone>[] }) | undefined;
    const zone = growRoom?.zones[0];
    if (!structure || !growRoom || !zone) throw new Error('Demo world missing growroom zone.');
    zone.devices = [
      { id: LIGHT_DEVICE_ID as ZoneDeviceInstance['id'], name: 'Demo Light', slug: 'demo-light', blueprintId: LIGHT_BLUEPRINT_ID as ZoneDeviceInstance['blueprintId'], placementScope: 'zone', quality01: 0.95, condition01: 0.9, powerDraw_W: 600, dutyCycle01: 1, efficiency01: 0.9, coverage_m2: zone.floorArea_m2, airflow_m3_per_h: 0, sensibleHeatRemovalCapacity_W: 0, effects: ['lighting'], effectConfigs: { lighting: { ppfd_center_umol_m2s: 400, photonEfficacy_umol_per_J: 2.5 } } },
      { id: '00000000-0000-4000-8000-000000000202' as ZoneDeviceInstance['id'], name: 'Demo HVAC', slug: 'demo-hvac', blueprintId: '00000000-0000-4000-8000-000000000502' as ZoneDeviceInstance['blueprintId'], placementScope: 'zone', quality01: 0.9, condition01: 0.85, powerDraw_W: 5000, dutyCycle01: 1, efficiency01: 0.95, coverage_m2: zone.floorArea_m2, airflow_m3_per_h: 0, sensibleHeatRemovalCapacity_W: 5000, effects: ['thermal'], effectConfigs: { thermal: { mode: 'auto', max_heat_W: 5000, max_cool_W: 5000, setpoint_C: zone.environment.airTemperatureC } } }
    ];
    const pipeline = createEngineCommandPipeline({ world: { get: () => world, set: (next) => (world = next) }, context });
    const harness = await createTransportHarness(async (intent) => { const overlay = await pipeline.handle(intent); pipeline.advanceTick(); return overlay; });
    let client: Socket | null = null;
    try {
      client = await createNamespaceClient(harness, '/intents');
      const schedule = { onHours: 18, offHours: 6, startHour: 2 } as Zone['lightSchedule'];
      expect(await ack(client, { type: 'intent.zone.lighting.adjust.v1', structureId: structure.id, zoneId: zone.id, lightSchedule: schedule, intentId: 'intent-light-1', correlationId: 'corr-light-1' })).toMatchObject({ ok: true, status: 'queued', intentId: 'intent-light-1', correlationId: 'corr-light-1', result: { command: 'zone.adjustLighting', structureId: structure.id, zoneId: zone.id, lightSchedule: schedule } });
      expect(world.company.structures[0]?.rooms.find((room) => room.id === growRoom.id)?.zones.find((candidate) => candidate.id === zone.id)?.lightSchedule).toEqual(schedule);
      expect(world.company.structures[0]?.rooms.find((room) => room.id === growRoom.id)?.zones.find((candidate) => candidate.id === zone.id)?.photoperiodPhase).toBe('vegetative');
      const floweringSchedule = { onHours: 12, offHours: 12, startHour: 2 } as Zone['lightSchedule'];
      expect(await ack(client, { type: 'intent.zone.lighting.adjust.v1', structureId: structure.id, zoneId: zone.id, lightSchedule: floweringSchedule, intentId: 'intent-flower-1', correlationId: 'corr-flower-1' })).toMatchObject({ ok: true, result: { command: 'zone.adjustLighting', lightSchedule: floweringSchedule } });
      expect(world.company.structures[0]?.rooms.find((room) => room.id === growRoom.id)?.zones.find((candidate) => candidate.id === zone.id)?.photoperiodPhase).toBe('flowering');
      const invalidLighting = await ack(client, { type: 'intent.zone.lighting.adjust.v1', structureId: structure.id, zoneId: zone.id, lightSchedule: { onHours: 20, offHours: 5, startHour: 0 }, intentId: 'intent-light-fail', correlationId: 'corr-light-fail' });
      expect(invalidLighting.ok).toBe(false);
      expect(invalidLighting.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR);
      expect(invalidLighting.error?.message).toMatch(/allocate exactly 24 hours/i);
      const currentTemperature = zone.environment.airTemperatureC;
      expect(await ack(client, { type: 'intent.zone.climate.adjust.v1', structureId: structure.id, zoneId: zone.id, target: { temperature_C: currentTemperature }, intentId: 'intent-climate-1', correlationId: 'corr-climate-1' })).toMatchObject({ ok: true, status: 'queued', intentId: 'intent-climate-1', correlationId: 'corr-climate-1', result: { command: 'zone.adjustClimate', structureId: structure.id, zoneId: zone.id, targetTemperature_C: currentTemperature } });
      const structureRef = world.company.structures[0];
      if (structureRef) {
        structureRef.rooms = structureRef.rooms.map((room) =>
          room.id === growRoom.id
            ? ({
                ...room,
                zones: room.zones.map((candidate) =>
                  candidate.id === zone.id ? { ...candidate, devices: candidate.devices.slice(0, 1) } : candidate,
                ),
              })
            : room,
        ) as typeof structureRef.rooms;
      }
      const climateFailure = await ack(client, { type: 'intent.zone.climate.adjust.v1', structureId: structure.id, zoneId: zone.id, target: { temperature_C: currentTemperature + 5 }, intentId: 'intent-climate-fail', correlationId: 'corr-climate-fail' });
      expect(climateFailure.ok).toBe(false);
      expect(climateFailure.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR);
      expect(climateFailure.error?.message).toMatch(/lacks heating capacity/i);
    } finally {
      if (client) await disconnectClient(client);
      await harness.close();
    }
  });
  it('propagates workforce, maintenance, and simulation control acknowledgements', async () => {
    let world = createDemoWorld();
    const context: EngineRunContext = {};
    const structure = world.company.structures[0] as Mutable<Structure> | undefined;
    if (!structure) throw new Error('Demo world missing structure.');
    world.workforce = { ...world.workforce, roles: [{ id: ROLE_ID as EmployeeRole['id'], slug: 'cultivation-tech', name: 'Cultivation Technician', coreSkills: [] }], employees: [createEmployee(structure.id)] };
    const pipeline = createEngineCommandPipeline({ world: { get: () => world, set: (next) => (world = next) }, context });
    const harness = await createTransportHarness(async (intent) => { const overlay = await pipeline.handle(intent); pipeline.advanceTick(); return overlay; });
    let client: Socket | null = null;
    let devServer: Awaited<ReturnType<typeof startFacadeDevServer>> | null = null;
    let simulationClient: Socket | null = null;
    try {
      client = await createNamespaceClient(harness, '/intents');
      expect(await ack(client, { type: 'maintenance.start', deviceId: '00000000-0000-4000-8000-000000000401', intentId: 'intent-maint-1', correlationId: 'corr-maint-1' })).toMatchObject({ ok: true, status: 'queued', intentId: 'intent-maint-1', correlationId: 'corr-maint-1' });
      expect(await ack(client, { type: 'hr.assign', employeeId: EMPLOYEE_ID, target: structure.id, intentId: 'intent-assign-1', correlationId: 'corr-assign-1' })).toMatchObject({ ok: true, status: 'queued', intentId: 'intent-assign-1', correlationId: 'corr-assign-1', result: { workforce: { type: 'hr.assign', employeeId: EMPLOYEE_ID, nextStructureId: structure.id, targetScope: 'structure', targetId: structure.id } } });
      const assignFailure = await ack(client, { type: 'hr.assign', employeeId: '00000000-0000-4000-8000-00000000ffff', target: structure.id, intentId: 'intent-assign-fail', correlationId: 'corr-assign-fail' });
      expect(assignFailure.ok).toBe(false);
      expect(assignFailure.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR);
      expect(assignFailure.error?.message).toMatch(/Employee .* not found/i);
      devServer = await startFacadeDevServer({ host: '127.0.0.1', port: 0 });
      simulationClient = await createSimulationClient(devServer.server.url);
      expect(await ack(simulationClient, { type: 'simulation.control.play', intentId: 'intent-sim-play', correlationId: 'corr-sim-play' })).toMatchObject({ ok: true, status: 'applied', intentId: 'intent-sim-play', correlationId: 'corr-sim-play', stateAfter: { running: true, paused: false } });
      const speedFailure = await ack(simulationClient, { type: 'simulation.control.speed', multiplier: 0, intentId: 'intent-sim-fail', correlationId: 'corr-sim-fail' });
      expect(speedFailure.ok).toBe(false);
      expect(speedFailure.error?.code).toBe(SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR);
      expect(speedFailure.error?.message).toMatch(/Number must be greater than 0/i);
    } finally {
      if (client) await disconnectClient(client);
      await harness.close();
      if (simulationClient) await disconnectClient(simulationClient);
      if (devServer) await devServer.stop();
    }
  });
});
