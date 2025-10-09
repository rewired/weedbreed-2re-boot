# UI Value Formatting & Rounding Proposal

**Status:** Proposed • **Owner:** unassigned • **Priority:** P2
**Tags:** frontend, formatting, i18n, UX
**Contracts:** Align with **SEC/TDD/DD**; no Engine-Änderungen erforderlich.

## Ziel

Konsistente Rundung/Formatierung numerischer UI-Werte. **Standard: 2 Nachkommastellen**. Sinnvolle Ausnahmen (0–3 NK) je Messgröße, damit Werte lesbar bleiben und trotzdem präzise genug sind.

## Leitlinien

* **Default:** 2 NK.
* **Grob (0–1 NK):** wenn Sensorik/Angaben ohnehin grob sind (RH, CO₂, m³/h, W).
* **Fein (3 NK):** nur in kritischen Low-Ranges (z. B. VPD < 0.50; EC < 1.00; DLI < 5; Wassermengen < 1 L).
* **Einheiten-Trennung:** Zahlenformatierung (Rundung, Locale) strikt von Einheitentext trennen → i18n-freundlich.

## Rundungs-Matrix (UI)

| Kategorie          | Einheit     | Regel                             |
| ------------------ | ----------- | --------------------------------- |
| PPFD               | µmol/m²/s   | **0** NK (ganzzahlig)             |
| DLI                | mol/m²·d    | **1** NK, bei `< 5` → **2**       |
| VPD                | kPa         | **2** NK, bei `< 0.50` → **3**    |
| Temperatur         | °C          | **1** NK                          |
| RH                 | %           | **0** NK                          |
| CO₂                | ppm         | **0** NK                          |
| Luftwechsel        | 1/h (ACH)   | **1** NK                          |
| Luftvolumenstrom   | m³/h        | **0** NK                          |
| Leistung           | W           | **0** NK                          |
| Leistung           | kW          | **2** NK                          |
| Energie            | kWh         | **2** NK                          |
| Kosten/Preis       | Währung     | **2** NK (Symbol via i18n/Locale) |
| Wasser             | L           | **1** NK, bei `< 1` L → **2**     |
| Irrigationsdauer   | s           | **0** NK                          |
| EC                 | mS/cm       | **2** NK, bei `< 1.00` → **3**    |
| pH                 | —           | **2** NK                          |
| Makro-Nährstoffe   | mg/L        | **1** NK                          |
| Mikro-Nährstoffe   | mg/L        | **2** NK                          |
| Prozent-Skalen 0–1 | % (anzeige) | **1** NK (zuvor *100)             |
| ΔTemperatur        | °C          | **2** NK                          |
| Masse              | g           | **1** NK, bei `< 10` g → **2**    |
| Fläche             | m²          | **2** NK                          |
| Volumen            | m³          | **2** NK                          |
| Zeitpunkte         | hh:mm       | keine NK; Sekunden nur in Logs    |

> **Hinweis:** Diese Matrix ist UI-spezifisch. Engine-Werte bleiben roh/unverändert (SEC-Kontrakt).

---

## Deliverables

1. `packages/ui/src/lib/format/formatValue.ts` – zentrale Format-Funktion (pure), inkl. Mapping `Kind → Regel`.
2. `packages/ui/src/lib/format/__tests__/formatValue.spec.ts` – Unit-Tests (alle Pfade + Edge-Cases).
3. `packages/ui/src/lib/format/i18n.ts` – dünne Locale-Helfer (Dezimaltrennzeichen, Tausenderpunkt, Währung).
4. Refactor: UI-Komponenten verwenden **ausschließlich** `formatValue` (Search-n-Replace in Zone/Room/Company Views).
5. Docs: Kurzabschnitt in `docs/SEC.md` (Verweis auf UI-Darstellung) & `docs/TDD.md` (UI-Format Rules verlinken).

---

## Akzeptanzkriterien

* **Konsistenz:** Keine ad-hoc `toFixed`/`Math.round`-Aufrufe in Komponenten.
* **Richtigkeit:** Unit-Tests decken **alle** Regeln + Low-Range-Ausnahmen ab.
* **i18n-Ready:** Währungs-/Zahlformat folgt OS/Locale; Einheiten angehängt, aber nicht lokalisiert (optional später).
* **Performance:** Formatierung ist O(1) pro Wert; kein Re-Render-Bottleneck.
* **Non-breaking:** Engine/Contracts **unverändert**; reine UI-Schicht.

---

## Hints für Codex (bitte genau befolgen)

### 1) Dateien & Grundgerüst

* Erstelle Ordnerstruktur:

  ```
  packages/ui/src/lib/format/
    ├─ formatValue.ts
    ├─ kinds.ts
    ├─ i18n.ts
    └─ __tests__/formatValue.spec.ts
  ```
* Exportiere einen **String-Union-Typ** `Kind` in `kinds.ts` mit allen Keys (ppfd, dli, vpd, …).
* `formatValue.ts`: reine Pure-Funktion `formatValue(value: number, kind: Kind, locale?: string): string`.

### 2) Implementierungsdetails

* Interne Helper:

  * `r(v: number, d: number): string` → numerische Rundung **ohne** Einheit.
  * `intlNumber(v: number, maxFractionDigits: number, locale?: string): string` → `Intl.NumberFormat` mit `minimumFractionDigits = maxFractionDigits` (für feste NK).
