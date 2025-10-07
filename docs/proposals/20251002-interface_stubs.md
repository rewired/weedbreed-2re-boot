# Interfaces & Stubs — Consolidated (Engine v1, Phase 1)

> **Scope:** Merge of **Interface Stacking — Beispiele & Patterns (Engine v1)** and **Stub Specs — Phase 1 (deterministisch, referenziell)** into one reference. No new content added; wording compacted for cohesion. Language mirrors the originals (DE with a few technical Anglizismen).

---

## 0) Ziele & Leseguide

* **Ziel:** Zeigen **dass und wie Interfaces stackbar sind** und welche **Phase‑1‑Stubs** als präzise, testbare Referenz‑Implementierungen dienen.
* **Fokus:** Entwicklung & Tests, **deterministische** Abläufe, **reine Funktionen**, **klare Units**.

---

## 1) Grundidee: Interface‑Stacking

* Jedes Interface beschreibt **eine Wirkung** (Thermal, Humidity, Airflow, Lighting, Filtration, Sensors, Telemetry, …).
* Ein konkretes Device/Service darf **mehrere** Wirkungen abdecken → implementiert **mehrere** Interfaces **oder** wird **komponiert**.
* Effekte werden **deterministisch in Phasen** aufgerufen; **Outputs** werden **aggregiert** (Summe, Merge, Clamp) zu Zonen‑/Pflanzen‑Zuständen.

**Reihenfolge (Engine v1, Interface‑Dok):** `Irrigation/Buffer` → `Lighting` → `Thermal` → `Humidity` → `Airflow` → `Filtration` → `Sensors` → `Telemetry`.

---

## 2) Stubs — Motivation & Konventionen (Phase 1)

**Warum Stubs?**

* **Determinismus:** Gleiches Input‑Set ⇒ gleiches Output‑Set (bei fixem Seed).
* **Schnell & schlank:** O(1) pro Device/Service.
* **Testbarkeit:** Reine Funktionen, vordefinierte Testvektoren.
* **Austauschbar:** Spätere „advanced“ Modelle behalten die **gleiche Signatur**.

**Gemeinsame Konventionen**

* `dt_h`: Schrittweite in Stunden (double).
* **Units:** W, Wh, m², m³/h, mg/h, µmol·m⁻²·s⁻¹ (PPFD), K, %.
* **Clamps:** Alle 0..1‑Skalen hart clampen; negative Flüsse/Bestände **vermeiden**.
* **Caps:** Stubs respektieren `capacity`/`max_*` aus **Blueprint‑Parametern**.
* **Telemetry:** Jeder Stub liefert Primär‑Outputs + Nebenwerte (z. B. `energy_Wh`).

---

## 3) Deterministische Orchestrierung (Phase‑Ordnungen)

**A) Interface‑Dok (Engine v1):**

1. Irrigation/Buffer → 2) Lighting → 3) Thermal → 4) Humidity → 5) Airflow → 6) Filtration → 7) Sensors → 8) Telemetry

**B) Stubs‑Dok (Phase 1):**

1. **IrrigationServiceStub** (Events)
2. **NutrientBufferStub** (Uptake/Leaching)
3. **Lighting → Thermal → Humidity → Airflow**
4. **Plant‑Physiology**
5. **Telemetry‑Aggregation**

> Beide Reihenfolgen sind **deterministisch**; Auswahl richtet sich nach Testzweck und Implementierungsdetail.

---

## 4) Stubs (Phase 1) — Spezifikationen

### 4.1 ThermalActuatorStub (`device.climate.temperature.*`)

**Inputs:** `{ power_W, efficiency01, mode: 'heat'|'cool'|'auto', max_heat_W?, max_cool_W? }`, `EnvState` (Luftmasse `m_air_kg`, Cp≈1.006 kJ/kgK), `setpoint_C?`, `dt_h`.

**Formeln (einfaches Referenzmodell)**

