# Intent: Set Light Schedule UX

**ID:** 0035
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, intents, ui, track-5

## Rationale
One exemplar intent is adjusting a zone's light schedule. Building a dedicated form with optimistic UX gated on ack success demonstrates the end-to-end intent flow and validates the error dictionary.

## Scope
- In: implement form component under `packages/ui/src/components/intents/SetLightScheduleForm.tsx` with validation aligned to SEC light schedule rules.
- In: integrate with intent client to submit payloads, show loading state, and surface toast/error copy from dictionary.
- Out: backend logic (already handled) or other intents.

## Deliverables
- Form component + hook, unit tests at `packages/ui/src/components/intents/__tests__/SetLightScheduleForm.test.tsx` covering validation and ack handling.
- Storybook (or local preview) entry documenting states (loading, success, error) under `packages/ui/src/stories/intents/SetLightScheduleForm.stories.tsx`.
- Copy updates in `packages/ui/src/intl/en.json` (or similar) for button text and error strings.

## Acceptance Criteria
- Form validates photoperiod hours sum to 24 and disables submit until valid.
- On submit, spinner shows until ack resolves; success triggers optimistic UI update via store action.
- Errors map to dictionary entries and show toast plus inline message.
- Tests cover happy path, validation error, and transport error mapping.

## References
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [Proposal §6](../../proposals/20251009-mini_frontend.md#6-data-schemas-mvp-minimal-fields)
- [AGENTS Appendix A](../../AGENTS.md#16-appendix-a-light-schedule-validation-pseudocode)
