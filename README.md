# Weed Breed

Weed Breed is a deterministic management game about indoor cultivation and
breeding through real grow cycles.

The player builds a small facility, controls its environment, grows two proven
parent strains and creates a custom F1. Genetics are not a detached menu or a
collectible bonus: a new strain only proves itself when it is grown, harvested
and compared under the same operating conditions as its parents.

This repository contains the active reanimation of the project. Earlier
prototypes were consolidated into one product direction and archived. The
current codebase is a technically complete local web-demo candidate. Its only
remaining release gate is a moderated playtest with five independent players.

## The playable journey

The current vertical slice supports one complete run:

1. Start a new game with a reproducible seed.
2. Prepare two grow zones and make at least one real purchase/install decision.
3. Sow Northern Lights and Sour Diesel.
4. Detect and correct a deterministic environmental incident.
5. Grow and manually harvest both parents.
6. Sell part of the harvest through the authoritative economy.
7. Cross the qualified parents and compare three to five F1 candidates.
8. Select and name one candidate, sow it and grow it to a real harvest.
9. Compare parent and F1 outcomes, then save and restore the complete run.

Every visible primary action in this journey reaches the engine through a
validated intent. The UI does not fabricate outcomes, mutate simulation state
or replace missing backend behavior with local stubs.

## What is implemented

### Cultivation

- Rooms, grow zones, cultivation methods and placement-aware devices
- Seed purchases, sowing capacity and manual harvest decisions
- Hourly light, temperature, humidity, airflow, irrigation and nutrient effects
- Phase-aware plant physiology, stress, health, maturity and yield
- A deterministic temperature incident with automatic pause and visible remedy
- Immutable harvest lots with strain, plant, zone and time provenance

### Breeding

- Qualified seed and pollen parents based on completed harvest evidence
- Deterministic F1 populations of three, four or five candidates
- Bounded inheritance and variation for yield, cycle length, robustness,
  cannabinoid values and preferred temperature range
- One selected and named custom strain per breeding run
- Custom strains stored in world/save state and resolved before static
  blueprints
- Real F1 sowing, cultivation, harvest and parent comparison

### Economy and reporting

- Company Credits with an immutable transaction ledger
- Device, seed, electricity, water and operating costs
- Partial lot sales based on dry mass and quality
- A run summary separating attributable parent/F1 margin from shared operating
  costs instead of inventing an allocation model

### Save, replay and telemetry

- Versioned Save v2 envelopes with deterministic v0/v1 migrations
- Atomic load: invalid imports do not partially mutate the running session
- Named local save slots plus JSON export and import
- Canonical SHA-256 world hashes with stable key ordering and numeric
  normalization
- Read-only telemetry on a channel separate from player intents
- Deterministic `simTick` and collision-free `eventId` on every telemetry event

## Architecture

The runtime has a strict direction of travel:

```text
Player action
    -> React UI intent
    -> Facade validation and command queue
    -> deterministic engine tick
    -> committed world state
    -> read models and read-only telemetry
    -> React UI
```

The packages have deliberately narrow responsibilities:

| Package | Responsibility |
| --- | --- |
| `packages/engine` | Headless world state, nine-phase tick pipeline, deterministic rules, saves and domain tests |
| `packages/facade` | The single command ingress, intent validation, session lifecycle and read-model projection |
| `packages/transport-sio` | Separate Socket.IO namespaces for intents and read-only telemetry |
| `packages/ui` | React/Vite interface: read models in, player intents out |
| `packages/tools-monitor` | Read-only terminal telemetry monitor |
| `packages/tools` | Repository checks and development utilities |

Static gameplay content lives under `data/blueprints`; prices are kept under
`data/prices`. Runtime code never writes back into blueprint JSON.

## Simulation contract

One tick always represents one in-game hour. Playback speed changes wall-clock
time only.

The canonical tick pipeline is:

1. Device effects
2. Sensor sampling
3. Environment update
4. Irrigation and nutrients
5. Workforce scheduling
6. Plant physiology
7. Harvest and inventory
8. Economy and cost accrual
9. Commit and telemetry

Core invariants:

