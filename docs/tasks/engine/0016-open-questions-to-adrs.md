ID: 0016
# Open Questions to ADRs

**ID:** 0013  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P2  
**Tags:** docs, governance, adr

## Rationale
[SEC §14 Open Questions](../SEC.md#14-open-questions-to-be-resolved-iteratively) lists outstanding decisions (irrigation minima, stress→growth curve shape, reporting granularity, default zone height). [AGENTS §1.4 Documentation & Governance](../../AGENTS.md#14-documentation--governance-strict) mandates ADR workflow for contract changes. We need to convert these open questions into ADRs capturing decisions and implications.

## Scope
- Include: author ADRs for each open question with context, decision, consequences, and references to SEC/DD/TDD.
- Include: update SEC/TDD/VISION as needed to reflect resolved decisions and remove items from open questions section.
- Include: CHANGELOG entries summarising ADR additions.
- Out of scope: introducing new topics beyond the listed open questions.

## Deliverables
- Four ADRs (irrigation minima, stress→growth curves, reporting granularity, default zone height) stored under `docs/ADR/` with consistent template.
- Updated SEC §14 removing addressed open questions and referencing ADR IDs.
- Updates to DD/TDD/VISION_SCOPE if decisions affect those documents.
- CHANGELOG entry summarising ADR publication.

## Implementation Steps
1. Gather context from SEC/DD/TDD for each open question; draft ADRs with background, decision, consequences.
2. Review with stakeholders (if process defined) and record final decisions in ADRs.
3. Update SEC §14 to reference new ADRs and remove resolved items; adjust DD/TDD/VISION_SCOPE to incorporate outcomes.
4. Add CHANGELOG entry referencing ADR IDs and summarizing resolutions.

## Acceptance Criteria / DoD
- ADRs exist for all four open questions with clear decisions and linked references; documents updated accordingly.
- SEC §14 no longer lists unresolved versions of these questions; instead links to ADRs.
- DD/TDD/VISION_SCOPE reflect decisions (e.g., irrigation minima thresholds, stress curve shape).
- CHANGELOG notes ADR additions.

## Tests
- Documentation lint/check (Markdown link validator) over new ADRs and updated sections.
- Optional unit test verifying SEC §14 references ADR IDs (e.g., doc parsing test).

## Affected Files (indicative)
- `docs/ADR/ADR-XXXX-*.md` (new)
- `docs/SEC.md` ([§14](../SEC.md#14-open-questions-to-be-resolved-iteratively))
- `docs/DD.md`
- `docs/TDD.md`
- `docs/VISION_SCOPE.md`
- `docs/CHANGELOG.md`
- `AGENTS.md` ([§1.4](../../AGENTS.md#14-documentation--governance-strict))

## Risks & Mitigations
- **Risk:** Decisions lack consensus. **Mitigation:** Follow ADR review process and capture open issues in ADR status if pending.
- **Risk:** Documents drift after ADR. **Mitigation:** Update all references immediately and include doc validation in CI.
- **Risk:** ADR numbering conflicts. **Mitigation:** Reserve IDs before drafting and record in CHANGELOG.
