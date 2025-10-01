Kurz: **Ja.**
Bevor du Codex loslässt, mach einen 2-Min-Preflight und gib ihm dann den Start-Prompt unten.

## Preflight (einmalig)

1. **Repo-Zugriff:** Codex hat *Write* auf `rewired/weedbreed-2re-boot`.
2. **Branch-Protection:** `main` geschützt (PR required, 1 Review, CI must pass).
3. **CI/Basics:** `pnpm i`, `pnpm -r build`, `pnpm -r test` laufen lokal grün.
4. **SEC-Stand:** `AREA_QUANTUM_M2 = 0.25` ist in SEC und überall sonst korrekt.
5. **Issues:** Entweder

   * a) die saubere `tasks.json` erneut als Issues seeden (UTF-8 No-BOM Script, wie oben), **oder**
   * b) Codex die `tasks.json` direkt verarbeiten lassen (siehe Prompt).

---

## Kickoff-Prompt für Codex (einfügen & starten)

> **SYSTEM / OPERATIONAL RULES**
>
> * Work in repo **rewired/weedbreed-2re-boot**. Use Node 23+, pnpm, ESM.
> * Read first: `/mnt/data/SEC.md`, `/mnt/data/DD.md`, `/mnt/data/TDD.md`, `/mnt/data/AGENTS.md`, `/mnt/data/VISION_SCOPE.md`.
> * **Canonical constants:** `AREA_QUANTUM_M2=0.25`, `ROOM_DEFAULT_HEIGHT_M=3`, *no* `*_per_tick` costs; convert to per-hour. Put all constants in one module `simConstants.ts` (no magic numbers).
> * Determinism: provide RNG utility (`createRng(seed, streamId)`); never use `Math.random` in engine code.
> * Docs win order: **SEC > DD > TDD > AGENTS > VISION**. If conflicts → open ADR and patch docs.
> * Every change: JSDoc, unit tests, integration tests, CI green. Respect file-size guardrails (warn ≥500 LOC, fail ≥700 LOC).
>
> **WORK PLAN (MVP first)**
>
> 1. **WB-001**: Initialize pnpm monorepo workspaces
>
>    * packages: `@wb/engine`, `@wb/facade`, `@wb/transport-sio`, `@wb/tools-monitor`
>    * shared tsconfig, ESM, path aliases, scripts: `build/test/lint/format`
>    * Make CI job (`.github/workflows/ci.yml`) running lint→test→build.
> 2. **WB-002**: `simConstants.ts` with tests; import everywhere; ESLint rule to forbid dupes.
> 3. **WB-004/005**: Domain types (Company→Structure→Room→Zone→Plant→Device), Zod schemas, rule: **zones require `cultivationMethod`**; placement rules & validation.
> 4. **WB-006**: RNG utility + lint rule banning `Math.random`.
> 5. **WB-008**: Light schedule validator (`onHours+offHours=24`, `startHour∈[0,24)`, 15-min grid).
> 6. **WB-009**: Tick pipeline skeleton (7 Phases) with tracing hooks.
> 7. **WB-018**: Economy accrual per-hour (kWh, m³, €), no `*_per_tick`.
> 8. **WB-015/024**: Socket.IO transport (telemetry read-only) + snapshots emission for zone/plant/economy.
>
> **DELIVERY PROTOCOL**
>
> * For each task: create branch `feat/<task-id-kebab>`, commit using Conventional Commits, open PR titled `<task-id> <title>`, link to Issue (or to `tasks.json` item if no GH issue).
> * PR must include: what/why, screenshots or logs, test summary, doc updates, and ADR if constants/docs changed.
> * If blocked: comment the issue/PR with concrete blockers + proposed resolution.
>
> **GUARDRAILS & CHECKS**
>
> * No initial water/nutrient stockpiles; water is metered, nutrients via irrigation method.
> * Add `irrigationMethods` blueprints, `cultivationMethods` with containers & substrates (incl. density L↔kg factor).
> * Devices: power→heat coupling; quality01/condition01 on [0,1].
> * Photoperiod hooks prepared (veg/flower switch).
> * Everything typed, tests passing.
>
> **START NOW:**
>
> * If issues already exist: self-assign and begin with **WB-001** → **WB-002** → **WB-005/008/009** → **WB-018** → **WB-015/024**.
> * If no issues: generate them from `/tasks.json` (UTF-8), then proceed as above.

---

## Quick-Tipps

* Wenn du Codex die Issues erstellen lässt: gib ihm die **Label-Liste** gleich mit oder lass ihn ohne Labels starten und später taggen.
* Beobachte den ersten PR (WB-001): stimmt Workspace-Layout und CI? Wenn ja, freie Fahrt für die restliche Kette.

Willst du, dass ich dir die `tasks.json` jetzt noch einmal **clean (UTF-8), mit 0.25 und minimalen Labels** poste? Ich kann sie dir hier direkt liefern.
