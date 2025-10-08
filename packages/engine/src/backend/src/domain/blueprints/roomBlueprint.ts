import { z } from 'zod';

import { createFiniteNumber, createNonEmptyString } from '../schemas/primitives.ts';
import { assertBlueprintClassMatchesPath, type BlueprintPathOptions } from './taxonomy.ts';

const slugSchema = z
  .string({ required_error: 'slug is required.' })
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be kebab-case (lowercase letters, digits, hyphen).');

const economyAreaCost = createFiniteNumber({
  requiredError: 'economy.areaCost is required.',
  message: 'economy.areaCost must be a finite number.'
});

const economySchema = z
  .object({
    areaCost: economyAreaCost.min(0, 'economy.areaCost must be >= 0.')
  })
  .strict();

const roomClassSchema = z
  .string({ required_error: 'class is required.' })
  .regex(
    /^room\.purpose(?:\.[a-z0-9]+)+$/,
    'class must use the "room.purpose.<slug>" taxonomy namespace.'
  );

const roomPurposeBlueprintSchema = z
  .object({
    id: z.string().uuid('Room blueprint id must be a UUID v4.'),
    slug: slugSchema,
    class: roomClassSchema,
    name: createNonEmptyString({ message: 'Room name must not be empty.' }),
    description: createNonEmptyString({ message: 'Room description must not be empty.' }).optional(),
    economy: economySchema
  })
  .strict();

export type RoomPurposeBlueprint = z.infer<typeof roomPurposeBlueprintSchema>;

export interface ParseRoomPurposeBlueprintOptions extends BlueprintPathOptions {
  readonly filePath?: string;
}

export function parseRoomPurposeBlueprint(
  input: unknown,
  options: ParseRoomPurposeBlueprintOptions = {}
): RoomPurposeBlueprint {
  const blueprint = roomPurposeBlueprintSchema.parse(input);

  if (options.filePath) {
    assertBlueprintClassMatchesPath(blueprint.class, options.filePath, options);
  }

  return blueprint;
}

export { roomPurposeBlueprintSchema };
