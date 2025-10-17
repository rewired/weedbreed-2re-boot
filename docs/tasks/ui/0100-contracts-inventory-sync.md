# Contracts Inventory Sync

**ID:** 0100
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** ui, contracts, documentation

## Rationale
A consolidated inventory of required read-model and intent fields is needed before wiring the UI to live data so execution tasks do not diverge from SEC and DD assumptions.

## Scope
- In: review SEC §3–§7, DD §§2–4, TDD §2 to list all structure/room/zone, HR, and sim-control data/intent fields required for the UI.
- In: capture discovered contract gaps or ambiguities as TODO notes inside relevant SEC/DD/TDD files without changing semantics.
- Out: no schema/code modifications beyond documentation notes.
- Out: no dependency or tooling adjustments.
- Rollback: delete newly added notes if the contract review proves invalid.

## Deliverables
- Updated SEC/DD/TDD markdown sections annotated with "Pending live data" notes where gaps exist.
- Table or bullet summary appended to docs/tasks/ui/_plan/0000-plan-index.md references if required by follow-up tasks.
- No code changes outside documentation.

## Acceptance Criteria
- Documentation updates touch no more than 3 files and <=150 diff lines.
- Notes explicitly cite the missing or to-be-confirmed fields per hierarchy level and intent.
- Added notes include responsible follow-up task IDs from this plan.
- Changes render without markdown lint errors (run `pnpm lint:docs` when available).
- Tests to add/modify: none (documentation-only).

## References
- SEC §3, §5, §7
- DD §2.1, §3.2
- TDD §2.4
- Root AGENTS.md (sections 0–5)
