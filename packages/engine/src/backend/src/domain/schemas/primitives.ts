import { z } from 'zod';

/**
 * Leaf schema primitives.
 *
 * NOTE: Leaf schemas must never import from the domain schemas barrel. Doing so
 * reintroduces circular dependencies; always import other leaves directly.
 */

export const nonEmptyString = z
  .string({ invalid_type_error: 'Expected a string.' })
  .trim()
  .min(1, 'String fields must not be empty.');

export const finiteNumber = z
  .number({ invalid_type_error: 'Expected a number.' })
  .finite({ message: 'Value must be a finite number.' });

export const nonNegativeNumber = finiteNumber.min(
  0,
  'Value must be greater than or equal to zero.'
);

export const unitIntervalNumber = finiteNumber
  .min(0, 'Value must be greater than or equal to zero.')
  .max(1, 'Value must be less than or equal to one.');

export const integerNumber = z
  .number({ invalid_type_error: 'Expected a number.' })
  .int('Value must be an integer.');

export const uuidSchema = z
  .string()
  .uuid('Expected a UUID v4 identifier.')
  .brand<'Uuid'>();

export type Uuid = z.infer<typeof uuidSchema>;
