import type { Meta, StoryObj } from "@storybook/react";
import { SOCKET_ERROR_CODES } from "@wb/transport-sio";

import { resolveIntentError } from "@ui/intl/intentErrors";
import type { IntentClient, IntentSubmissionHandlers, IntentSubmissionResult } from "@ui/transport";

import { SetLightScheduleForm, type SetLightScheduleFormProps } from "@ui/components/intents/SetLightScheduleForm";

function createMockIntentClient(mode: "success" | "error" | "loading"): IntentClient {
  return {
    async submit(_intent, handlers: IntentSubmissionHandlers): Promise<IntentSubmissionResult> {
      switch (mode) {
        case "loading":
          return await new Promise<IntentSubmissionResult>((resolve) => {
            // Intentionally keep the promise pending to demonstrate the loading state.
            void resolve;
          });
        case "error": {
          const ack = {
            ok: false as const,
            error: {
              code: SOCKET_ERROR_CODES.INTENT_HANDLER_ERROR,
              message: "Simulated handler failure"
            }
          };
          const dictionary = resolveIntentError(ack.error.code);
          const result = { ok: false as const, ack, dictionary };
          handlers.onResult(result);
          return result;
        }
        case "success":
        default: {
          const result = { ok: true as const, ack: { ok: true as const } };
          handlers.onResult(result);
          return result;
        }
      }
    },
    disconnect(): Promise<void> {
      return Promise.resolve();
    }
  } satisfies IntentClient;
}

const meta: Meta<typeof SetLightScheduleForm> = {
  title: "Intents/SetLightScheduleForm",
  component: SetLightScheduleForm,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Interactive form wiring for the zone.light-schedule.set intent. Submit the form in each story to observe the acknowledgement states."
      }
    }
  },
  args: {
    zoneId: "zone-story",
    intentClient: createMockIntentClient("success")
  } satisfies Partial<SetLightScheduleFormProps>
};

export default meta;

type Story = StoryObj<typeof SetLightScheduleForm>;

export const Success: Story = {
  parameters: {
    docs: {
      description: {
        story: "Simulates a successful acknowledgement and updates the optimistic store state."
      }
    }
  }
};

export const Loading: Story = {
  args: {
    intentClient: createMockIntentClient("loading"),
    zoneId: "zone-story-loading"
  },
  parameters: {
    docs: {
      description: {
        story: "Acknowledgement never resolves to showcase the loading spinner state."
      }
    }
  }
};

export const Error: Story = {
  args: {
    intentClient: createMockIntentClient("error"),
    zoneId: "zone-story-error"
  },
  parameters: {
    docs: {
      description: {
        story: "Demonstrates mapping of transport acknowledgement errors to toast and inline messaging."
      }
    }
  }
};
