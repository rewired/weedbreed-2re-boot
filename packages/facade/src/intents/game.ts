import { z } from 'zod';

/** Stable seed used when the start screen leaves the optional seed blank. */
export const DEFAULT_DEMO_SEED = 'WB-DEMO-DEFAULT-V1';

const companyNameSchema = z
  .string()
  .trim()
  .min(1, 'Company name must not be empty.')
  .max(80, 'Company name must not exceed 80 characters.');

const gameSeedSchema = z
  .string()
  .trim()
  .min(1, 'Seed must not be empty.')
  .max(128, 'Seed must not exceed 128 characters.')
  .default(DEFAULT_DEMO_SEED);

/** Validated transport payload for starting a canonical demo session. */
export const gameNewIntentSchema = z
  .object({
    type: z.literal('game.new.v1'),
    intentId: z.string().trim().min(1, 'game.new.v1 requires an intentId.'),
    correlationId: z.string().trim().min(1).optional(),
    companyName: companyNameSchema,
    seed: gameSeedSchema,
  })
  .strict();

/** Schema-normalised new-game intent. */
export type GameNewIntent = z.infer<typeof gameNewIntentSchema>;

/** Creates a validated new-game intent for transport submission. */
export function createGameNewIntent(
  input: Omit<GameNewIntent, 'type' | 'seed'> & { readonly seed?: string },
): GameNewIntent {
  return gameNewIntentSchema.parse({ type: 'game.new.v1', ...input });
}
