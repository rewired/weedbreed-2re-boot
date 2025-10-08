import { createHash } from 'node:crypto';

import type { Uuid } from '../domain/schemas/primitives.ts';
import type { EmployeeRngSeedUuid } from '../domain/workforce/Employee.ts';

function formatUuid<T extends string>(bytes: Uint8Array): T {
  const hex = Buffer.from(bytes).toString('hex');
  const parts = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ];
  return parts.join('-') as T;
}

export function deterministicUuid(seed: string, streamId: string): Uuid {
  const hash = createHash('sha256');
  hash.update(seed);
  hash.update(':');
  hash.update(streamId);
  const digest = hash.digest();
  const uuidBytes = digest.subarray(0, 16);

  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x40;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;

  return formatUuid<Uuid>(uuidBytes);
}

export function deterministicUuidV7(
  seed: string,
  streamId: string,
): EmployeeRngSeedUuid {
  const hash = createHash('sha256');
  hash.update(seed);
  hash.update(':');
  hash.update(streamId);
  const digest = hash.digest();
  const uuidBytes = digest.subarray(0, 16);

  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x70;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;

  return formatUuid<EmployeeRngSeedUuid>(uuidBytes);
}
