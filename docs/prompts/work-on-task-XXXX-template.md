# PROMPT: Execute One Task End-to-End

**You are Codex.** Execute the referenced task **verbatim**. Do **not** add scope beyond the task; do **not** omit any step. If the task text contradicts the contracts below, prefer the contracts and note the deviation in the PR description.

## 1) Task to execute

* **TASK_FILE:** `/docs/tasks/0003-golden-master-conformance-suite.md`
* **GOAL (copy the task’s goal here 1–3 lines):** …
* **Out of scope:** anything not explicitly in the task file.

## 2) Canonical contracts (must follow)

* **SEC v0.2.1** (engine semantics, invariants, placement, units, RNG, golden master). 
* **TDD (tests, layout, conformance, per-hour units, pipelines).** 
* **DD (design & data flows; SEC wins on conflicts).** 
* **CHANGELOG (keep-a-changelog; record changes).** 
* **AGENTS (guardrails for Codex: Node 22 LTS, ESM, pnpm workspaces, UI stack notes).** 

## 3) Ground rules

* **No scope creep.** Implement exactly what the task prescribes.
* **Determinism:** use `createRng(seed, streamId)` only; never `Math.random`. 
* **Per-hour economy units; derive per-tick via hours.** 
* **Placement rules & zone/cultivation constraints enforced.** 
* **1 tick = 1 in-game hour; pipeline has 9 Phases (enforced by tests).** 
* **Node 22 (LTS), ESM, pnpm workspaces.** 

## 4) Steps (do in order)

1. **Read the task** in `TASK_FILE`. Extract acceptance criteria and deliverables.
2. **Plan the minimal changes** (files to add/modify, tests to write/adjust). Keep the plan inside the PR description.
3. **Implement code & data updates** exactly per task. Respect blueprint taxonomy, schemas, and units. 
4. **Add/adjust tests** (unit/module/integration/conformance) to encode the task’s behavior per TDD. 
5. **Run quality gates locally**:

   * `pnpm i`
   * `pnpm -r lint && pnpm -r build`
   * `pnpm -r test` (ensure conformance/golden if task requires). 
6. **Docs**: update the task file with status/results if it requests it; update **CHANGELOG** summarizing the change. 
7. **Create a PR** titled: `feat(task:<ID>): <short title>` with:

   * Summary of what changed & why.
   * Exactly which SEC/TDD sections were touched (bulleted refs).
   * Test evidence (commands + pass summary).
   * Any deviations from the task (and why), tied to contracts above.

## 5) Acceptance checklist (must be true before PR)

* [ ] All changes align with **SEC v0.2.1** semantics (sections referenced in PR). 
* [ ] Tests exist and pass for the new/changed behavior (unit→integration→conformance as relevant). 
* [ ] Economy uses **per-hour** rates only; tariffs resolved once at sim start. 
* [ ] Device placement & room purpose eligibility enforced; zones only in growrooms; zones have cultivation methods. 
* [ ] No `Math.random`; RNG via `createRng`. 
* [ ] **CHANGELOG** updated with human-readable entry. 

## 6) Output

* A **single PR** implementing the task end-to-end, with passing checks and updated docs/tests.
