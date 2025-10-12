export function cloneTelemetryPayload(payload: Record<string, unknown>): Record<string, unknown> {
  if (typeof structuredClone === 'function') {
    return structuredClone(payload);
  }

  const jsonClone = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  return jsonClone;
}
