import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { createTelemetryBinder } from "@ui/transport";
import { IntentClientProvider } from "@ui/transport/IntentClientContext";
import { SimControlBar } from "@ui/components/layout/SimControlBar";
import { ZoneDetailPage } from "@ui/pages/ZoneDetailPage";
import { WorkforcePage } from "@ui/pages/WorkforcePage";
import {
  resetTelemetryStore,
  useTelemetryStore,
  type TelemetryZoneSnapshotPayload
} from "@ui/state/telemetry";
import { applyReadModelSnapshot, useReadModelStore } from "@ui/state/readModels";
import { DEFAULT_SIMULATION_CLOCK, deriveSimulationClock } from "@ui/lib/simTime";
import { formatClockLabel, type SupportedLocale } from "@ui/lib/locale";
import { workspaceCopy } from "@ui/design/tokens";
import { initializeFacade } from "@wb/facade/index";
import { createDeterministicWorld } from "@wb/facade/backend/deterministicWorldLoader";
import { createReadModelProviders } from "@wb/facade/server/readModelProviders";
import { startFacadeDevServer, type FacadeDevServerInstance } from "@wb/facade/transport/devServer";

vi.mock("@/backend/src/domain/blueprints/taxonomy.ts", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const fallbackRoot = (() => {
    const candidates = [
      path.resolve(process.cwd(), "../../data/blueprints"),
      path.resolve(process.cwd(), "../data/blueprints"),
      path.resolve(process.cwd(), "data/blueprints")
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[candidates.length - 1];
  })();
  const TAXONOMY_SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  class BlueprintPathError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "BlueprintPathError";
    }
  }

  class BlueprintTaxonomyMismatchError extends Error {
    constructor(
      readonly filePath: string,
      readonly expectedClass: string,
      readonly actualClass: string
    ) {
      super(
        `Blueprint class mismatch for "${filePath}": expected "${expectedClass}" derived from the folder taxonomy, received "${actualClass}".`
      );
      this.name = "BlueprintTaxonomyMismatchError";
    }
  }

  interface BlueprintPathOptions {
    readonly blueprintsRoot?: string;
  }

  interface BlueprintTaxonomyFromPath {
    readonly expectedClass: string;
    readonly relativePath: string;
    readonly allowNamespaceSuffix: boolean;
  }

  const normaliseBlueprintRoot = (root?: string): string => {
    if (!root) {
      return fallbackRoot;
    }

    return path.isAbsolute(root) ? path.normalize(root) : path.resolve(root);
  };

  const toTaxonomySegment = (raw: string): string => {
    const normalised = raw.trim().replace(/[\s_]+/g, "-").toLowerCase();
    const collapsed = normalised.replace(/-+/g, "-");

    if (!TAXONOMY_SEGMENT_PATTERN.test(collapsed)) {
      throw new BlueprintPathError(
        `Path segment "${raw}" must be lowercase kebab-case to participate in the taxonomy.`
      );
    }

    return collapsed;
  };

  const toRelativeBlueprintPath = (filePath: string, root: string): string => {
    const absolutePath = path.isAbsolute(filePath) ? path.normalize(filePath) : path.resolve(filePath);
    const relative = path.relative(root, absolutePath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new BlueprintPathError(
        `Blueprint file "${filePath}" must reside under "${root}" to derive taxonomy metadata.`
      );
    }

    return relative.split(path.sep).filter(Boolean).join("/");
  };

  const deriveBlueprintClassFromPath = (
    filePath: string,
    options?: BlueprintPathOptions
  ): BlueprintTaxonomyFromPath => {
    if (!filePath) {
      throw new BlueprintPathError("Blueprint file path is required to derive taxonomy metadata.");
    }

    const root = normaliseBlueprintRoot(options?.blueprintsRoot);
    const relativePath = toRelativeBlueprintPath(filePath, root);
    const segments = relativePath.split("/");
    const directorySegments = segments.slice(0, -1);

    if (directorySegments.length === 0) {
      throw new BlueprintPathError(
        `Blueprint path "${relativePath}" must include at least <domain>/<file>.`
      );
    }

    if (directorySegments.length > 2) {
      throw new BlueprintPathError(
        `Blueprint path "${relativePath}" must not exceed two directories under the blueprints root.`
      );
    }

    const [domainSegment, nestedSegment] = directorySegments;
    const domain = toTaxonomySegment(domainSegment);

    if (!nestedSegment) {
      return {
        expectedClass: domain,
        allowNamespaceSuffix: false,
        relativePath
      } satisfies BlueprintTaxonomyFromPath;
    }

    const nested = toTaxonomySegment(nestedSegment);

    if (domain === "device") {
      return {
        expectedClass: `${domain}.${nested}`,
        allowNamespaceSuffix: false,
        relativePath
      } satisfies BlueprintTaxonomyFromPath;
    }

    if (domain === "room" || domain === "personnel") {
      return {
        expectedClass: `${domain}.${nested}`,
        allowNamespaceSuffix: true,
        relativePath
      } satisfies BlueprintTaxonomyFromPath;
    }

    throw new BlueprintPathError(
      `Blueprint path "${relativePath}" contains unsupported nested directory "${nested}" under domain "${domain}".`
    );
  };

  const assertBlueprintClassMatchesPath = (
    declaredClass: string,
    filePath: string,
    options?: BlueprintPathOptions
  ): void => {
    const derived = deriveBlueprintClassFromPath(filePath, options);
    const expected = derived.expectedClass;

    if (derived.allowNamespaceSuffix) {
      if (declaredClass !== expected && !declaredClass.startsWith(`${expected}.`)) {
        throw new BlueprintTaxonomyMismatchError(derived.relativePath, expected, declaredClass);
      }

      return;
    }

    if (declaredClass !== expected) {
      throw new BlueprintTaxonomyMismatchError(derived.relativePath, expected, declaredClass);
    }
  };

  return {
    BlueprintPathError,
    BlueprintTaxonomyMismatchError,
    deriveBlueprintClassFromPath,
    assertBlueprintClassMatchesPath
  } satisfies typeof import("@/backend/src/domain/blueprints/taxonomy.ts");
});

