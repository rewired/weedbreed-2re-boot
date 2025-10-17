import { describe, expect, it } from 'vitest';
import { createDeterministicWorld } from '@wb/facade/backend/deterministicWorldLoader';
import { parseCultivationMethodBlueprint } from '@/backend/src/domain/blueprints/cultivationMethodBlueprint.ts';
import { parseStructureBlueprint } from '@/backend/src/domain/blueprints/structureBlueprint.ts';
import seaOfGreenJson from '../../../../../data/blueprints/cultivation-method/sea-of-green.json' with { type: 'json' };
import screenOfGreenJson from '../../../../../data/blueprints/cultivation-method/screen-of-green.json' with { type: 'json' };
import smallWarehouseJson from '../../../../../data/blueprints/structure/small-warehouse.json' with { type: 'json' };
import mediumWarehouseJson from '../../../../../data/blueprints/structure/medium-warehouse.json' with { type: 'json' };

describe('createDeterministicWorld — Task 1100', () => {
  it('produces identical world snapshots for the same seed and diverges for different seeds', () => {
    const seed = 'vitest-seed';
    const first = createDeterministicWorld({ seed });
    const second = createDeterministicWorld({ seed });
    const alternate = createDeterministicWorld({ seed: 'vitest-seed-alt' });

    expect(first.world).toEqual(second.world);
    expect(first.companyWorld).toEqual(second.companyWorld);
    expect(alternate.world.id).not.toBe(first.world.id);
    expect(alternate.companyWorld.id).not.toBe(first.companyWorld.id);
  });

  it('integrates blueprint fixtures into the company world hierarchy', () => {
    const { companyWorld, world } = createDeterministicWorld({ seed: 'blueprint-check' });

    const structures = companyWorld.structures;
    expect(structures.length).toBe(2);

    const expectedStructureNames = new Set([
      `${parseStructureBlueprint(smallWarehouseJson).name} Alpha`,
      `${parseStructureBlueprint(mediumWarehouseJson).name} Beta`,
    ]);
    expect(new Set(structures.map((structure) => structure.name))).toEqual(expectedStructureNames);

    for (const structure of structures) {
      expect(structure.rooms.length).toBeGreaterThan(0);
      const growRooms = structure.rooms.filter((room) => room.purpose === 'growroom');
      expect(growRooms.length).toBeGreaterThan(0);

      for (const room of growRooms) {
        expect(room.zones.length).toBeGreaterThan(0);
        for (const zone of room.zones) {
          expect(zone.devices.length).toBeGreaterThan(0);
        }
      }
    }

    const zoneCultivationIds = structures.flatMap((structure) =>
      structure.rooms.flatMap((room) => room.zones.map((zone) => zone.cultivationMethodId)),
    );

    const seaOfGreenId = parseCultivationMethodBlueprint(seaOfGreenJson).id;
    const screenOfGreenId = parseCultivationMethodBlueprint(screenOfGreenJson).id;
    expect(new Set(zoneCultivationIds)).toEqual(new Set([seaOfGreenId, screenOfGreenId]));

    expect(world.workforce.employees.length).toBeGreaterThan(0);
  });
});
