# ADR-0013: Workforce Domain Model Integration

> **Metadata**
>
> - **ID:** ADR-0013
> - **Title:** Workforce Domain Model Integration
> - **Status:** Accepted
> - **Date:** 2025-10-05
> - **Supersedes:** _None_
> - **Summary:** Establish deterministic workforce schemas, task definitions, and world embedding aligned with SEC §10.
> - **Binding:** true
> - **Impacts:** SEC, DD, TDD, VISION

## Context

SEC §10 mandates a deterministic workforce directory with reproducible RNG streams, structured task requirements, and
telemetry-ready KPIs. The reboot branch still stored task metadata in a legacy ad-hoc shape (`requiredRole`, `requiredSkill`,
`minSkillLevel`) and lacked first-class domain modules or schemas for employees, roles, and workforce KPIs. Without canonical
schemas the façade could not validate incoming workforce payloads, and simulation snapshots (`SimulationWorld`) had no place to
persist employee state, task queues, or aggregated labour metrics. Downstream tooling (scheduler, telemetry, UI) therefore had no
contract to rely on when modelling labour availability or overtime policies.

## Decision

- Introduce dedicated workforce domain modules (`EmployeeRole`, `Employee`, `WorkforceState`, task/KPI structures) inside the
  backend domain package and expose them through the world barrel so simulation snapshots embed a deterministic workforce branch.
- Extend the shared Zod schemas with workforce collections, UUID v7 validation for employee RNG seeds, morale/fatigue clamps on the
  `[0,1]` scale, and explicit working-hour limits (base 5–16 h, overtime ≤ 5 h, days per week 1–7, optional shift start hour 0–23).
- Normalise `/data/configs/task_definitions.json` to use `requiredRoleSlug` plus structured `requiredSkills` entries (`skillKey`,
  `minSkill01`), deriving the normalised threshold by mapping the former integer level (`0..5`) onto the SEC skill scale (`level/5`).
- Embed the workforce branch into `SimulationWorld` so savegame snapshots, telemetry, and downstream analytics can evolve against a
  single canonical structure.
- Extend employee records with deterministic trait assignments and the hiring skill triad so behavioural modifiers stay aligned
  with SEC §10.3 trait catalogues and the scheduler can apply trait hooks without ad-hoc randomness.
- Track compensation multipliers (`EmployeeRole.baseRateMultiplier`, employee-specific base multipliers, labour market factors,
  shift premiums), career experience, salary expectations, employment start dates, and raise cadence state on employees so the
  payroll engine can apply the full SEC rate formula while modelling HR flows (raises, bonuses, termination morale ripples)
  deterministically.

## Consequences

### Positive

- Workforce data has a deterministic contract that façade validation, schedulers, and read-model projections can share.
- UUID v7 enforcement on employee RNG seeds eliminates ambiguous randomness sources and keeps trait generation reproducible.
- Structured task definitions unblock future automation and intent validation because skills/roles share the same canonical keys.
- Compensation and HR metadata (experience accumulation, raise cadence, salary expectations, morale ripples) remain available to
  payroll, telemetry, and façade layers without duplicating calculations outside the engine.
- Documentation (DD/TDD/Changelog) now captures workforce invariants for onboarding and review.

### Negative

- Data producers must migrate to the new task definition shape before pushing scenarios; the legacy fields are no longer parsed.
- Additional schema constraints may reject previously tolerated workforce payloads until upstream exporters are aligned.

### Follow-up

- Model skill catalogues and hiring markets as separate data sources once SEC §10.4/§10.5 expands beyond the MVP scope.
- Extend telemetry/read-model layers to surface workforce KPIs once façade transport coverage begins.
