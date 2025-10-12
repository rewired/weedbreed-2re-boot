# Intent Playground

The intent playground shows how to exercise the Socket.IO intents namespace with
the shared client shipped in `@wb/ui`. Use it to verify intent flows alongside
the façade/transport stack during development.

## Prerequisites

1. Start the façade transport server with the Socket.IO adapter running on
   `http://127.0.0.1:4000` (see [dev-stack](./dev-stack.md)).
2. Run the UI workspace in another terminal:

   ```bash
   pnpm --filter @wb/ui dev
   ```

## Using the intent client in the UI shell

The client lives at `@ui/transport/intentClient`. It connects to the `/intents`
namespace, emits `intent:submit`, and validates acknowledgements with the
transport contract from Task 0022.

```ts
import { createIntentClient } from "@ui/transport";

const client = createIntentClient({ baseUrl: "http://127.0.0.1:4000" });

client.submit(
  { type: "workforce.assign-task", assigneeId: "uuid", taskId: "uuid" },
  {
    onResult(result) {
      if (result.ok) {
        console.info("Intent accepted by the backend");
        return;
      }

      console.warn(result.dictionary.title, {
        code: result.dictionary.code,
        message: result.ack.error.message
      });
    }
  }
);
```

Every failed acknowledgement is mapped to the dictionary exported from
`@ui/intl/intentErrors`. The entry includes a human-readable title, a
description that references the contract violation, and an action string that
can be surfaced in toast copy.

## Testing intents outside the UI

When validating backend behaviour from scripts or REST clients, reuse the same
acknowledgement guard exported by `@wb/transport-sio` to ensure payloads follow
the documented contract:

```ts
import { INTENT_EVENT, assertTransportAck } from "@wb/transport-sio";
import { io } from "socket.io-client";

const socket = io("http://127.0.0.1:4000/intents");

socket.emit(INTENT_EVENT, { type: "workforce.assign-task" }, (ack: unknown) => {
  assertTransportAck(ack);
  console.log(ack);
});
```

This mirrors the UI client while keeping tooling scripts deterministic and
aligned with SEC §11.
