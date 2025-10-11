export function cloneTelemetryPayload(payload: Record<string, unknown>): Record<string, unknown> {
  if (typeof structuredClone === 'function') {
    return structuredClone(payload);
  }

  return JSON.parse(JSON.stringify(payload));
}
