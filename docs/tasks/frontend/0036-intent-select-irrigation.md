# Intent: Select Irrigation Method UX

**ID:** 0036
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** frontend, intents, ui, track-5

## Rationale
The second exemplar intent lets growers change irrigation methods. Providing a UX consistent with the light schedule form verifies shared intent plumbing and error handling.

## Scope
- In: create `packages/ui/src/components/intents/SelectIrrigationMethodForm.tsx` listing available methods from read-model data.
- In: reuse intent client to submit selection, show progress/error states, and reset on success.
- Out: backend validations beyond ack handling (covered elsewhere).

## Deliverables
- Form component + tests under `packages/ui/src/components/intents/__tests__/SelectIrrigationMethodForm.test.tsx` covering validation and ack mapping.
- Toast/notification wiring via existing UI infrastructure to surface success/error feedback.
- Documentation update in `packages/ui/README.md` explaining how to test intents locally (link to intent playground doc).

## Acceptance Criteria
- Form disables submit until a method is selected and shows spinner during submission.
- Successful ack triggers confirmation toast and resets selection; errors map to dictionary entries.
- Tests cover success, handler error, and invalid ack scenarios.

## References
- [Proposal §4](../../proposals/20251009-mini_frontend.md#4-ui-surfaces-data-flows)
- [Proposal §6](../../proposals/20251009-mini_frontend.md#6-data-schemas-mvp-minimal-fields)
