# ADR-0012: Node Version Tooling Alignment for Local Development

> **Metadata**
>
> - **ID:** ADR-0012
> - **Title:** Node Version Tooling Alignment for Local Development
> - **Status:** Accepted
> - **Date:** 2025-10-04
> - **Supersedes:** _None_
> - **Summary:** Add `.nvmrc` and `.node-version` markers to guide environment managers ahead of the Node.js 22 migration.
> - **Binding:** true
> - **Impacts:** AGENTS, DD

> **Status note:** As of this change, the project standardizes on **Node.js 22 (LTS)** for local and CI. Any references to Node 23 in this ADR are historical.

## Context

The monorepo now targets **Node.js 22 LTS** for production and CI, in line with the Simulation Engine Contract (SEC) and the markers documented in `AGENTS.md` and workspace manifests. Historically, the runtime alignment effort aimed at Node.js 23+, which is why some legacy notes still reference that target. Regardless of that history, developers rely on environment managers such as `nvm`, `fnm`, `nodenv`, or `asdf` to synchronise their local runtimes. Without explicit version files, onboarding engineers must manually inspect `package.json` to discover the expected Node release, leading to mismatches between local shells, editor integrations, and automated scripts. The Node.js 22 LTS standard therefore requires a deterministic mechanism to coordinate contributor upgrades and smoke-test the toolchain before flipping the enforced `engines.node` constraint.

## Decision

- Add `.nvmrc` at the repository root declaring the desired Node.js major version (`22`) so `nvm` and compatible tooling automatically select the release when developers run `nvm use`.
- Add `.node-version` at the repository root with the same value (`22`) to support alternative version managers (`fnm`, `nodenv`, `asdf`, etc.) that recognise this marker.
- Keep the existing `package.json` `engines.node` constraint unchanged for now, allowing the team to validate Node.js 22 locally while CI continues to enforce the Node.js 23 runtime until the migration ADR and roll-out complete.

## Consequences

### Positive

- Reduces onboarding friction by enabling automatic Node.js selection across popular version managers.
- Provides a low-risk pathway for testing Node.js 22 locally ahead of the formal migration, without destabilising CI.
- Aligns developer tooling with the documented migration plan, keeping the path to Node.js 22 LTS visible in decision history.

### Negative

- Requires developers to override or ignore version-manager prompts when they intentionally need to run Node.js 23 for compatibility testing.
- Introduces a temporary mismatch between local version hints (22) and CI enforcement (23) until the migration is fully executed.

### Neutral / Follow-up

- Once Node.js 22 LTS is officially adopted, update `package.json` and any CI workflows to enforce the same version, and deprecate transitional documentation referencing Node.js 23.