* **Heizen:** `wasteHeat_W = power_W * (1 - efficiency01)`  →  `ΔT_K = (wasteHeat_W * dt_h * 3600) / (m_air_kg * 1006)`
* **Kühlen:** `cooling_W = clamp(power_W * efficiency01, 0, max_cool_W)`  →  `ΔT_K = - (cooling_W * dt_h * 3600) / (m_air_kg * 1006)`
* **Auto:** Vorzeichen nach `setpoint_C - T_now`.

**Outputs:** `{ deltaT_K, energy_Wh: power_W * dt_h, used_W }`
**Bounds:** `|ΔT_K|` durch `max_*` begrenzen. **Keine** Kondensationslogik.

### 4.2 HumidityActuatorStub (`device.climate.humidity.*`)

**Inputs:** `{ mode: 'dehumidify'|'humidify', capacity_L_per_h | capacity_g_per_h }`, `EnvState` (T, rH, m_air_kg), `dt_h`.

**Proxy‑Modell**

* **Entfeuchten:** `removed_water_g = clamp(capacity_g_per_h * dt_h, 0, max)`
* **Befeuchten:** analog `added_water_g`.
* **ΔrH:** `ΔrH_pct ≈ k_rh(T) * (± water_g) / m_air_kg` (Lookup für kleines `k_rh`; **Stabilität vor Genauigkeit**).

**Outputs:** `{ deltaRH_pct, water_g, energy_Wh? }`
**Hinweis:** Kein Phasenwechsel‑Energiebonus; Kopplung an Thermal **später** möglich.

### 4.3 LightEmitterStub (`device.lighting.ppfd.*`)

**Inputs:** `{ ppfd_center_umol_m2s, coverage_m2, dim01∈[0,1] }`, `dt_h`.

**Feldmodell (einfach)**

* **Plateau+Abfall:** Innerhalb `coverage_m2` konstante `PPFD = ppfd_center * dim01`; außerhalb 0. (Phase 1 **ohne** radiales Abklingen.)
* **DLI:** `DLI_mol_m2d_increment = PPFD * (dt_h * 3600) / 1e6`.

**Outputs:** `{ ppfd_effective_umol_m2s, dli_mol_m2d_inc, energy_Wh? }` (Energie optional aus `power_W` falls im Blueprint vorhanden; sonst 0.)

### 4.4 NutrientBufferStub (`substrate.*`)

**Inputs:** `Caps: capacity_mg: {N,P,K,...}`, `leaching01∈[0,1]`, aktueller `buffer_mg`,
`flow_mg` (aus Irrigation), `uptake_demand_mg` (Pflanze/Zone), `nutrientSource: 'substrate'|'solution'|'mixed'`.

**Ablauf**

1. **Leaching:** `leach = flow_mg * leaching01`
2. **Available:** `available = buffer_mg + (flow_mg - leach)` je Nährstoff
3. **Uptake:** `uptake = clamp(uptake_demand_mg, 0, available)`
4. **Buffer‑Update:** `buffer_mg := clamp(buffer_mg + (flow_mg - leach - uptake), 0, capacity_mg)`

**Outputs:** `{ uptake_mg, leached_mg, new_buffer_mg }`
**Kein** Wasser‑Inventar; optionales `moisture01` ungenutzt.

### 4.5 IrrigationServiceStub (`irrigation.*` Service)

**Inputs je Event:** `{ water_L, concentrations_mg_per_L: {N,P,K,...} }`, Ziel (`zone`/`plant`), `nutrientSource` (aus `method.cultivation.*`).

**Ablauf**

* `nutrients_mg = water_L * concentrations_mg_per_L` berechnen.
* Auf Ziel(e) verteilen; `NutrientBufferStub.apply()` rufen ⇒ `uptake_mg`, `leached_mg`, `new_buffer`.
* (Optional) `moisture01 := clamp(moisture01 + alpha * water_L, 0, 1)` (Steuersignal).

**Outputs:** `telemetry.irrigation`: `{ water_L, nutrients_mg, uptake_mg, leached_mg }`.

