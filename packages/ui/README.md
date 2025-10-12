# @wb/ui — Workspace Shell

The `@wb/ui` package hosts the Weed Breed workspace shell. It is a React + Vite
application aligned with SEC v0.2.1, Tailwind CSS, and the shadcn/ui design
system primitives. Subsequent tasks will hang telemetry dashboards and intent
workflows from this layout.

## Requirements

- Node.js 22 (LTS)
- pnpm 10.17+

Install dependencies from the repository root:

```bash
pnpm install
```

## Scripts

Run any script from the repository root with `pnpm --filter @wb/ui <script>`.

| Script        | Description                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `dev`         | Launches Vite on <http://localhost:5173>.                                    |
| `build`       | Bundles the workspace for production.                                       |
| `preview`     | Serves the production bundle locally (after `pnpm build`).                  |
| `test`        | Executes the Vitest suite in CI mode.                                       |
| `test:watch`  | Runs Vitest in watch mode for local development.                            |
| `lint`        | Runs ESLint with the repository ruleset.                                    |
| `format`      | Checks formatting via Prettier.                                             |

## Development notes

- Tailwind CSS is pre-configured with shared tokens (`foundationTheme`) that
  mirror the shadcn/ui baseline.
- The workspace layout renders a left navigation rail and a main content panel.
  Replace the placeholder nodes as downstream tasks introduce telemetry and
  intent flows.
- The Tick pipeline contract (SEC §4.2) remains authoritative for any data you
  surface in this workspace. Use read-models exposed by the façade instead of
  querying the engine directly.

## Running alongside the façade

You can boot the façade transport server and the UI workspace in parallel:

```bash
pnpm --filter @wb/facade dev:server
pnpm --filter @wb/ui dev
```

Configure the UI to point at the façade transport once the binder is available.
The workspace currently renders static placeholders while contracts for
telemetry, intents, and read-models land in follow-up tasks.

## Testing intent submissions locally

Intent forms use the shared Socket.IO intent client introduced in Task 0034.
To verify acknowledgements and error handling end-to-end, pair the workspace
with the façade transport server and follow the steps in the
[Intent Playground](../../docs/tools/intent-playground.md). The playground
document explains how to run the façade, connect the UI, and inspect
acknowledgements for exemplar intents such as selecting irrigation methods.
