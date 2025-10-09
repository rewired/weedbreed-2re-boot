# ADR-0011: Device Effects Stacking and Multi-Interface Composition

> **Metadata**
>
> - **ID:** ADR-0011
> - **Title:** Device Effects Stacking and Multi-Interface Composition
> - **Status:** Accepted
> - **Date:** 2025-10-03
> - **Supersedes:** _None_
> - **Summary:** Surface explicit device effect declarations/configs from blueprints onto instances and pipelines to support deterministic multi-effect modelling.
> - **Binding:** true
> - **Impacts:** SEC, DD, TDD

## Context

Devices in the cultivation simulator frequently exhibit multiple simultaneous effects—for example, split air-conditioners that cool and dehumidify, or lighting fixtures that emit photons while adding sensible heat. Prior to this decision, the engine relied on implicit heuristics:

- Cooling capability inferred from `sensibleHeatRemovalCapacity_W`.
- Humidity control detected via slug/name matching (e.g., "dehumid").
- Lighting PPFD derived from electrical power and a hard-coded photon efficacy.

The runtime pipeline consumes `DeviceInstance` objects exclusively; no runtime registry exposes blueprint metadata once the world is initialised. Consequently, effect-specific configuration declared on blueprints was inaccessible when evaluating device stubs, forcing the aforementioned heuristics and making multi-effect modelling brittle. The consolidated references for Engine v1 Phase 1 identified the need for explicit effect declaration (Patterns A–E) while ADR-0009 already established a taxonomy for blueprint validation. To achieve deterministic, testable effect stacking we must surface blueprint intent directly on the `DeviceInstance` model.

## Decision

1. **Blueprint layer**
   - Extend `deviceBlueprintSchema` with an optional `effects: string[]` enumerating supported effect interfaces (`thermal`, `humidity`, `lighting`, `airflow`, `filtration`).
   - Introduce optional effect configuration objects: `thermal`, `humidity`, and `lighting`, each capturing mode and capacity parameters required by the corresponding actuator stubs.
   - Validate that whenever an effect is declared in `effects`, the matching config block is present.

2. **Instance layer**
   - Extend `DeviceInstance` with optional `effects` and `effectConfigs` fields mirroring the blueprint declarations.
   - Update `createDeviceInstance` to copy and deep-freeze these structures at creation time, ensuring deterministic runtime access without mutating blueprint JSON.

3. **Pipeline integration**
   - Modify `applyDeviceEffects` to consume `device.effects` and `device.effectConfigs` before falling back to legacy heuristics. This unlocks explicit thermal/heating modes, humidity capacities, and lighting PPFD sourced from blueprints while maintaining backward compatibility.
   - Encapsulate effect-specific logic in dedicated `effects/*` modules and centralise coverage/airflow aggregation in `aggregate/zoneEffects.ts` so each concern remains under SEC/AGENTS LOC guardrails while preserving legacy diagnostics (`zone.capacity.*`).

4. **Data migration & tests**
   - Migrate representative device blueprints (cooling split AC, dehumidifier, lighting fixture, exhaust fan, humidity controller) to declare explicit effects/configs.
   - Update unit and integration tests to assert effect-config copying, pipeline behaviour for multi-effect devices, and heuristic fallbacks for legacy content.

## Consequences

### Positive

- Enables explicit modelling of multi-effect devices (Patterns A–E) without relying on brittle slug heuristics.
- Improves determinism and observability: effect parameters originate from validated blueprint data, simplifying testing and diagnostics.
- Provides a foundation for future effects (e.g., filtration, nutrient dosing) by extending the `effects` enumeration and schema.

### Negative

- Introduces limited data duplication: effect configuration now lives in both blueprint JSON and the instantiated device snapshot.
- Requires ongoing blueprint migrations to populate `effects` arrays and configs, increasing authoring effort during transition.
- Slightly increases `createDeviceInstance` complexity due to deep-freezing and copying logic.

### Neutral

- Legacy blueprints without `effects` continue to operate via existing heuristics, ensuring incremental adoption.
- Runtime pipeline retains per-device stub evaluation; broader stub composition optimisations remain out of scope.

## Alternatives Considered

1. **Runtime blueprint registry**
   - Rejected due to added lookup complexity, memory overhead, and the need for synchronised caches across simulation workers.

2. **Deriving effects from taxonomy classes**
   - Rejected because class hierarchies cannot express composite devices (e.g., cooling + dehumidification) without exploding the taxonomy.

3. **Immediate stub composition via `compose()` helper**
   - Deferred; while feasible, it does not remove the need for explicit configuration metadata and would increase pipeline complexity prematurely.

## References

- Consolidated reference: _Interfaces & Stubs — Consolidated (Engine v1, Phase 1)_.
- ADR-0009: Blueprint class taxonomy and validation.
- SEC §6: Device behaviour, efficiency, and energy accounting.