### 4.6 Optional: MoistureControlStub

Einfaches Steuerglied **ohne** Wasserinventar:
`moisture01 := clamp(moisture01 + k_in*water_L - k_out*ET(dt_h), 0, 1)`.

---

## 5) Stacking‑Patterns (A–E)

### Pattern A — Multi‑Interface in **einem** Device (Split‑AC)

**Class:** `device.climate.temperature.split_ac`
**Implements:** `IThermalActuator` **+** `IHumidityActuator` **+** `IPowerConsumer` **+** `IPlacement` **+** `ICapLimited`.

```pseudo
function makeSplitAC(cfg): Device {
  return compose(
    ThermalActuatorStub({ power_W: cfg.power_W, efficiency01: cfg.efficiency01, max_cool_W: cfg.max_cool_W }),
    HumidityActuatorStub({ mode: 'dehumidify', capacity_g_per_h: cfg.dehum_g_h }),
    PowerConsumerStub({ power_W: cfg.power_W }),
    PlacementTrait({ scope: 'room', allowedPurposes: cfg.allowed }),
    CapLimited({ max_cool_W: cfg.max_cool_W, max_heat_W: 0 })
  )
}
```

**Ergebnis:** `deltaT_K` **und** `deltaRH_pct`, plus `energy_Wh`.

### Pattern B — Kombigerät (Entfeuchter mit Reheat)

**Class:** `device.climate.humidity.dehumidifier.reheat`
**Implements:** `IHumidityActuator` **+** `IThermalActuator` **+** `IPowerConsumer`.

```pseudo
function makeDehumReheat(cfg): Device {
  return compose(
    HumidityActuatorStub({ mode: 'dehumidify', capacity_g_per_h: cfg.cap_g_h }),
    ThermalActuatorStub({ power_W: cfg.reheat_W, efficiency01: 0.0, mode: 'heat' }),
    PowerConsumerStub({ power_W: cfg.electrical_W })
  )
}
```

**Hinweis:** Reheat erhöht sensible Wärme → kleiner **ΔT** zusätzlich zum rH‑Drop.

### Pattern C — **Komposition**: Airflow + Filter in Kette

**Classes:** `device.airflow.fan_inline`, `device.filtration.carbon_filter`
**Implements:** Lüfter → `IAirflowActuator`, `IPowerConsumer`; Filter → `IFiltrationUnit`, optional `IAirflowActuator` (Druckverlust).

```pseudo
function makeInlineFan(cfg) { return compose(AirflowStub(cfg), PowerConsumerStub(cfg)); }
function makeCarbonFilter(cfg) { return FiltrationStub(cfg); }

function evaluateChain(zone, dt_h) {
  const fan = makeInlineFan(fanCfg);
  const filter = makeCarbonFilter(filterCfg);
  const air = fan.computeEffect(zone, dt_h);           // m3/h Umluft / Abzug
  const airAfterLoss = applyPressureDrop(air, filter); // optionaler Δm3/h
  const odor = filter.computeEffect(zone, dt_h);       // ΔConcentration proxy
  return merge(airAfterLoss, odor);
}
```

**Wichtig:** **Reihenfolge** (erst Luftstrom, dann Filter) ist Teil des deterministischen Plans.

### Pattern D — Sensor + Aktuator in einem Gehäuse

**Class:** `device.sensing.temperature.controller_basic`
**Implements:** `ISensor<temperature>` **+** `IThermalActuator` **+** `IPowerConsumer`.

```pseudo
function makeTempController(cfg) {
  return compose(
    SensorStub.temperature({ noise01: 0 }),
    ThermalActuatorStub({ power_W: cfg.power_W, mode: 'heat' }),
    PowerConsumerStub({ power_W: cfg.power_W })
  );
}
```

**Leitlinie:** Sensorwerte dürfen **nicht** vom Aktuator‑Output **desselben** Ticks „verschmutzt“ werden → Messung **nach** Aktuatoren, aber mit **Snapshot** vor Tick‑Update (read‑then‑write Ordnung).

