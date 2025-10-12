import { SOCKET_ERROR_CODES, type TransportAckErrorCode } from "@wb/transport-sio";

export interface IntentErrorDictionaryEntry {
  readonly code: TransportAckErrorCode;
  readonly title: string;
  readonly description: string;
  readonly action: string;
}

type IntentErrorDictionary = Readonly<Record<TransportAckErrorCode, IntentErrorDictionaryEntry>>;

const INTENT_ERROR_DICTIONARY: IntentErrorDictionary = Object.freeze({
  [SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED]: {
    code: SOCKET_ERROR_CODES.TELEMETRY_WRITE_REJECTED,
    title: "Telemetry channel is read-only",
    description:
      "The server treated this submission as telemetry. Intents must be emitted via the intents namespace.",
    action: "Reload the page to reset the connection. If the issue persists, contact the team with the error code."
  },
  [SOCKET_ERROR_CODES.INTENT_INVALID]: {
    code: SOCKET_ERROR_CODES.INTENT_INVALID,
    title: "Intent payload failed validation",
    description:
      "The backend rejected this intent because required fields were missing or invalid.",
    action: "Review the form inputs, fix highlighted issues, and resubmit."
  },
  [SOCKET_ERROR_CODES.INTENT_CHANNEL_INVALID]: {
    code: SOCKET_ERROR_CODES.INTENT_CHANNEL_INVALID,
    title: "Unsupported event on intents namespace",
    description:
      "The transport only accepts intent:submit events. Another event name was received by the server.",
    action: "Reload the workspace to restore the intent client and retry."
  },
  [SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR]: {
    code: SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR,
    title: "Intent handler reported an error",
    description:
      "The backend encountered an unexpected error while applying this intent.",
    action: "Try again in a few seconds. If it continues to fail, file a bug with the reference message."
  }
});

const FALLBACK_ENTRY: IntentErrorDictionaryEntry = Object.freeze({
  code: SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR,
  title: "Unknown intent acknowledgement error",
  description:
    "The transport returned an acknowledgement code that is not part of the documented contract.",
  action: "Retry the action or escalate to the simulator team with the acknowledgement payload."
});

export function resolveIntentError(code: TransportAckErrorCode): IntentErrorDictionaryEntry {
  if (Object.prototype.hasOwnProperty.call(INTENT_ERROR_DICTIONARY, code)) {
    return INTENT_ERROR_DICTIONARY[code];
  }

  return {
    ...FALLBACK_ENTRY,
    code
  };
}

export { INTENT_ERROR_DICTIONARY };
