import { describe, expect, it } from 'vitest';

import { resolveStorageRoomForStructure } from '@/backend/src/services/storage/resolveStorageRoom';
import { createDemoWorld } from '@/backend/src/engine/testHarness';
import type { Room } from '@/backend/src/domain/world';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

describe('resolveStorageRoomForStructure', () => {
  it('resolves a storage room by class', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];

    const result = resolveStorageRoomForStructure(structure.id, world);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.room.class).toBe('room.storage');
  });

  it('resolves a storage room by storage tag when class is missing', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const storageRoom = structure.rooms.find((room) => room.class === 'room.storage');

    if (!storageRoom) {
      throw new Error('Expected demo world to include a storage room');
    }

    const mutableRoom = storageRoom as Mutable<Room>;
    mutableRoom.class = undefined;
    mutableRoom.tags = ['storage'];

    const result = resolveStorageRoomForStructure(structure.id, world);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.room.tags).toContain('storage');
  });

  it('returns not_found when no storage room is available', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const storageRoom = structure.rooms.find((room) => room.class === 'room.storage');

    if (!storageRoom) {
      throw new Error('Expected demo world to include a storage room');
    }

    const mutableRoom = storageRoom as Mutable<Room>;
    mutableRoom.class = undefined;
    mutableRoom.tags = [];

    const result = resolveStorageRoomForStructure(structure.id, world);

    expect(result).toEqual({ ok: false, reason: 'not_found', candidates: [] });
  });

  it('returns ambiguous when multiple storage rooms are present', () => {
    const world = createDemoWorld();
    const structure = world.company.structures[0];
    const storageRoom = structure.rooms.find((room) => room.class === 'room.storage');

    if (!storageRoom) {
      throw new Error('Expected demo world to include a storage room');
    }

    const mutableStructure = structure as Mutable<typeof structure>;
    mutableStructure.rooms = [
      ...structure.rooms,
      {
        ...storageRoom,
        id: '00000000-0000-0000-0000-00000000ffff' as Room['id']
      }
    ];

    const result = resolveStorageRoomForStructure(structure.id, world);

    expect(result).toEqual({
      ok: false,
      reason: 'ambiguous',
      candidates: expect.arrayContaining([storageRoom.id, '00000000-0000-0000-0000-00000000ffff'])
    });
  });
});
