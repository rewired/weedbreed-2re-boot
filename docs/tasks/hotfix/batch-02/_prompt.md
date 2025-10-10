# Execute Task 0051 end-to-end (SEC/TDD/DD aligned)

You are Codex. Execute the task **exactly** as written in this file:
- TASK_ID: ${TASK_ID}
- TASK_SLUG: ${TASK_SLUG}            # kebab-case, e.g. "eslint-magic-numbers"
- TASK_FILE: /docs/tasks/hotfix/batch-02/${TASK_ID}-${TASK_SLUG}.md
- Out of scope: anything not explicitly in TASK_FILE.

Contracts to honor (no reinterpretation):
- /SEC.md (v0.2.1), /TDD.md, /DD.md, /CHANGELOG.md, /AGENTS.md.  # canonical repo paths
- Node 22 LTS, pure ESM, pnpm workspaces. No Math.random → use createRng(seed, streamId). 
- Economy per-hour units; derive per-tick from hours.
- Canonical 9-phase tick pipeline as per TDD §7 / SEC §4.2.

Preflight (must pass, else abort with explicit error):
1) Verify Node == 22.x and pnpm is the workspace version (`pnpm -v`).
2) Verify files exist: TASK_FILE, /SEC.md, /TDD.md, /DD.md, /CHANGELOG.md, /AGENTS.md.
3) Create a working branch: `git checkout -b feat/task-${TASK_ID}-${TASK_SLUG}`.

Do this, in order:
1) Read TASK_FILE. Extract acceptance criteria & deliverables verbatim.
2) Implement the **minimal** changes to satisfy the task (no scope creep; obey SEC v0.2.1 invariants).
3) Add/adjust tests (unit/integration/conformance) as required by TDD.
4) Run locally and make green:

   pnpm i
   pnpm -r test
   pnpm -r lint
   pnpm -r build

5) If the task requests doc updates, do them. Always add a human-readable CHANGELOG entry under “Unreleased”.
6) Commit in small, conventional chunks:

   git add -A
   git commit -m "feat(task:${TASK_ID}): ${TASK_SLUG} – implement per task spec"
   # use additional commits for tests/docs/fixes as needed

7) Prepare one PR titled:
   feat(task:${TASK_ID}): ${TASK_SLUG}

   PR description MUST include:
   - Summary of changes
   - Touched SEC/TDD references (section numbers)
   - Test evidence (commands + pass counts)
   - Any deviations from contracts (with reasoning)

Acceptance before PR:
- [ ] Aligns with SEC v0.2.1 semantics (see SEC.md). 
- [ ] Tests exist and pass for new/changed behavior (per TDD).
- [ ] Per-hour economy only; tariffs resolved at sim start.
- [ ] Placement & room-purpose rules enforced; zones require cultivationMethod.
- [ ] No Math.random; only createRng(seed, streamId).
- [ ] CHANGELOG updated.

Output:
- If all green: push branch and print `git push --set-upstream origin feat/task-${TASK_ID}-${TASK_SLUG}`
- Then print the prepared PR title + body as markdown.
