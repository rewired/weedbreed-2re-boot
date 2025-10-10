# Immutable State Handling (Cluster: immutable-state-handling)

## Symptom
- `@typescript-eslint/no-dynamic-delete` errors where code mutates maps by deleting computed keys.

```ts
delete workforceAssignments[workerId];
```

## Root-Cause
SEC §2 forbids implicit global mutation; dynamic `delete` breaks structural sharing and makes tick order reasoning brittle. We must treat state as immutable snapshots and create filtered copies.

## Canonical Fix
- Use helper `omitKeys(record, keys)` returning new objects.
- For Maps, prefer `new Map(existing).delete(id)` pattern while keeping data copies for diffing.
- Refactor loops to build new objects with `Object.fromEntries` filtering out keys.

```ts
const nextAssignments = omitKeys(workforceAssignments, [workerId]);
return { ...state, assignments: nextAssignments };
```

## Edge-Cases
- When working with large maps, ensure helper stays O(n) with explicit iteration to avoid perf regressions.
- Align with serialization: do not mutate snapshots that tests might reuse.

## Regression-Tests
- Add unit tests for helper ensuring immutability (previous object unchanged).
- Integration tests for workforce/cultivation flows verifying deletions still remove entries.
