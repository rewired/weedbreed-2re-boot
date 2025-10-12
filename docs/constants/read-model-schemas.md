# Read-model Schema Versions

This registry tracks the version identifiers exposed by façade read-model payloads.
All schemas align with [Proposal §6](../proposals/20251009-mini_frontend.md#6-data-schemas-mvp-minimal-fields)
and surface `schemaVersion` plus `simTime` metadata at runtime.

| Read model        | Schema version   | Notes |
| ----------------- | ---------------- | ----- |
| `companyTree`     | `companyTree.v1` | Company hierarchy with room/zone geometry metadata. |
| `structureTariffs` | `structureTariffs.v1` | Baseline electricity/water tariffs plus optional CO₂ pricing. |
| `workforceView`   | `workforceView.v1` | Workforce headcount summary, role splits, and KPI warnings. |

When a schema gains new required fields or breaking changes, increment the version
string and update this document alongside validator changes.
