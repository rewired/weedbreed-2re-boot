# Frontend Live Data Wiring Plan Index

## Purpose & Scope
This plan decomposes the frontend live-data wiring initiative (Phases 0–5) into atomic, time-safe tasks that convert UI fixtures into authoritative backend-driven experiences while remaining compliant with SEC, DD, and TDD documentation priorities. The scope spans contract alignment, backend hydration, telemetry plumbing, intent handling, frontend wiring, and validation/documentation closure.

## Task Table
| ID | Title | Phase | Size Budget |
| --- | --- | --- | --- |
| 0100 | Contracts Inventory Sync | 0 | ≤3 files, ≤150 diff lines, 0 tests |
| 0110 | SEC Gap Register | 0 | ≤3 files, ≤150 diff lines, 0 tests |
| 0120 | Tracker and ADR Alignment | 0 | ≤3 files, ≤150 diff lines, 0 tests |
| 0130 | Sim Control Contract Checklist | 0 | ≤3 files, ≤150 diff lines, 0 tests |
| 1100 | Deterministic World Loader | 1 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 1110 | Structure Read-Model Coverage | 1 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 1120 | Room & Zone Snapshots | 1 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 1130 | HR & Economy Hydration | 1 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 2100 | Telemetry Loop Integration | 2 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 2110 | Socket Topic Audit | 2 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 2120 | Telemetry Buffer Drain | 2 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 2130 | Telemetry Schema Docs | 2 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 3100 | Intent Pipeline Core | 3 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 3110 | Environment Adjust Intents | 3 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 3120 | Workforce & Maintenance Intents | 3 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 3130 | Simulation Control ACKs | 3 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 4100 | Read-Model Store Live Fetch | 4 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 4110 | Navigation Live IDs | 4 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 4120 | Dashboard Telemetry Binding | 4 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 4130 | Workforce & Strain UI Binding | 4 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 4140 | Sim Control Bar Live State | 4 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 5150 | Read-Model Test Harness | 5 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 5160 | Telemetry E2E Suite | 5 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 5170 | Intent Regression Suite | 5 | ≤3 files, ≤150 diff lines, 1–3 tests |
| 5180 | Docs and ADR Finalization | 5 | ≤3 files, ≤150 diff lines, 0 tests |

## How to Run
```
Program: Execute Task
Inputs:
  TASK_FILE: <relative-path-to-task-md>
```
