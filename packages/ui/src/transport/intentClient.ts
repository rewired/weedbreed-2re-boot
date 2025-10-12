import {
  INTENT_EVENT,
  assertTransportAck,
  type TransportAck,
  type TransportAckError,
  type TransportIntentEnvelope
} from "@wb/transport-sio";
import { io, type ManagerOptions, type Socket as ClientSocket, type SocketOptions } from "socket.io-client";

import { resolveIntentError, type IntentErrorDictionaryEntry } from "@ui/intl/intentErrors";

const INTENT_NAMESPACE = "/intents" as const;

interface IntentClientDependencies {
  readonly createSocket: (
    uri: string,
    options: Partial<ManagerOptions & SocketOptions>
  ) => ClientSocket;
}

const defaultDependencies: IntentClientDependencies = {
  createSocket: io
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export type SuccessfulIntentAck = TransportAck & { ok: true; error?: undefined };
export type FailedIntentAck = TransportAck & { ok: false; error: TransportAckError };

export interface IntentSubmissionSuccess {
  readonly ok: true;
  readonly ack: SuccessfulIntentAck;
}

export interface IntentSubmissionFailure {
  readonly ok: false;
  readonly ack: FailedIntentAck;
  readonly dictionary: IntentErrorDictionaryEntry;
}

export type IntentSubmissionResult =
  | IntentSubmissionSuccess
  | IntentSubmissionFailure;

export interface IntentSubmissionHandlers {
  onResult(result: IntentSubmissionResult): void;
}

export interface IntentClientOptions {
  readonly baseUrl: string;
  readonly transports?: readonly ("websocket" | "polling")[];
}

export interface IntentClient {
  submit(
    intent: TransportIntentEnvelope,
    handlers: IntentSubmissionHandlers | null | undefined
  ): Promise<IntentSubmissionResult>;
  disconnect(): Promise<void>;
}

function isSuccessfulAck(ack: TransportAck): ack is SuccessfulIntentAck {
  return ack.ok;
}

function toFailedAck(ack: TransportAck): FailedIntentAck {
  if (ack.ok || !ack.error) {
    throw new TypeError("Failed acknowledgements require an error payload.");
  }

  const failureAck: FailedIntentAck = {
    ok: false,
    error: ack.error
  };

  return failureAck;
}

function normaliseError(reason: unknown, fallbackMessage: string): Error {
  return reason instanceof Error ? reason : new Error(fallbackMessage, { cause: reason });
}

export function createIntentClient(
  options: IntentClientOptions,
  dependencies: IntentClientDependencies = defaultDependencies
): IntentClient {
  const endpoint = `${trimTrailingSlash(options.baseUrl)}${INTENT_NAMESPACE}`;
  const socket = dependencies.createSocket(endpoint, {
    transports: options.transports as ("websocket" | "polling")[] | undefined
  });

  return {
    disconnect(): Promise<void> {
      socket.disconnect();
      return Promise.resolve();
    },
    async submit(
      intent: TransportIntentEnvelope,
      handlers: IntentSubmissionHandlers | null | undefined
    ): Promise<IntentSubmissionResult> {
      if (!handlers || typeof handlers.onResult !== "function") {
        throw new TypeError("Intent submissions require an acknowledgement handler.");
      }

      if (!socket.connected) {
        socket.connect();
      }

      return await new Promise<IntentSubmissionResult>((resolve, reject) => {
        const handleAcknowledgement = (ack: unknown) => {
          try {
            assertTransportAck(ack);
          } catch (error) {
            reject(normaliseError(error, "Transport acknowledgement violated the contract."));
            return;
          }

          const typedAck: TransportAck = ack;

          if (isSuccessfulAck(typedAck)) {
            const result: IntentSubmissionSuccess = {
              ok: true,
              ack: typedAck
            };
            handlers.onResult(result);
            resolve(result);
            return;
          }

          const failureAck = toFailedAck(typedAck);
          const dictionary = resolveIntentError(failureAck.error.code);
          const result: IntentSubmissionFailure = {
            ok: false,
            ack: failureAck,
            dictionary
          };
          handlers.onResult(result);
          resolve(result);
        };

        try {
          socket.emit(INTENT_EVENT, intent, handleAcknowledgement);
        } catch (error) {
          reject(normaliseError(error, "Intent submission failed before acknowledgement."));
        }
      });
    }
  } satisfies IntentClient;
}
