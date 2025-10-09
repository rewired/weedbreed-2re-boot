# PROMPT: Execute Task XXXX end-to-end (SEC/TDD/DD aligned)

You are Codex. Execute the task EXACTLY as written in this file:
- TASK_FILE: /docs/tasks/XXXX-<short-title>.md
- Out of scope: anything not explicitly in TASK_FILE.

Contracts to honor (no re-interpretation):
- SEC v0.2.1, TDD.md, DD.md, CHANGELOG.md, AGENTS.md.
- Node 22 LTS, ESM, pnpm workspaces. No Math.random (use createRng(seed, streamId)).
- Economy uses per-hour units; derive per-tick from hours.
- Tick pipeline: 9 phases in canonical order (TDD §7).

Do this, in order:
1) Read TASK_FILE. Extract acceptance criteria & deliverables.
2) Implement the minimal code/data changes to satisfy the task (no scope creep).
3) Add/adjust tests (unit/module/integration/conformance) per TDD to encode behavior.
4) Run locally and make green:
   pnpm i
   pnpm -r lint && pnpm -r build
   pnpm -r test
5) Update docs if the task requests it + CHANGELOG entry (human-readable).
6) Open a single PR titled: feat(task:XXXX): <short title>
   - Include: summary, list of touched SEC/TDD sections, test evidence (commands + pass counts),
     and any necessary deviations (with reason tied to the contracts above).

Acceptance before PR:
- [ ] Aligns with SEC v0.2.1 semantics.
- [ ] Tests exist and pass for new/changed behavior.
- [ ] Per-hour economy only; tariffs resolved once at sim start.
- [ ] Placement & room-purpose rules enforced; zones have cultivationMethod.
- [ ] No Math.random; only createRng.
- [ ] CHANGELOG updated.