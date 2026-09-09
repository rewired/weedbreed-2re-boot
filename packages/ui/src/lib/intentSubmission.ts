import type { IntentClient, IntentSubmissionHandlers } from "@ui/transport";
import type { TransportIntentEnvelope } from "@wb/transport-sio";

const handlers: IntentSubmissionHandlers = {
  onResult() {
    // Acknowledgement handled via resolved result
  }
};

export async function submitIntentOrThrow(
  intentClient: IntentClient,
  payload: TransportIntentEnvelope
): Promise<void> {
  const result = await intentClient.submit(payload, handlers);
  if (!result.ok) {
    throw new Error(result.dictionary.description);
  }
}
