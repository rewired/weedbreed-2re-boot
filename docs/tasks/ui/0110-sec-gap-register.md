# SEC Gap Register

**ID:** 0110
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, documentation, governance

## Rationale
Tracking unresolved contract gaps in a dedicated register ensures downstream tasks have a single reference for pending schema clarifications before backend wiring starts.

## Scope
- In: create or update a gap register section within docs/SEC.md summarising unresolved items and linking to follow-up tasks.
- In: annotate DD and TDD with cross-references to the new register entries where those documents defer decisions.
- Out: no modifications to engine code, schemas, or transport implementations.
- Out: no updates to CHANGELOG beyond referencing the register entry.
- Rollback: remove the new register section and associated cross-references.

## Deliverables
- Gap register subsection in docs/SEC.md with enumerated entries keyed by this plan’s task IDs.
- Cross-reference notes in DD and TDD pointing to the register entry identifiers.
- Optional addition to docs/CHANGELOG.md noting the documentation update.

## Acceptance Criteria
- Total touched files ≤3 with combined diff ≤150 lines.
- Each register entry states the affected contract area, expected resolution owner, and linked execution task ID.
- CHANGELOG entry (if added) follows existing format and cites the register.
- Markdown passes lint/formatting (run `pnpm lint:docs` when available).
- Tests to add/modify: none.

## References
- SEC §0–§1 guidance on precedence
- DD §1 overview
- TDD §1 governance
- Root AGENTS.md Purpose & Acceptance Criteria
