# Restore Live Telemetry Playback Bridge

**ID:** FRONT-004
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** telemetry, backend, socket.io

## Rationale
Console logs show repeated Socket.IO timeouts because the telemetry bridge never establishes a live feed. The transport server must publish engine tick/zone/workforce events so UI dashboards receive updates.

## Scope
- In: Connect the simulation run loop to the transport telemetry binder, ensuring tick progression and event streams propagate over Socket.IO.
- In: Audit emitted topics to match UI subscribers (structure, room, zone, workforce, harvest).
- Out: Frontend state handling; intent command routing; non-Socket.IO transports.

## Deliverables
- Updated telemetry binder (e.g. `packages/transport/src/telemetry/**`) wired to engine playback.
- Automated test or harness confirming events flow over a test client.
- Troubleshooting notes in `docs/tasks/frontend/FRONT-004` for reconnect/backoff behaviour.

## Acceptance Criteria
- Telemetry server establishes a WebSocket connection without timeouts under default dev config.
- Tick, zone, and workforce events emit at expected cadence and payload matches schema.
- UI (or test client) receives updates when simulation state changes.

## References
- SEC §0.1 (transport adapter), §6 (tick pipeline)
- TDD §3 (telemetry topics)
- Root `AGENTS.md` §4 (telemetry read-only)
