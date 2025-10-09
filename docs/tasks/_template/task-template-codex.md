# Codex Templates & Prompts — Mini Frontend Initiative

This canvas contains three outputs as requested:

1. **Short, no‑nonsense task template** (to be stored at `/docs/tasks/_template/task-template-codex.md`).
2. **Prompt to split the approved proposal into many small, executable tasks**.
3. **Prompt to execute a single task end‑to‑end**.

---

## 1) Short Task Template (drop‑in)

**File:** `/docs/tasks/_template/task-template-codex.md`

```md
# <Short Title>

**ID:** XXXX  
**Status:** Planned  
**Owner:** unassigned  
**Priority:** P?  
**Tags:** <domain tags>

## Rationale
1–3 concise sentences: why this matters now.

## Scope
- In: bullets of what IS included (tight)
- Out: bullets of what is NOT included

## Deliverables
- Code/files to be created or changed (paths)
- Tests to add/adjust (types)
- Docs/CHANGELOG entries if any

## Acceptance Criteria
- Bullet list of observable, testable outcomes (no fluff)

## References
- Link to proposal section(s) and relevant SEC/TDD/DD/AGENTS clauses
```

**Notes:** Keep it lean. Avoid duplicating contracts from SEC/TDD/DD; reference them instead.

---

## 2) Prompt — Split Proposal into Executable Tasks

Use this prompt in Codex to turn `/docs/proposal/20251009-mini_frontend.md` into small, stable tasks.

```md
# PROMPT: Derive executable tasks from the Mini‑Frontend Proposal

You are Codex. Read `/docs/proposal/20251009-mini_frontend.md` and produce **a set of small, independent tasks** under `/docs/tasks/` using the template at `/docs/tasks/_template/task-template-codex.md`.

**Goals**
- Keep each task **<= 30 minutes** execution time on a typical dev machine.
- Prefer **narrow scope** over completeness; chain tasks if needed.
- Order tasks to minimize blocked work (topologically sort by dependencies).

**Constraints**
- Follow SEC, TDD, DD, AGENTS. Node 22 LTS, ESM, pnpm workspaces.
- Do **not** restate global contracts in tasks; link references instead.
- Each task must include **clear acceptance criteria** and **concrete file paths**.

**Required Output**
- Create tasks with zero‑padded IDs starting at the next free number.
- Group tasks into 6 tracks matching the proposal:
  1) Transport slice (namespaces, read‑only enforcement, acks, error codes)
  2) Read‑model hydration API (3 endpoints) + types
  3) Telemetry client binder (4 topics) + store wiring
  4) UI skeleton (left rail, dashboard, zone detail, workforce KPIs)
  5) Intent flow (2 exemplar intents) with error dictionary and UX
  6) Contract tests + CI wiring
- For each task: fill **Rationale**, **Scope**, **Deliverables**, **Acceptance Criteria**, **References**.

**Validation**
- Ensure no task requires speculative knowledge outside the proposal and referenced contracts.
- Ensure tasks are mutually comprehensible and won’t time out.

**Submit**
- Commit the created `.md` files under `/docs/tasks/`; print a summary table (ID → title → track).
```

---

## 3) Prompt — Execute One Task End‑to‑End

Use this to make Codex implement a single task.

```md
# PROMPT: Execute Task XXXX end‑to‑end (SEC/TDD/DD aligned)

You are Codex. Execute the task **exactly** as written in this file:
- **TASK_FILE:** `/docs/tasks/XXXX-<short-title>.md`
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
```

pnpm i
pnpm -r lint && pnpm -r build
pnpm -r test

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
```
