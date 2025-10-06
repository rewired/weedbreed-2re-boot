ID: 0001
# Appendix B Crosswalk Fill

**ID:** 0002  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P0  
**Tags:** docs, governance

## Rationale
SEC migration guidance requires that every historical proposal from `/docs/task/**` and legacy design notes is mapped into [SEC Appendix B — Task Proposals Crosswalk](../SEC.md#appendix-b--task-proposals-crosswalk-preservation-of-docstask). [SEC §13 Migration Notes](../SEC.md#13-migration-notes-from-legacy-to-re-reboot) explicitly calls for reconciling those sources, and the CHANGELOG tracks prior merges. This task captures the documentation debt so Appendix B stops advertising “to be filled iteratively”.

## Scope
- Include: inventory of legacy `/docs/task/**` files, relevant items from `docs/proposals/*.md`, and CHANGELOG/ADR outcomes tied to those proposals.
- Include: populate the Appendix B table with `task_path`, title, summary, target SEC section, status (merged/deferred/contradiction), and notes linking to primary sources.
- Out of scope: altering historical proposal content or introducing new proposals; revising SEC core semantics beyond cross-referencing work.

## Deliverables
- Completed Appendix B table in `docs/SEC.md` with one row per legacy proposal, each linking to the source document and the section where it landed.
- Supplementary notes in `docs/re-reboot/contradictions.md` (if contradictions identified) with backlinks from Appendix B rows.
- CHANGELOG entry documenting the reconciliation.

## Implementation Steps
1. Enumerate existing `/docs/task/**` entries and relevant items under `docs/proposals/` to build a master list (path, title, summary, status cues).
2. For each item, determine whether it is already represented in SEC/DD/TDD; map it to the appropriate section and mark status (`merged`, `deferred`, `contradiction`).
3. Update Appendix B table in `docs/SEC.md` with rows capturing the mapping and inline links to sources and target sections.
4. For contradictions, update or create `docs/re-reboot/contradictions.md` entries and reference them in the Appendix notes column.
5. Add a CHANGELOG entry summarising the reconciliation and referencing Appendix B.

## Acceptance Criteria / DoD
- Appendix B table in `docs/SEC.md` lists every `/docs/task/**` and relevant legacy proposal with working Markdown links to both the source file and the SEC/DD/TDD section that supersedes or defers it.
- All contradictions are documented in `docs/re-reboot/contradictions.md` with Appendix B rows pointing to the entry.
- CHANGELOG entry summarises the crosswalk fill and cites Appendix B.
- No row is left blank or marked TBD; statuses use only `merged`, `deferred`, or `contradiction`.

## Tests
- Documentation lint check or Markdown link validator covering `docs/SEC.md` and `docs/re-reboot/contradictions.md` to ensure anchors resolve.
- Optional script/spec verifying that every file under `/docs/task/**` appears in Appendix B (e.g., unit test under `packages/engine/tests/unit/docs/appendixB.spec.ts`).
- CI docs build (if configured) passes with updated tables.

## Affected Files (indicative)
- `docs/SEC.md` ([§13](../SEC.md#13-migration-notes-from-legacy-to-re-reboot), [Appendix B](../SEC.md#appendix-b--task-proposals-crosswalk-preservation-of-docstask))
- `docs/re-reboot/contradictions.md`
- `docs/CHANGELOG.md`
- Legacy sources under `docs/task/**` and `docs/proposals/*.md`

## Risks & Mitigations
- **Risk:** Missing hidden legacy proposals. **Mitigation:** Use repository search to ensure complete coverage and add a regression test enumerating `/docs/task/**`.
- **Risk:** Broken anchors when sections rename. **Mitigation:** Cross-check generated anchors after editing; include doc lint in CI.
- **Risk:** Appendix table becomes unwieldy. **Mitigation:** Keep summaries concise and leverage notes column for extended context with links rather than inline prose.
