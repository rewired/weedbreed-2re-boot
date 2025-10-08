import { z } from 'zod';

import type { Uuid } from '../schemas/primitives.js';

const uuidString = z.string().uuid('Cultivation method price keys must be UUID v4 identifiers.');

const cultivationMethodPriceEntrySchema = z
  .object({
    setupCost: z
      .number({ invalid_type_error: 'setupCost must be a number.' })
      .finite('setupCost must be finite.')
      .min(0, 'setupCost must be non-negative.')
  })
  .transform((value) => ({ setupCost_per_h: value.setupCost }));

const cultivationMethodPriceMapSchema = z
  .object({
    version: z.string().optional(),
    cultivationMethodPrices: z.record(uuidString, cultivationMethodPriceEntrySchema)
  })
  .strict();

export type CultivationMethodPriceEntry = z.infer<typeof cultivationMethodPriceEntrySchema>;

export interface CultivationMethodPriceMap {
  readonly cultivationMethodPrices: ReadonlyMap<Uuid, CultivationMethodPriceEntry>;
}

export function parseCultivationMethodPriceMap(input: unknown): CultivationMethodPriceMap {
  const parsed = cultivationMethodPriceMapSchema.parse(input);
  const entries = new Map<Uuid, CultivationMethodPriceEntry>();

  for (const [id, entry] of Object.entries(parsed.cultivationMethodPrices)) {
    entries.set(id as Uuid, entry);
  }

  return {
    cultivationMethodPrices: entries
  } satisfies CultivationMethodPriceMap;
}
