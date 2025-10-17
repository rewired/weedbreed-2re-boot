# ADR-0026 — Simulation Playback Controls over Transport

## Status
Accepted — 2025-03-05

## Context
- The façade previously advanced the engine only when a gameplay intent arrived, so idle
  sessions or play/pause toggles in the UI could not drive ticks without mutating local state.
- SEC/TDD require deterministic tick cadence and explicit state carriers; scheduling ticks in
  ad-hoc UI timers risks divergence across clients and breaks transport-driven orchestration.
- Operators need remotely accessible controls (play, pause, step, speed) that translate into
  deterministic engine actions without bypassing the transport contract.

## Decision
- Introduce a façade-level playback controller that schedules `runTick` whenever a `playing`
  flag is enabled, exposes `play`, `pause`, `step`, and `setSpeed` hooks, and keeps tick speed
  configurable without leaking timers across modules.
- Extend the Socket.IO transport namespace with `simulation.control.play`, `.pause`, `.step`,
  and `.speed` intents that delegate to the playback controller while workforce intents remain
  queued for the next scheduled tick.
- Update the React UI control bar to dispatch the new intents via the existing intent client
  instead of mutating local state, ensuring acknowledgements gate UI state transitions.
- Capture the behaviour with façade playback integration tests and refreshed UI tests so the
  scheduler contract is enforced in CI.

## Consequences
- Simulation playback semantics now live centrally in the façade, guaranteeing deterministic
  tick cadence even when no gameplay intents arrive and preventing UI-local timers from
  diverging from engine state.
- Transport clients must issue the new `simulation.control.*` intents to drive playback; the
  façade remains the single authority coordinating tick execution and speed adjustments.
- Additional tests cover scheduler behaviour, increasing confidence but adding a small runtime
  cost to the façade/ui test suites.