vi.mock("@/backend/src/domain/payroll/locationIndex.ts", () => {
    interface LocationIndexTable {
      readonly defaultIndex: number;
      readonly overrides: readonly never[];
    }
  const cachedTable: LocationIndexTable = { defaultIndex: 1, overrides: [] };

  return {
    loadLocationIndexTable: () => ({ ...cachedTable }),
    clearLocationIndexCache: () => {
      // no-op for deterministic stub
    },
    resolveLocationIndex: () => cachedTable.defaultIndex,
    createEmptyLocationIndexTable: () => ({ ...cachedTable })
  } satisfies typeof import("@/backend/src/domain/payroll/locationIndex.ts");
});

vi.mock("@/backend/src/domain/blueprints/strainBlueprintLoader.ts", () => ({
  loadAllStrainBlueprints: () => new Map(),
  loadStrainBlueprint: () => null,
  clearStrainBlueprintCache: () => {
    // no-op for deterministic stub
  }
}) satisfies typeof import("@/backend/src/domain/blueprints/strainBlueprintLoader.ts"));

const TELEMETRY_STEPS = 3;
const LOCALE: SupportedLocale = "en-US";
const temperatureFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1
});
const humidityFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0
});
type ReadModelStructures = ReturnType<typeof useReadModelStore.getState>["snapshot"]["structures"];

const resolveClockLabel = (simTimeHours: number) => {
  const clock = deriveSimulationClock(simTimeHours, DEFAULT_SIMULATION_CLOCK);
  const localeCopy = workspaceCopy.simControlBar.localeLabels[LOCALE];
  return formatClockLabel(clock, LOCALE, { day: localeCopy.day });
};
const findMatchingZone = (
  telemetry: readonly TelemetryZoneSnapshotPayload[],
  structures: ReadModelStructures
) => {
  for (const entry of telemetry) {
    for (const structure of structures) {
      for (const room of structure.rooms) {
        if (room.zones.some((zone) => zone.id === entry.zoneId)) {
          return { structureId: structure.id, roomId: room.id, zoneId: entry.zoneId, telemetry: entry };
        }
      }
    }
  }
  throw new Error("No matching zone found for telemetry event.");
};

