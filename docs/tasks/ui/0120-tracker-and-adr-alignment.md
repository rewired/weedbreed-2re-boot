# Tracker and ADR Alignment

**ID:** 0120
**Status:** Planned
**Owner:** unassigned
**Priority:** P2
**Tags:** ui, documentation, adr

## Rationale
The UI task tracker, CHANGELOG, and ADR stubs must flag the transition away from fixtures so later feature work references authoritative documentation.

## Scope
- In: update docs/tasks/ui/_plan/0000-plan-index.md references, docs/CHANGELOG.md, and any relevant ADR placeholders to reflect the live-data wiring initiative.
- In: ensure UI Task tracker entries identify this plan’s tasks and successors.
- Out: no code or schema modifications; documentation only.
- Out: no restructuring of existing ADR decisions beyond annotations.
- Rollback: revert documentation edits to previous state if alignment is rejected.

## Deliverables
- Annotated CHANGELOG entry under current date describing the planning milestone.
- ADR note (existing or new placeholder) referencing the fixture-to-live migration with links to execution tasks.
- Updated tracker references (e.g., docs/tasks/ui/_plan assets) reflecting ownership.

## Acceptance Criteria
- Documentation edits span ≤3 files and ≤150 diff lines total.
- CHANGELOG entry uses established format and includes references to SEC/DD alignment work.
- ADR note clearly states status (e.g., “Pending execution via Task 1100+”) and links to plan index.
- Markdown lint passes (`pnpm lint:docs` if available).
- Tests to add/modify: none.

## References
- Root AGENTS.md §15 (Acceptance Criteria)
- SEC Preface (documentation precedence)
- DD §0 documentation governance
- Existing ADR contribution guidelines
