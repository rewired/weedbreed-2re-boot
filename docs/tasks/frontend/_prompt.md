# Execute Task <TASK_ID> end-to-end (SEC/TDD/DD aligned)

You are Codex. Follow this exactly.

# 0) Fixed inputs
- TASK_ID: "0024"
- TASK_DIR: "/docs/tasks/frontend"
- TASK_GLOB: `${TASK_DIR}/${TASK_ID}-*.md`

# 1) Locate TASK_FILE (deterministic)
- Enumerate files matching TASK_GLOB.
- If **0** matches → STOP with error: `TASK_FILE_NOT_FOUND: ${TASK_GLOB}`.
- If **>1** matches → STOP with error: `TASK_FILE_AMBIGUOUS: [list matches]`.
- If exactly **1** match → set `TASK_FILE` to that absolute path and continue.

# 2) Read TASK_FILE
- Extract: short title, acceptance criteria, deliverables, file paths mentioned.

# 3) Contracts to honor (no reinterpretation)
- SEC v0.2.1, TDD.md, DD.md, CHANGELOG.md, AGENTS.md. 
- Node 22 LTS, ESM, pnpm workspaces. No Math.random (use createRng(seed, streamId)).
- Economy uses per-hour units; derive per-tick from hours. :contentReference[oaicite:1]{index=1}
- Tick pipeline: canonical order per TDD/SEC §4.2 (9 phases). :contentReference[oaicite:2]{index=2}

# 4) Work plan (do in order)
1) Implement the **minimal** changes to satisfy TASK_FILE (no scope creep).
2) Add/adjust tests (unit/integration/conformance) per TDD.
3) Run locally and make green:

```bash
pnpm i
pnpm -r test
pnpm -r lint && pnpm -r build
````

4. If the task requests doc updates, do them and add a human-readable CHANGELOG entry (keep-a-changelog style). 
5. Open **one PR** titled `feat(task:${TASK_ID}): <short title>` including:

   * summary of changes
   * touched SEC/TDD references
   * test evidence (commands + pass counts)
   * any necessary deviations (with reasoning)

# 5) Acceptance gate (must be true before PR)

* [ ] Aligns with SEC v0.2.1 semantics (see invariants/guards). 
* [ ] Tests exist and pass for new/changed behavior (TDD).
* [ ] Per-hour economy only; no *_per_tick; tariffs resolved at sim start. 
* [ ] Placement & room-purpose rules enforced; zones require cultivationMethod. 
* [ ] No `Math.random`; only `createRng`. 
* [ ] CHANGELOG updated (keep-a-changelog style). 

# 6) Output artifacts

* PR description (as specified).
* Paths of modified files.
* Test summary (counts + key suites).
* New/updated docs and the CHANGELOG diff.

# 7) Failure semantics

* Any of:

  * `TASK_FILE_NOT_FOUND`
  * `TASK_FILE_AMBIGUOUS`
  * `TESTS_FAILING`, `LINT_FAILING`, or `BUILD_FAILING`
    → STOP and report the exact error with the command that failed.

