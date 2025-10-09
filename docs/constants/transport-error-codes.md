# Transport Error Codes

Deterministic error codes acknowledged by the Socket.IO transport adapter. The
codes enforce SEC §1 read-only telemetry guarantees and TDD §11 intent routing
behaviour. Downstream clients should import `SOCKET_ERROR_CODES` and
`assertTransportAck` from `@wb/transport-sio` (re-exported by the façade) to stay
aligned with the published contract.

| Code                         | When it surfaces                                                           | References           |
| ---------------------------- | -------------------------------------------------------------------------- | -------------------- |
| `WB_TEL_READONLY`            | A telemetry namespace client attempts to emit/write to the server.         | SEC §1, TDD §11      |
| `WB_INTENT_INVALID`          | An intent submission fails schema validation (missing/invalid `type`).     | SEC §1, TDD §11.3    |
| `WB_INTENT_CHANNEL_INVALID`  | A client emits to the intents namespace using an unsupported event name.   | SEC §1, TDD §11.2    |
| `WB_INTENT_HANDLER_ERROR`    | The façade intent handler throws/rejects while processing the submission.  | SEC §1, TDD §11.4    |

All monetary or economic references remain per-hour as mandated by SEC §3.6;
transport acknowledgements do not embed tariffs or variable tick costs.
