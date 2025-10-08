import { z } from 'zod';

/**
 * Leaf schema primitives.
 *
 * NOTE: Leaf schemas must never import from the domain schemas barrel. Doing so
 * reintroduces circular dependencies; always import other leaves directly.
 */

export interface NonEmptyStringOptions {
  readonly message?: string;
  readonly invalidTypeError?: string;
  readonly requiredError?: string;
}

export function createNonEmptyString({
  message = 'String fields must not be empty.',
  invalidTypeError = 'Expected a string.',
  requiredError
}: NonEmptyStringOptions = {}): z.ZodString {
  const params: {
    invalid_type_error: string;
    required_error?: string;
  } = {
    invalid_type_error: invalidTypeError,
  };

  if (requiredError) {
    params.required_error = requiredError;
  }

  return z.string(params).trim().min(1, message);
}

export const nonEmptyString = createNonEmptyString();

export interface FiniteNumberOptions {
  readonly message?: string;
  readonly invalidTypeError?: string;
  readonly requiredError?: string;
}

export function createFiniteNumber({
  message = 'Value must be a finite number.',
  invalidTypeError = 'Expected a number.',
  requiredError
}: FiniteNumberOptions = {}): z.ZodNumber {
  const params: {
    invalid_type_error: string;
    required_error?: string;
  } = {
    invalid_type_error: invalidTypeError,
  };

  if (requiredError) {
    params.required_error = requiredError;
  }

  return z.number(params).finite({ message });
}

export const finiteNumber = createFiniteNumber();

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
