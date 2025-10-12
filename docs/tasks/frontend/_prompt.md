# Execute Task 0024 end‑to‑end (SEC/TDD/DD aligned)

You are Codex. Execute the task **exactly** as written in this file:
- **TASK_FILE:** `/docs/tasks/frontend/XXXX-<short-title>.md`
- **Out of scope:** anything not explicitly in `TASK_FILE`.

**Contracts to honor (no reinterpretation):**
- SEC v0.2.1, TDD.md, DD.md, CHANGELOG.md, AGENTS.md.
- Node 22 LTS, ESM, pnpm workspaces. No `Math.random` (use `createRng(seed, streamId)`).
- Economy uses per‑hour units; derive per‑tick from hours.
- Tick pipeline: canonical order per TDD §7.

**Do this, in order:**
1) Read `TASK_FILE`. Extract acceptance criteria & deliverables.
2) Implement the **minimal** changes to satisfy the task (no scope creep).
3) Add/adjust tests (unit/integration/conformance) per TDD.
4) Run locally and make green:

```bash
pnpm i 
pnpm -r test
pnpm -r lint && pnpm -r build 
```

5) Update docs if the task requests it **and** add a human‑readable CHANGELOG entry.
6) Open **one PR** titled `feat(task:XXXX): <short title>` including:
- summary of changes
- touched SEC/TDD references
- test evidence (commands + pass counts)
- any necessary deviations (with reasoning)

**Acceptance before PR:**
- [ ] Aligns with SEC v0.2.1 semantics
- [ ] Tests exist and pass for new/changed behavior
- [ ] Per‑hour economy only; tariffs resolved once at sim start
- [ ] Placement & room‑purpose rules enforced; zones have cultivationMethod
- [ ] No `Math.random`; only `createRng`
- [ ] CHANGELOG updated