### Pattern E — Substrat‑Puffer + Irrigation (Service + Domain)

**Classes:** `substrate.*` + `irrigation.*`
**Implements:** Substrat → `INutrientBuffer` (optional `IMoistureControl`); Irrigation → `IIrrigationService`.

```pseudo
function tickNutrients(zone, dt_h) {
  const irrig = IrrigationServiceStub();
  const sub = NutrientBufferStub();
  const events = irrig.collectEvents(zone, dt_h);
  const flow_mg = irrig.toNutrientFlow(events);
  const res = sub.applyNutrientFlow(flow_mg, zone.uptakeDemand, dt_h);
  return res; // { uptake_mg, leached_mg, new_buffer_mg }
}
```

**Stacking‑Effekt:** Service + Domain‑Stub liefern gemeinsam den Nährstoff‑Outcome.

---

## 6) Komposition‑Helper & Namensdisziplin

```pseudo
function compose(...traits) {
  return traits.reduce((acc, t) => Object.assign(acc, t), {});
}
```

* Jedes Trait liefert **nur** seine klar benannten Methoden (`computeEffect`, `caps`, `describe`, …).
* **Namenskonflikte vermeiden:** Methoden‑Namen **pro Interface eindeutig** halten.

---

## 7) Telemetry‑Merge (Stack‑aware)

* Jede Teil‑Wirkung liefert Telemetry‑Slices (z. B. `energy_Wh`, `deltaT_K`, `deltaRH_pct`).
* Der Aggregator **summiert/merged** je Metrik; **Bounds/Clamps** gelten **nach** dem Merge.

---

## 8) Tests — Beispiele & Vektoren (Pflicht)

**Stacking‑Beispiele (Interface‑Dok)**

1. **Split‑AC:** Thermal(+) + Humidity(−) gleichzeitig; Energie‑Wh nur **einmal** (Power‑Trait).
2. **Dehum+Reheat:** rH sinkt, T steigt klein; **Caps** respektiert.
3. **Fan→Filter:** Airflow reduziert sich durch Filter‑Δp; Geruchskonzentration sinkt.
4. **Irrigation+Buffer:** Fluss → Uptake + Leaching + Buffer‑Update **deterministisch**.
5. **Sensor+Actuator:** Sensor liest „pre‑tick“, dann wirkt Aktuator; **keine** Feedback‑Schleifen im selben Tick.

**Testvektoren (Stubs‑Dok)**

* **Thermal:** 1000 W, eff=0.9, 50 m³ Raum (≈60 kg Luft) ⇒ ΔT ≈ **+0.6 K/h** (sanity).
* **Humidity:** 500 g/h dehumidify, 60 kg Luft, k_rh(25°C) ≈ 0.15 ⇒ ΔrH ≈ **‑1.25 %/h**.
* **Lighting:** 600 µmol·m⁻²·s⁻¹, 0.25 h ⇒ **DLI_inc ≈ 0.54 mol·m⁻²**.
* **NutrientBuffer:** capacity_N=10 000 mg, buffer_N=1000 mg, flow_N=500 mg, demand_N=300 mg, leach=10% ⇒ uptake=**300**, leached=**50**, new_buffer=**1150**.

**Acceptance (Stubs‑Dok)**

* Reine Funktionen, deterministisch, Einheiten geprüft.
* Caps/Clamps greifen; keine negativen Bestände/Flüsse.
* Tests für alle Stubs inkl. der oben genannten Vektoren.
* Telemetry‑Felder verfügbar (energy_Wh, dli_inc, uptake/leached, …).

---

## 9) Guidelines (Interface‑Dok)

* **So wenig Vererbung wie möglich**, **so viel Komposition wie nötig**.
* Multi‑Effekt‑Geräte = **Multi‑Interface**; Ketteneffekte = **Komposition**.
* **Reihenfolge ist Contract** — niemals implizit variieren.

---

**Ende — Konsolidierte Referenz (Engine v1, Phase 1)**