* **Kein** direktes Währungssymbol in `formatValue`; biete stattdessen `formatCurrency(amount: number, currencyCode: string, locale?: string)` in `i18n.ts` an (nutzt `Intl.NumberFormat({ style: "currency" })`).
* Prozent-Skalen: `percent01` erwartet **0–1** und gibt `%` mit **1** NK aus.
* Low-Range-Ausnahmen (if-Branches) exakt gemäß Tabelle.
* Einheiten **suffixen**: z. B. `" kPa"`, `" µmol/m²/s"`, `" m³/h"`, `" mS/cm"`, `" °C"`.

### 3) Tests (Vitest)

* **Happy Paths** je `Kind`, inkl. Grenzbereiche:

  * `vpd`: `0.47 → 3 NK`, `1.23 → 2 NK`.
  * `ec`: `0.95 → 3 NK`, `1.20 → 2 NK`.
  * `dli`: `4.9 → 2 NK`, `5.1 → 1 NK`.
  * `water_L`: `0.75 → 2 NK`, `1.25 → 1 NK`.
  * `percent01`: `0.835 → "83.5 %"` (1 NK, gerundet).
  * `ppfd`: `402.8 → "403 µmol/m²/s"`.
  * `rhPct`: `56.6 → "57 %"`.
  * `powerW`: `123.9 → "124 W"`, `powerkW`: `1.236 → "1.24 kW"`.
* **Locale Smoke Tests:** `locale="de-DE"` und `locale="en-US"` (Dezimal-/Tausendertrennzeichen).
* **Falsche Werte:** `NaN`, `Infinity`, negative Physikwerte → gib `"—"` zurück (Dash) und logge **nicht** im UI (optional: dev-guard).

### 4) Refactor-Hints

* Suche im Frontend nach `toFixed(`, `Math.round(`, `%` oder harter Einheitenverkettung – ersetze durch `formatValue`.
* Zonen-KPIs (Overview-Tab) zuerst umstellen: PPFD/DLI, Temp/RH/VPD, Stress% (aus 0–1), Wasser/EC/pH, Energie/Kosten.
* **Keine Engine-Änderungen.** Nur Darstellung.

### 5) DX & Lint

* ESLint-Rule (optional): verbiete `Number.prototype.toFixed` in `packages/ui` außer in `format/`.
* Unit-Tests **müssen** im CI (vitest) laufen. Keine Snapshot-Tests; nur exakte String-Vergleiche.

---

## Beispiel (nur als Referenz, nicht 1:1 einkleben)

```ts
// formatValue.ts (Ausschnitt)
import { Kind } from "./kinds";
import { intlNumber } from "./i18n";

const r = (v: number, d: number, locale?: string) =>
  intlNumber(v, d, locale);

export function formatValue(value: number, kind: Kind, locale?: string): string {
  if (!Number.isFinite(value)) return "—";

  switch (kind) {
    case "ppfd":       return `${Math.round(value)} µmol/m²/s`;
    case "dli":        return `${value < 5 ? r(value,2,locale) : r(value,1,locale)} mol/m²·d`;
    case "vpd":        return `${value < 0.5 ? r(value,3,locale) : r(value,2,locale)} kPa`;
    case "tempC":      return `${r(value,1,locale)} °C`;
    case "rhPct":      return `${Math.round(value)} %`;
    case "co2ppm":     return `${Math.round(value)} ppm`;
    case "ach":        return `${r(value,1,locale)} 1/h`;
    case "flow_m3h":   return `${Math.round(value)} m³/h`;
    case "powerW":     return `${Math.round(value)} W`;
    case "powerkW":    return `${r(value,2,locale)} kW`;
    case "energy_kWh": return `${r(value,2,locale)} kWh`;
    case "water_L":    return `${value < 1 ? r(value,2,locale) : r(value,1,locale)} L`;
    case "irrig_s":    return `${Math.round(value)} s`;
    case "ec_mScm":    return `${value < 1 ? r(value,3,locale) : r(value,2,locale)} mS/cm`;
    case "pH":         return r(value,2,locale);
    case "macro_mgL":  return `${r(value,1,locale)} mg/L`;
    case "micro_mgL":  return `${r(value,2,locale)} mg/L`;
    case "percent01":  return `${r(value * 100,1,locale)} %`;
    case "deltaC":     return `${r(value,2,locale)} °C`;
    case "mass_g":     return `${value < 10 ? r(value,2,locale) : r(value,1,locale)} g`;
    case "area_m2":    return `${r(value,2,locale)} m²`;
    case "vol_m3":     return `${r(value,2,locale)} m³`;
    case "time_hhmm": {
      const h = Math.floor(value);
      const m = Math.round((value - h) * 60);
      return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
    }
  }
}
```

---

## Integration / Roadmap

1. **Phase 1 (UI-Core):** Implementierung + Tests + Refactor Zonen-Overview.
2. **Phase 2 (weitere Screens):** Room/Structure/Company KPIs, Energy/Cost Panels.
3. **Phase 3 (i18n/Locale):** OS-Locale autodetektion; `--lang` Override im Electron-Shell (falls relevant).
4. **Phase 4 (Docs):** Kurzer Style-Guide-Abschnitt „Numeric Display Rules“.

> **Go/No-Go:** Sobald alle Komponenten die zentrale Format-Lib nutzen und Tests grün sind, ist dieses Proposal „Done“.
