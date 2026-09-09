import { describe, expect, it } from 'vitest';

import {
  createDemoScenario,
  parseCompanyWorld,
  validateCompanyWorld,
} from '@wb/engine';
import { loadDemoScenarioBlueprints } from '@/backend/src/scenarios/demoScenarioBlueprints';

describe('canonical demo scenario integration', () => {
  it('creates the valid empty facility required by game.new.v1', () => {
    const world = createDemoScenario({ companyName: 'First F1 Labs', seed: 'integration-seed' });
    const [structure] = world.company.structures;
    const growrooms = structure?.rooms.filter((room) => room.purpose === 'growroom') ?? [];
    const storageRooms = structure?.rooms.filter((room) => room.purpose === 'storageroom') ?? [];
    const laboratories = structure?.rooms.filter((room) => room.purpose === 'laboratory') ?? [];
    const zones = growrooms.flatMap((room) => room.zones);
    const blueprints = loadDemoScenarioBlueprints();

    expect(world.company.structures).toHaveLength(1);
    expect(growrooms).toHaveLength(1);
    expect(storageRooms).toHaveLength(1);
    expect(laboratories).toHaveLength(1);
    expect(zones).toHaveLength(2);
    expect(zones.every((zone) => zone.plants.length === 0)).toBe(true);
    expect(zones.every((zone) => zone.devices.length === 0)).toBe(true);

    for (const zone of zones) {
      expect(zone.cultivationMethodId).toBe(blueprints.cultivationMethod.id);
      expect(zone.containerId).toBe(blueprints.container.id);
      expect(zone.substrateId).toBe(blueprints.substrate.id);
      expect(zone.irrigationMethodId).toBe(blueprints.irrigation.id);
      expect(blueprints.cultivationMethod.containers).toContain(blueprints.container.slug);
      expect(blueprints.cultivationMethod.substrates).toContain(blueprints.substrate.slug);
      expect(blueprints.irrigation.compatibility.substrates).toContain(blueprints.substrate.slug);
    }

    expect(parseCompanyWorld(world.company)).toStrictEqual(world.company);
    expect(validateCompanyWorld(world.company)).toEqual({ ok: true, issues: [] });
  });
});
