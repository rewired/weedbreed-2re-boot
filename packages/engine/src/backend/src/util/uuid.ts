/* eslint-disable @typescript-eslint/no-magic-numbers -- UUID bit flags and segment lengths use fixed literal values */
import { createHash } from 'node:crypto';

import type { Uuid } from '../domain/schemas/primitives.ts';
import type { EmployeeRngSeedUuid } from '../domain/workforce/Employee.ts';

const UUID_BYTE_LENGTH = 16 as const;
const UUID_HEX_SEGMENT_SIZES = [8, 4, 4, 4, 12] as const;

const UUID_VERSION_INDEX = 6 as const;
const UUID_VARIANT_INDEX = 8 as const;

const UUID_VERSION_MASK = 0x0f as const;
const UUID_VARIANT_MASK = 0x3f as const;

const UUID_VERSION_4_BITS = 0x40 as const;
const UUID_VERSION_7_BITS = 0x70 as const;
const UUID_VARIANT_RFC4122_BITS = 0x80 as const;

function formatUuid(bytes: Uint8Array): string {
  const hex = Buffer.from(bytes).toString('hex');
  let offset = 0;
  const parts = UUID_HEX_SEGMENT_SIZES.map((size) => {
    const segment = hex.slice(offset, offset + size);
    offset += size;
    return segment;
  });
  return parts.join('-');
}

function createUuidBytes(seed: string, streamId: string): Uint8Array {
  const hash = createHash('sha256');
  hash.update(seed);
  hash.update(':');
  hash.update(streamId);
  const digest = hash.digest();
  return digest.subarray(0, UUID_BYTE_LENGTH);
}

export function deterministicUuid(seed: string, streamId: string): Uuid {
  const uuidBytes = createUuidBytes(seed, streamId);

  uuidBytes[UUID_VERSION_INDEX] =
    (uuidBytes[UUID_VERSION_INDEX] & UUID_VERSION_MASK) | UUID_VERSION_4_BITS;
  uuidBytes[UUID_VARIANT_INDEX] =
    (uuidBytes[UUID_VARIANT_INDEX] & UUID_VARIANT_MASK) | UUID_VARIANT_RFC4122_BITS;

  return formatUuid(uuidBytes) as Uuid;
}

export function deterministicUuidV7(seed: string, streamId: string): EmployeeRngSeedUuid {
  const uuidBytes = createUuidBytes(seed, streamId);

  uuidBytes[UUID_VERSION_INDEX] =
    (uuidBytes[UUID_VERSION_INDEX] & UUID_VERSION_MASK) | UUID_VERSION_7_BITS;
  uuidBytes[UUID_VARIANT_INDEX] =
    (uuidBytes[UUID_VARIANT_INDEX] & UUID_VARIANT_MASK) | UUID_VARIANT_RFC4122_BITS;

  return formatUuid(uuidBytes) as EmployeeRngSeedUuid;
}

/* eslint-enable @typescript-eslint/no-magic-numbers */