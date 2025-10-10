/**
 * Normalise unknown error-like values to an {@link Error} instance.
 *
 * The SEC/TDD catch policy requires that we avoid propagating raw values
 * thrown from external libraries or dynamic code paths. This helper wraps
 * those values in an `Error` while preserving native `Error` instances.
 *
 * @param value - Unknown error-like value caught from a try/catch block.
 * @param fallbackMessage - Message to use when the value is not an `Error`.
 */
export function normaliseUnknownError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) {
    return value;
  }

  return new Error(fallbackMessage, { cause: value });
}
