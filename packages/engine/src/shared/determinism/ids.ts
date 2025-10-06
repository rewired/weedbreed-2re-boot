import { v7 as uuidv7 } from 'uuid';

/**
 * Generate a UUIDv7 identifier. Wrapper exists so production code can swap
 * implementations after design review.
 */
export function newV7(): string {
  return uuidv7();
}
