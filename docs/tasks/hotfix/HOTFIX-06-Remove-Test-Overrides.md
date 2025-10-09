# Remove HOTFIX-06 test-only ESLint overrides

**ID:** HOTFIX-06-FOLLOWUP
**Status:** Planned
**Owner:** unassigned
**Priority:** P1
**Tags:** lint, tooling

## Rationale
Residual type-resolution work from HOTFIX-01 through HOTFIX-05 is expected to make
the HOTFIX-06 safety-rule relaxations obsolete. We need a clear follow-up to
remove the temporary overrides so tests regain the same lint guarantees as
production code once alias gaps are closed.

## Scope
- In: delete the HOTFIX-06 test-only rule overrides once type information is
  fully resolved across tests.
- In: restore the unsafe call/member/access/non-null assertion checks for test
  sources.
- Out: broader lint rule changes unrelated to the temporary overrides.

## Deliverables
- Update `eslint.config.js` to drop the HOTFIX-06 override block and TODO.
- Ensure any residual unsafe usage surfaced by re-enabled rules is addressed in
  tests or helper utilities.
- Document the removal in `docs/CHANGELOG.md`.

## Acceptance Criteria
- Lint passes for the workspace with the HOTFIX-06 overrides removed and no new
  unsafe lint violations in test files.
- TODO comment referencing HOTFIX-06 is removed.

## References
- HOTFIX-01 through HOTFIX-05 task notes for the outstanding type-resolution
  work.
- SEC §14 and DD linting guidance for mandatory ESLint guardrails.