- All simulation randomness comes from `createRng(seed, streamId)`.
- Simulation logic does not use `Math.random`, `Date.now` or random UUIDs.
- Equal starting state plus equal ordered intents produces equal state hashes.
- Engine values use SI units and canonical `[0, 1]` quality/condition scales.
- Monetary rates are expressed per hour; `*_per_tick` money fields are
  forbidden.
- Zones only exist in growrooms and always reference one cultivation method.
- Telemetry cannot carry commands.

The normative source is [Simulation Engine Contract](docs/SEC.md). If another
document disagrees with it, the SEC wins.

## Run locally

Requirements:

- Node.js 22 LTS, pinned in `.nvmrc` and `.node-version`
- pnpm 10.18.1 through Corepack

Install dependencies:

```sh
corepack enable
pnpm install
```

Start the complete local stack:

```sh
pnpm dev:stack
```

This starts:

- the Facade read-model server at `http://localhost:3333`
- the intent/telemetry transport at `http://localhost:7101`
- the Vite UI at `http://localhost:5173`

Open the UI, create a new game and follow the journey indicator. Environment
overrides for the UI can be placed in `packages/ui/.env.local`; the documented
defaults work without a local environment file.

## Verify the repository

The release gate is one command:

```sh
pnpm verify
```

It runs workspace type checking, production builds, strict linting, all unit,
integration, conformance and journey tests, followed by the source-file size
guard.

The verified reanimation baseline from 9 September 2026 contains:

- 905 passing tests across the workspace
- 30-day and 200-day engine Golden Masters
- a double full-journey replay over 5,280 simulation hours per run
- 220 pairwise-identical daily world hashes
- 35,747 telemetry emissions per replay
- all nine journey milestones in identical order
- a maximum production source file size of 673 lines, below the 700-line limit

The recorded final replay hash and exact methodology are documented in
[Release Readiness](docs/reanimation/RELEASE_READINESS.md).

Useful focused commands:

```sh
pnpm --filter @wb/engine test
pnpm --filter @wb/facade test
pnpm --filter @wb/ui test
pnpm lint:ci
pnpm loc:guard
```

## Product scope

The first release is intentionally narrow. It proves the loop of growing,
understanding and breeding before the project expands sideways.

Current non-goals include F2/backcross/IBL programs, drying and curing,
contracts and brands, a differentiated market, workforce micromanagement,
editors, plugins, public hosting and desktop packaging. These are not missing
checkboxes for the demo; they are explicit exclusions protecting the core
journey.

The automated implementation gate is complete. The external release gate is
still open: at least four of five moderated players must finish the journey in
30 minutes, all five must understand the incident and justify their F1 choice,
and no P0/P1 issue or visible stub may occur.

## Sources of truth

Read these in order according to the kind of change being made:

1. [Simulation Engine Contract](docs/SEC.md) for engine semantics and invariants
2. [Product Bible](docs/reanimation/PRODUCT_BIBLE.md) for the player promise and
   scope
3. [End-to-end journey](docs/reanimation/END_TO_END_JOURNEY_TEST.md) for the
   canonical player path
4. [Recovery Backlog](docs/reanimation/RECOVERY_BACKLOG.md) for implementation
   order and deferred debt
5. [Release Readiness](docs/reanimation/RELEASE_READINESS.md) for current proof
6. [Consolidation Audit](docs/audits/2026-09-08-weed-breed-consolidation-audit.md)
   for lessons from the abandoned prototypes
7. [Legacy Archive Manifest](docs/reanimation/LEGACY_ARCHIVE_MANIFEST.md) for
   provenance and restoration information

`docs/TDD.md`, `docs/DD.md` and `docs/VISION_SCOPE.md` provide deeper testing,
design and historical context. They do not override the SEC or Product Bible.

## Working on Weed Breed

- Work on the highest unfinished player-journey item before adding another
  subsystem.
- Keep engine state authoritative and the UI deliberately dumb.
- Add or update tests with every behavioral change.
- Update `docs/CHANGELOG.md` under `Unreleased`.
- Record changes to contracts or guardrails in an ADR.
- Treat a red `pnpm verify` as stop-the-line.
- Refactor production files before they reach 700 lines.

Contribution details are in [CONTRIBUTING.md](docs/CONTRIBUTING.md).

## License

No license has been selected yet.
