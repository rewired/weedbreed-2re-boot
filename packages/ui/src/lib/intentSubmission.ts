import type { IntentClient, IntentSubmissionHandlers } from "@ui/transport";

const handlers: IntentSubmissionHandlers = {
  onResult() {
    // Acknowledgement handled via resolved result
  }
};

export async function submitIntentOrThrow(
  intentClient: IntentClient,
  payload: Record<string, unknown>
): Promise<void> {
  const result = await intentClient.submit(payload, handlers);
  if (!result.ok) {
    throw new Error(result.dictionary.description);
  }
}
