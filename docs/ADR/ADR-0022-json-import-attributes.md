# ADR-0022 — JSON Import Attributes for Node.js 22

## Status
Accepted — 2025-10-08

## Context
Node.js 22 promotes import attributes for JSON modules and TypeScript 5.5 removes support for the legacy `assert { type: 'json' }` syntax (TS2880). The engine and its test suites still referenced the deprecated form, which triggered compiler diagnostics and risked runtime incompatibilities with the SEC-mandated ESM baseline.

## Decision
- Replace every JSON import that used `assert { type: 'json' }` with the Node.js 22-compatible `with { type: 'json' }` attribute syntax across engine runtime modules and tests.
- Document the migration so future JSON imports within the monorepo adopt import attributes by default.

## Consequences
- JSON imports now compile cleanly under the Node.js 22 + TypeScript toolchain and remain aligned with the SEC ESM requirements.
- Contributors must use `with { type: 'json' }` for all new JSON modules; mixing legacy `assert` syntax will regress compiler compatibility and should be treated as a lint failure in future tooling updates.