describe("telemetry e2e wiring", () => {
  let facade: FacadeDevServerInstance;
  const teardownTasks: (() => Promise<void> | void)[] = [];

  beforeAll(async () => {
    resetTelemetryStore();
    facade = await startFacadeDevServer({ host: "127.0.0.1", port: 0 });
    facade.playback.pause();
    const binder = createTelemetryBinder({ baseUrl: facade.server.url });
    teardownTasks.push(() => binder.disconnect());
    await new Promise<void>((resolve) => {
      binder.on("connected", resolve);
      binder.connect();
    });
    const { world, companyWorld } = createDeterministicWorld();
    const { engineConfig } = initializeFacade({ scenarioId: "demo", verbose: false, world: companyWorld });
    const providers = createReadModelProviders({ world, companyWorld, config: engineConfig });
    const readModelSnapshot = await providers.readModels();
    applyReadModelSnapshot(readModelSnapshot);
  });

  afterEach(cleanup);

  afterAll(async () => {
    for (const task of teardownTasks.reverse()) await task();
    await facade.stop();
    resetTelemetryStore();
  });

  it("propagates façade telemetry into UI surfaces", async () => {
    for (let step = 0; step < TELEMETRY_STEPS; step += 1) facade.playback.step();

    await waitFor(() => expect(useTelemetryStore.getState().tickCompleted?.simTimeHours).toBeGreaterThan(0));
    await waitFor(() => expect(useTelemetryStore.getState().zoneSnapshots.size).toBeGreaterThan(0));
    await waitFor(() => expect(useTelemetryStore.getState().workforceKpi).not.toBeNull());

    const tickSnapshot = useTelemetryStore.getState().tickCompleted!;
    const zoneSnapshots = Array.from(useTelemetryStore.getState().zoneSnapshots.values());
    const workforceSnapshot = useTelemetryStore.getState().workforceKpi!;
    const readModelSnapshot = useReadModelStore.getState().snapshot;
    const matchingZone = findMatchingZone(zoneSnapshots, readModelSnapshot.structures);
    const { dayLabel, time } = resolveClockLabel(tickSnapshot.simTimeHours);

    render(
      <IntentClientProvider client={null}>
        <SimControlBar />
      </IntentClientProvider>
    );
    expect(screen.getByText(`${dayLabel} · ${time}`)).toBeInTheDocument();

    cleanup();

    render(
      <MemoryRouter>
        <IntentClientProvider client={null}>
          <ZoneDetailPage
            structureId={matchingZone.structureId}
            roomId={matchingZone.roomId}
            zoneId={matchingZone.zoneId}
          />
        </IntentClientProvider>
      </MemoryRouter>
    );
    const temperatureLabel = `${temperatureFormatter.format(matchingZone.telemetry.temp_c)} °C`;
    const temperatureRegion = screen.getByRole("region", { name: /temperature/i });
    expect(temperatureRegion).toHaveTextContent(temperatureLabel);
    const humidityLabel = `${humidityFormatter.format(Math.round(matchingZone.telemetry.relativeHumidity01 * 100))}%`;
    const humidityRegion = screen.getByRole("region", { name: /relative humidity/i });
    expect(humidityRegion).toHaveTextContent(humidityLabel);

    cleanup();

    const expectedUtilisationPercent = Math.round(workforceSnapshot.utilization01 * 100);
    render(
      <MemoryRouter>
        <IntentClientProvider client={null}>
          <WorkforcePage intentClient={null} />
        </IntentClientProvider>
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`Average utilization ${expectedUtilisationPercent}%`, "i"))).toBeInTheDocument()
    );
  });
});
