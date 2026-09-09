import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { createDemoScenario, createEngineBootstrapConfig, hashSaveGameWorld, type SimulationWorld } from "@wb/engine";
import { createEngineCommandPipeline } from "@wb/facade/transport/engineCommandPipeline";
import { createTransportServer, type TransportServer } from "@wb/facade/transport/server";
import { createReadModelProviders } from "@wb/facade/server/readModelProviders";
import { createPlaybackController, type PlaybackController } from "@wb/facade/transport/playbackController";
import { createSimulationControlIntentHandler } from "@wb/facade/transport/devServer";
import { shouldAutoPauseForIncident } from "@wb/facade/transport/incidentTelemetry";
import { SessionGate } from "@ui/features/session/SessionGate";
import { ZoneSetupWizard } from "@ui/features/facility/ZoneSetupWizard";
import { ZoneSowingPanel } from "@ui/features/grow/ZoneSowingPanel";
import { ZoneIncidentPanel } from "@ui/features/grow/ZoneIncidentPanel";
import { ZoneHarvestPanel } from "@ui/features/grow/ZoneHarvestPanel";
import { InventoryPanel } from "@ui/features/inventory/InventoryPanel";
import { BreedingLab } from "@ui/features/breeding/BreedingLab";
import { RunSummaryPanel } from "@ui/features/run-summary/RunSummaryPanel";
import { SessionPersistencePanel } from "@ui/features/session/SessionPersistencePanel";
import { SESSION_SLOTS_STORAGE_KEY } from "@ui/features/session/sessionSlots";
import type { SessionEnvelope } from "@ui/features/session/sessionEnvelope.types";
import { createJourneyProgress, createSessionIntentHandler, reconcileJourneyProgress, type JourneyProgress } from "@wb/facade/intents/session";
import { createIntentClient, IntentClientProvider, type IntentClient } from "@ui/transport";
import type { ReadModelSnapshot } from "@ui/state/readModels.types";

vi.mock("@/backend/src/domain/blueprints/taxonomy.ts", () => {
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
      super(`Blueprint class mismatch for ${filePath}: expected ${expectedClass}, got ${actualClass}.`);
      this.name = "BlueprintTaxonomyMismatchError";
    }
  }

  return {
    BlueprintPathError,
    BlueprintTaxonomyMismatchError,
    deriveBlueprintClassFromPath: () => ({
      expectedClass: "test-only",
      relativePath: "test-only.json",
      allowNamespaceSuffix: false
    }),
    assertBlueprintClassMatchesPath: () => undefined
  };
});

vi.mock("@/backend/src/domain/payroll/locationIndex.ts", () => {
  const table = { defaultIndex: 1, overrides: [] as readonly never[] };

  return {
    loadLocationIndexTable: () => ({ ...table }),
    clearLocationIndexCache: () => undefined,
    resolveLocationIndex: () => table.defaultIndex,
    createEmptyLocationIndexTable: () => ({ ...table })
  };
});

vi.mock("@/backend/src/domain/blueprints/strainBlueprintLoader.ts", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const strainRoot = path.resolve(process.cwd(), "../../data/blueprints/strain");
  const blueprints = new Map(
    ["northern-lights.json", "sour-diesel.json"].map((fileName) => {
      const blueprint = JSON.parse(fs.readFileSync(path.join(strainRoot, fileName), "utf8")) as { id: string };
      return [blueprint.id, blueprint] as const;
    })
  );
  return {
    loadAllStrainBlueprints: () => new Map(blueprints),
    loadStrainBlueprint: (strainId: string) => blueprints.get(strainId) ?? null,
    clearStrainBlueprintCache: () => undefined
  };
});

describe("new game e2e wiring", () => {
  const NORTHERN_LIGHTS_ID = "3f0f15f4-1b75-4196-b3f3-5f6b6b7cf7a7";
  const SOUR_DIESEL_ID = "8b9a0b6c-2d6c-4f58-9c37-7a6c9d4aa5c2";
  let server: TransportServer;
  let intentClient: IntentClient;
  let world: SimulationWorld;
  let playback: PlaybackController;
  let journeyProgress: JourneyProgress;

  beforeAll(async () => {
    world = createDemoScenario({ companyName: "Previous Company", seed: "previous-seed" });
    journeyProgress = createJourneyProgress();
    const pipeline = createEngineCommandPipeline({
      world: {
        get: () => world,
        set: (nextWorld) => {
          world = nextWorld;
        }
      },
      createDemoScenario,
      context: {
        telemetry: {
          emit(topic, payload) {
            if (shouldAutoPauseForIncident(topic, payload)) playback.pause();
          }
        }
      },
      beforeWorldReplace: () => {
        playback.pause();
        journeyProgress = createJourneyProgress();
      }
    });
    playback = createPlaybackController({ pipeline, autoStart: false, baseIntervalMs: 1_000_000 });
    const handleSimulationControl = createSimulationControlIntentHandler({
      playback,
      parseSpeedMultiplier: (intent) => Number(intent.multiplier)
    });
    const sessionIntents = createSessionIntentHandler({
      getWorld: pipeline.getWorld,
      getPlayback: () => {
        const state = playback.getState();
        return { status: state.isPlaying ? "running" : "paused", speedMultiplier: state.speedMultiplier };
      },
      getJourneyProgress: () => journeyProgress,
      replace: async (state) => {
        playback.pause();
        pipeline.replaceWorld(state.world);
        journeyProgress = state.journeyProgress;
        playback.setSpeed(state.playback.speedMultiplier);
        if (state.playback.status === "running") playback.play();
      }
    });
    server = await createTransportServer({
      host: "127.0.0.1",
      port: 0,
      onIntent: async (intent) => {
        if (intent.type === "session.save.v1" || intent.type === "session.load.v1") {
          if (intent.type === "session.save.v1") journeyProgress = reconcileJourneyProgress(journeyProgress, pipeline.getWorld());
          return await sessionIntents(intent);
        }
        const controlAck = handleSimulationControl(intent);
        if (controlAck) {
          journeyProgress = reconcileJourneyProgress(journeyProgress, pipeline.getWorld());
          return controlAck;
        }
        const ack = await pipeline.handle(intent);
        journeyProgress = reconcileJourneyProgress(journeyProgress, pipeline.getWorld());
        return ack;
      }
    });
    const socketIntentClient = createIntentClient({ baseUrl: server.url });
    let intentSequence = 0;
    const normalizedIntentIds = new Map<string, string>();
    intentClient = {
      disconnect: () => socketIntentClient.disconnect(),
      submit: async (intent, handlers) => {
        const suppliedId = typeof intent.intentId === "string" ? intent.intentId : null;
        const lookupKey = suppliedId ?? `submission:${String(intentSequence + 1)}`;
        let deterministicId = normalizedIntentIds.get(lookupKey);
        if (!deterministicId) {
          intentSequence += 1;
          deterministicId = `90000000-0000-4000-8000-${String(intentSequence).padStart(12, "0")}`;
          normalizedIntentIds.set(lookupKey, deterministicId);
        }
        return await socketIntentClient.submit({ ...intent, intentId: deterministicId }, handlers);
      }
    };
  });

  afterEach(cleanup);

  afterAll(async () => {
    playback.dispose();
    await intentClient.disconnect();
    await server.close();
  });

  it("creates the canonical world through the rendered start screen and a real server ack", async () => {
    render(
      <IntentClientProvider client={intentClient}>
        <SessionGate>
          <div>Grow workspace</div>
        </SessionGate>
      </IntentClientProvider>
    );

    expect(screen.queryByText("Grow workspace")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Company Name"), {
      target: { value: " First F1 Labs " }
    });
    fireEvent.change(screen.getByLabelText(/Seed/), {
      target: { value: " integration-seed " }
    });
    fireEvent.click(screen.getByRole("button", { name: "New Game" }));

    expect(screen.queryByText("Grow workspace")).not.toBeInTheDocument();
    expect(await screen.findByText("Erzeuge und teste deine erste F1")).toBeVisible();
    expect(screen.getByText("0/9")).toBeVisible();
    expect(screen.getByText("Grow workspace")).toBeVisible();

    await waitFor(() => expect(world.company.name).toBe("First F1 Labs"));
    expect(world.seed).toBe("integration-seed");
    expect(world.company.structures).toHaveLength(1);
    const rooms = world.company.structures[0]?.rooms ?? [];
    const growroom = rooms.find((room) => room.purpose === "growroom");
    expect(growroom?.zones).toHaveLength(2);
    expect(growroom?.zones.every((zone) => zone.plants.length === 0)).toBe(true);
    expect(rooms.filter((room) => room.purpose === "storageroom")).toHaveLength(1);
    expect(rooms.filter((room) => room.purpose === "laboratory")).toHaveLength(1);

    const providers = createReadModelProviders({
      world: () => world,
      companyWorld: () => world.company,
      config: createEngineBootstrapConfig("demo"),
      playbackState: () => playback.getState()
    });
    let readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    const selectZone = (zoneIndex: number) => {
      const structure = readModels.structures[0];
      const room = structure?.rooms.find((entry) => entry.purpose === "growroom");
      const zone = room?.zones[zoneIndex];
      if (!structure || !room || !zone) throw new Error(`Demo read model did not expose grow zone ${String(zoneIndex)}.`);
      return { structure, room, zone };
    };

    cleanup();
    async function setUpZone(zoneIndex: number): Promise<void> {
      const renderWizard = () => {
        const selected = selectZone(zoneIndex);
        return (
          <IntentClientProvider client={intentClient}>
            <ZoneSetupWizard
              structureId={selected.structure.id}
              roomId={selected.room.id}
              zone={selected.zone}
              priceBook={readModels.priceBook}
              compatibility={readModels.compatibility}
              intentClient={intentClient}
              onRefresh={async () => {
                readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
                wizard.rerender(renderWizard());
              }}
            />
          </IntentClientProvider>
        );
      };
      const wizard = render(renderWizard());
      if (zoneIndex === 0) {
        expect(screen.getByText("Einmalkosten: 5400.00 CC")).toBeVisible();
        expect(screen.getByText("lighting-coverage")).toBeVisible();
        expect(screen.getByText("climate-control")).toBeVisible();
      }
      fireEvent.click(screen.getByRole("button", { name: "Zone einrichten" }));
      expect(screen.getByRole("button", { name: "Geräte werden installiert…" })).toBeDisabled();
      expect(await screen.findByText("bereit", {}, { timeout: 10_000 })).toBeVisible();
      expect(selectZone(zoneIndex).zone.readiness).toEqual({ status: "ready", missingPrerequisites: [] });
      wizard.unmount();
    }

    await setUpZone(0);
    await setUpZone(1);
    const growZones = world.company.structures[0]?.rooms.find((room) => room.purpose === "growroom")?.zones ?? [];
    for (const installedZone of growZones) {
      expect(installedZone.devices.filter((device) => device.slug === "led-veg-light-600")).toHaveLength(7);
      expect(installedZone.devices.filter((device) => device.slug === "cool-air-split-3000")).toHaveLength(1);
    }

    async function sowZone(zoneIndex: number, strainId: string, strainName: string): Promise<void> {
      const renderSowingPanel = () => {
        const selected = selectZone(zoneIndex);
        return (
          <IntentClientProvider client={intentClient}>
            <ZoneSowingPanel
              structureId={selected.structure.id}
              roomId={selected.room.id}
              zone={selected.zone}
              intentClient={intentClient}
              onRefresh={async () => {
                readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
                sowingPanel.rerender(renderSowingPanel());
              }}
            />
          </IntentClientProvider>
        );
      };
      const sowingPanel = render(renderSowingPanel());
      expect(screen.getByRole("option", { name: "Northern Lights" })).toBeEnabled();
      expect(screen.getByRole("option", { name: "Sour Diesel" })).toBeEnabled();
      fireEvent.change(screen.getByLabelText("Sorte"), { target: { value: strainId } });
      fireEvent.change(screen.getByLabelText("Menge"), { target: { value: "2" } });
      fireEvent.click(screen.getByRole("button", { name: "Säen" }));
      expect(screen.getByRole("button", { name: "Aussaat wird bestätigt…" })).toBeDisabled();
      expect(await screen.findByRole("list", { name: "Pflanzenfortschritt" }, { timeout: 10_000 })).toBeVisible();
      expect(screen.getAllByText(strainName)).toHaveLength(2);
      expect(screen.getAllByText("seedling")).toHaveLength(2);
      expect(selectZone(zoneIndex).zone.plants).toHaveLength(2);
      expect(selectZone(zoneIndex).zone.plants?.every((plant) => plant.strainId === strainId)).toBe(true);
      sowingPanel.unmount();
    }

    await sowZone(0, NORTHERN_LIGHTS_ID, "Northern Lights");
    await sowZone(1, SOUR_DIESEL_ID, "Sour Diesel");
    const plantedZones = world.company.structures[0]?.rooms.find((room) => room.purpose === "growroom")?.zones ?? [];
    expect(plantedZones[0]?.plants).toHaveLength(2);
    expect(plantedZones[0]?.plants.every((plant) => plant.strainId === NORTHERN_LIGHTS_ID)).toBe(true);
    expect(plantedZones[1]?.plants).toHaveLength(2);
    expect(plantedZones[1]?.plants.every((plant) => plant.strainId === SOUR_DIESEL_ID)).toBe(true);

    async function submitControl(type: "simulation.control.play" | "simulation.control.step"): Promise<void> {
      const result = await intentClient.submit({ type }, { onResult() { /* Awaited below. */ } });
      expect(result.ok).toBe(true);
    }

    await submitControl("simulation.control.play");
    readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    expect(readModels.simulation.paused).toBe(false);
    await submitControl("simulation.control.step");
    await submitControl("simulation.control.step");
    await submitControl("simulation.control.step");
    readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    expect(readModels.simulation.paused).toBe(true);
    const activeIncident = readModels.simulation.pendingIncidents.find((entry) => entry.status === "active");
    expect(activeIncident).toBeDefined();
    expect(activeIncident?.measured.value).toBe(32);
    expect(world.demoIncident?.status).toBe("active");

    cleanup();
    const renderIncident = () => (
      <IntentClientProvider client={intentClient}>
        <ZoneIncidentPanel
          incident={readModels.simulation.pendingIncidents[0]!}
          simulationPaused={readModels.simulation.paused}
          onRefresh={async () => {
            readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
            incidentPanel.rerender(renderIncident());
          }}
        />
      </IntentClientProvider>
    );
    const incidentPanel = render(renderIncident());
    expect(screen.getByText("Klima-Incident aktiv")).toBeVisible();
    expect(screen.getByText("Zeitraffer pausiert (Serverstatus)")).toBeVisible();
    expect(screen.getByText("32.0 °C")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("button", { name: "Applying…" })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled());
    expect(screen.getByText("Klima-Incident aktiv")).toBeVisible();

    await submitControl("simulation.control.step");
    readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    incidentPanel.rerender(renderIncident());
    expect(await screen.findByText("Klima-Incident gelöst")).toBeVisible();
    expect(readModels.simulation.paused).toBe(true);
    expect(readModels.simulation.pendingIncidents[0]?.status).toBe("resolved");
    expect(world.demoIncident?.status).toBe("resolved");
    const resolvedZone = world.company.structures.flatMap((structure) => structure.rooms)
      .flatMap((room) => room.zones).find((zone) => zone.id === activeIncident?.zoneId);
    expect(resolvedZone?.environment.airTemperatureC).toBeGreaterThanOrEqual(activeIncident?.targetBand.min ?? 0);
    expect(resolvedZone?.environment.airTemperatureC).toBeLessThanOrEqual(activeIncident?.targetBand.max ?? 0);

    expect(readModels.inventory.lots).toEqual([]);
    for (const selectedZone of [selectZone(0), selectZone(1)]) {
      const floweringSchedule = await intentClient.submit(
        {
          type: "intent.zone.lighting.adjust.v1",
          structureId: selectedZone.structure.id,
          zoneId: selectedZone.zone.id,
          lightSchedule: { onHours: 12, offHours: 12, startHour: 0 }
        },
        { onResult() { /* Awaited below. */ } }
      );
      expect(floweringSchedule.ok).toBe(true);
    }
    let allParentsReady = false;
    for (let tick = 0; tick < 4_000; tick += 1) {
      await submitControl("simulation.control.step");
      if (tick % 25 !== 24) continue;
      const zones = world.company.structures[0]?.rooms.find((room) => room.purpose === "growroom")?.zones ?? [];
      allParentsReady = zones.length === 2
        && zones.every((zone) => zone.plants.length > 0 && zone.plants.every((plant) => plant.readyForHarvest));
      if (allParentsReady) break;
    }
    expect(allParentsReady).toBe(true);
    readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    expect(readModels.simulation.paused).toBe(true);
    expect(readModels.inventory.lots).toEqual([]);

    incidentPanel.unmount();
    const submittedHarvestIntents: Parameters<IntentClient["submit"]>[0][] = [];
    const submittedSaleIntents: Parameters<IntentClient["submit"]>[0][] = [];
    const recordingClient: IntentClient = {
      disconnect: () => intentClient.disconnect(),
      submit: async (intent, handlers) => {
        if (intent.type === "plants.harvest.v1") submittedHarvestIntents.push(intent);
        if (intent.type === "inventory.sell.v1") submittedSaleIntents.push(intent);
        return await intentClient.submit(intent, handlers);
      }
    };
    async function harvestZone(zoneIndex: number, strainName: string): Promise<void> {
      const beforeLotCount = readModels.inventory.lots.length;
      const renderHarvest = () => {
        const selected = selectZone(zoneIndex);
        return (
          <IntentClientProvider client={recordingClient}>
            <ZoneHarvestPanel
              structureId={selected.structure.id}
              roomId={selected.room.id}
              zone={selected.zone}
              intentClient={recordingClient}
              onRefresh={async () => {
                readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
                harvestPanel.rerender(renderHarvest());
              }}
            />
            <InventoryPanel inventory={readModels.inventory} />
          </IntentClientProvider>
        );
      };
      const harvestPanel = render(renderHarvest());
      expect(screen.getAllByText("Erntereif")).toHaveLength(2);
      fireEvent.click(screen.getByRole("button", { name: "Erntereife Pflanzen ernten (2)" }));
      expect(screen.getByRole("button", { name: "Ernte wird bestätigt…" })).toBeDisabled();
      await waitFor(() => expect(readModels.inventory.lots).toHaveLength(beforeLotCount + 2), { timeout: 10_000 });
      expect(screen.getAllByText(strainName).length).toBeGreaterThanOrEqual(2);
      const strainLots = readModels.inventory.lots.filter((lot) => lot.strainName === strainName);
      expect(strainLots).toHaveLength(2);
      expect(strainLots.every((lot) => lot.quality01 >= 0 && lot.quality01 <= 1)).toBe(true);
      harvestPanel.unmount();
    }

    await harvestZone(0, "Northern Lights");
    const northernLightsLot = readModels.inventory.lots.find((lot) => lot.strainId === NORTHERN_LIGHTS_ID);
    if (!northernLightsLot?.salePreview) throw new Error("Northern Lights sale preview missing after harvest.");
    const authoritativeLotBeforeSale = world.company.structures.flatMap((structure) => structure.rooms)
      .flatMap((room) => room.inventory?.lots ?? []).find((lot) => lot.id === northernLightsLot.lotId);
    if (!authoritativeLotBeforeSale) throw new Error("Authoritative Northern Lights lot missing after harvest.");
    const salePreview = northernLightsLot.salePreview;
    const saleLedgerCountBefore = readModels.economy.ledger.filter((entry) => entry.category === "sale").length;
    const renderSale = () => (
      <IntentClientProvider client={recordingClient}>
        <InventoryPanel
          inventory={readModels.inventory}
          economy={readModels.economy}
          intentClient={recordingClient}
          onRefresh={async () => {
            readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
            salePanel.rerender(renderSale());
          }}
        />
      </IntentClientProvider>
    );
    const salePanel = render(renderSale());
    fireEvent.change(screen.getByLabelText("Verkaufslot"), { target: { value: northernLightsLot.lotId } });
    const renderedPreview = screen.getByLabelText("Verkaufsvorschau");
    expect(within(renderedPreview).getAllByText(`${salePreview.soldFreshWeightKg.toFixed(3)} kg`).length).toBeGreaterThan(0);
    expect(within(renderedPreview).getAllByText(`${salePreview.soldDryWeightKg.toFixed(3)} kg`).length).toBeGreaterThan(0);
    expect(within(renderedPreview).getByText(`${salePreview.qualityFactor.toFixed(3)}`)).toBeVisible();
    expect(within(renderedPreview).getByText(`${salePreview.priceCcPerDryGram.toFixed(2)} CC/g`)).toBeVisible();
    expect(within(renderedPreview).getByText(`${salePreview.proceedsCc.toFixed(2)} CC`)).toBeVisible();
    expect(within(renderedPreview).getByText(`${salePreview.balanceBeforeCc.toFixed(2)} CC`)).toBeVisible();
    expect(within(renderedPreview).getByText(`${salePreview.balanceAfterCc.toFixed(2)} CC`)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "50% verkaufen" }));
    expect(screen.getByRole("button", { name: "Verkauf wird bestätigt…" })).toBeDisabled();
    await waitFor(() => expect(readModels.economy.ledger.filter((entry) => entry.category === "sale")).toHaveLength(saleLedgerCountBefore + 1), { timeout: 10_000 });
    const partialRemainder = readModels.inventory.lots.find((lot) => lot.lotId === northernLightsLot.lotId);
    const authoritativeLotAfterSale = world.company.structures.flatMap((structure) => structure.rooms)
      .flatMap((room) => room.inventory?.lots ?? []).find((lot) => lot.id === northernLightsLot.lotId);
    expect(authoritativeLotAfterSale?.freshWeight_kg).toBe(authoritativeLotBeforeSale.freshWeight_kg * 0.5);
    expect(partialRemainder?.remainingFreshWeightKg).toBe(Number(authoritativeLotAfterSale?.freshWeight_kg.toFixed(6)));
    const authoritativeSaleEntry = world.economy?.ledger.find((entry) => entry.category === "sale");
    expect(authoritativeSaleEntry?.amountCc).toBeCloseTo(salePreview.proceedsCc, 6);
    expect(readModels.economy.balanceCc).toBe(authoritativeSaleEntry?.balanceAfterCc);
    expect(readModels.economy.balanceCc).toBeCloseTo(salePreview.balanceAfterCc, 6);
    expect(readModels.economy.cycleContributionMarginCc).toBeCloseTo(salePreview.cycleContributionMarginAfterCc, 6);
    expect(submittedSaleIntents).toHaveLength(1);
    salePanel.unmount();

    await harvestZone(1, "Sour Diesel");
    expect(readModels.inventory.lots).toHaveLength(4);
    expect(submittedHarvestIntents).toHaveLength(2);

    const replay = submittedHarvestIntents[0];
    if (!replay) throw new Error("UI did not submit a harvest intent for replay verification.");
    const replayResult = await intentClient.submit(replay, { onResult() { /* Awaited below. */ } });
    expect(replayResult.ok).toBe(true);
    readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    expect(readModels.inventory.lots).toHaveLength(4);

    const saleReplay = submittedSaleIntents[0];
    if (!saleReplay) throw new Error("UI did not submit a sale intent for replay verification.");
    const balanceAfterSale = readModels.economy.balanceCc;
    const saleLedgerCount = readModels.economy.ledger.filter((entry) => entry.category === "sale").length;
    const saleReplayResult = await intentClient.submit(saleReplay, { onResult() { /* Awaited below. */ } });
    expect(saleReplayResult.ok).toBe(true);
    readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    expect(readModels.economy.balanceCc).toBe(balanceAfterSale);
    expect(readModels.economy.ledger.filter((entry) => entry.category === "sale")).toHaveLength(saleLedgerCount);

    const invalidSaleResult = await intentClient.submit(
      { type: "inventory.sell.v1", intentId: "90000000-0000-4000-9000-000000000001", lotId: northernLightsLot.lotId, fraction01: 1.01 },
      { onResult() { /* Awaited below. */ } }
    );
    expect(invalidSaleResult.ok).toBe(false);
    readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    expect(readModels.economy.balanceCc).toBe(balanceAfterSale);
    expect(readModels.economy.ledger.filter((entry) => entry.category === "sale")).toHaveLength(saleLedgerCount);

    expect(readModels.breeding.qualifiedParents.map((parent) => parent.name)).toEqual(["Northern Lights", "Sour Diesel"]);
    expect(readModels.breeding.crossEligibility).toEqual({ eligible: true, reasons: [] });
    const renderBreeding = () => (
      <IntentClientProvider client={intentClient}>
        <BreedingLab
          breeding={readModels.breeding}
          intentClient={intentClient}
          onRefresh={async () => {
            readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
            breedingPanel.rerender(renderBreeding());
          }}
        />
      </IntentClientProvider>
    );
    const breedingPanel = render(renderBreeding());
    expect(screen.getByLabelText("Populationsgröße")).toHaveValue("4");
    fireEvent.click(screen.getByRole("button", { name: "F1-Cross starten" }));
    expect(screen.getByRole("button", { name: "Cross wird bestätigt…" })).toBeDisabled();
    await waitFor(() => expect(readModels.breeding.runs).toHaveLength(1), { timeout: 10_000 });
    const generatedRun = readModels.breeding.runs[0];
    if (!generatedRun) throw new Error("Breeding read model did not expose the generated run.");
    expect(generatedRun.populationSize).toBe(4);
    expect(generatedRun.candidates).toHaveLength(4);
    expect(screen.getByRole("table", { name: "Vergleich der Eltern und F1-Kandidaten" })).toBeVisible();

    const selectedCandidate = generatedRun.candidates[0];
    if (!selectedCandidate) throw new Error("Breeding run did not expose a selectable candidate.");
    fireEvent.click(screen.getByRole("radio", { name: `${selectedCandidate.name} auswählen` }));
    fireEvent.change(screen.getByLabelText("Name der eigenen Sorte"), { target: { value: "Ramp One" } });
    fireEvent.click(screen.getByRole("button", { name: "Als Sorte übernehmen" }));
    expect(screen.getByRole("button", { name: "Auswahl wird bestätigt…" })).toBeDisabled();
    await waitFor(() => expect(readModels.breeding.runs[0]?.status).toBe("selected"), { timeout: 10_000 });
    expect(screen.getByRole("status")).toHaveTextContent("Ramp One");
    expect(readModels.breeding.runs[0]?.customStrain).toEqual({
      strainId: selectedCandidate.candidateId,
      name: "Ramp One",
      slug: "ramp-one"
    });

    const rejectedSecondSelection = await intentClient.submit({
      type: "breeding.selectCandidate.v1",
      intentId: "90000000-0000-4000-9000-000000000002",
      runId: generatedRun.runId,
      candidateId: generatedRun.candidates[1]!.candidateId,
      name: "Ramp Two"
    }, { onResult() { /* Awaited below. */ } });
    expect(rejectedSecondSelection.ok).toBe(false);
    readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    expect(readModels.breeding.runs).toHaveLength(1);
    expect(readModels.breeding.runs[0]?.selectedCandidateId).toBe(selectedCandidate.candidateId);
    expect(world.breeding?.customStrainRegistry).toHaveLength(1);
    breedingPanel.unmount();

    const customZone = selectZone(0);
    const customChoice = customZone.zone.strainChoices?.find((choice) => choice.strainId === selectedCandidate.candidateId);
    expect(customChoice).toMatchObject({ name: "Ramp One", eligible: true });
    const discardedCandidateIds = generatedRun.candidates.slice(1).map((candidateEntry) => candidateEntry.candidateId);
    expect(customZone.zone.strainChoices?.some((choice) => discardedCandidateIds.includes(choice.strainId))).toBe(false);
    const renderCustomSowing = () => {
      const selected = selectZone(0);
      return (
        <IntentClientProvider client={intentClient}>
          <ZoneSowingPanel
            structureId={selected.structure.id}
            roomId={selected.room.id}
            zone={selected.zone}
            intentClient={intentClient}
            onRefresh={async () => {
              readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
              customSowingPanel.rerender(renderCustomSowing());
            }}
          />
        </IntentClientProvider>
      );
    };
    const customSowingPanel = render(renderCustomSowing());
    expect(screen.getByRole("option", { name: "Ramp One" })).toBeEnabled();
    for (const discarded of generatedRun.candidates.slice(1)) {
      expect(screen.queryByRole("option", { name: discarded.name })).not.toBeInTheDocument();
    }
    fireEvent.change(screen.getByLabelText("Sorte"), { target: { value: selectedCandidate.candidateId } });
    fireEvent.change(screen.getByLabelText("Menge"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Säen" }));
    expect(screen.getByRole("button", { name: "Aussaat wird bestätigt…" })).toBeDisabled();
    await waitFor(() => expect(selectZone(0).zone.plants?.some((plant) => plant.status === "active" && plant.strainId === selectedCandidate.candidateId)).toBe(true), { timeout: 10_000 });
    expect(world.company.structures.flatMap((structure) => structure.rooms).flatMap((room) => room.zones)
      .flatMap((zone) => zone.plants).some((plant) => plant.status === "active" && plant.strainId === selectedCandidate.candidateId)).toBe(true);
    customSowingPanel.unmount();

    expect(readModels.runSummary.status).toBe("in-progress");
    expect(readModels.runSummary.completed).toBe(false);
    expect(readModels.runSummary.entries.find((entry) => entry.role === "selected-f1")?.actual).toBeNull();
    const beforeF1HarvestSummary = render(<RunSummaryPanel summary={readModels.runSummary} />);
    expect(screen.getByRole("status")).toHaveTextContent("Ziel läuft");
    expect(screen.getByRole("row", { name: /Ramp One/ })).toHaveTextContent("Noch keine reale Ernte");
    beforeF1HarvestSummary.unmount();

    const floweringCustomZone = selectZone(0);
    const customFloweringSchedule = await intentClient.submit({
      type: "intent.zone.lighting.adjust.v1",
      structureId: floweringCustomZone.structure.id,
      zoneId: floweringCustomZone.zone.id,
      lightSchedule: { onHours: 12, offHours: 12, startHour: 0 }
    }, { onResult() { /* Awaited below. */ } });
    expect(customFloweringSchedule.ok).toBe(true);
    let f1Ready = false;
    for (let tick = 0; tick < 4_000; tick += 1) {
      await submitControl("simulation.control.step");
      if (tick % 25 !== 24) continue;
      const customPlant = world.company.structures.flatMap((structure) => structure.rooms)
        .flatMap((room) => room.zones).flatMap((zone) => zone.plants)
        .find((plant) => plant.strainId === selectedCandidate.candidateId && plant.status === "active");
      f1Ready = customPlant?.readyForHarvest === true;
      if (f1Ready) break;
    }
    expect(f1Ready).toBe(true);
    readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    expect(readModels.runSummary.status).toBe("in-progress");
    expect(readModels.runSummary.completed).toBe(false);
    expect(readModels.inventory.lots.some((lot) => lot.strainId === selectedCandidate.candidateId)).toBe(false);

    const renderF1Harvest = () => {
      const selected = selectZone(0);
      return (
        <IntentClientProvider client={intentClient}>
          <ZoneHarvestPanel
            structureId={selected.structure.id}
            roomId={selected.room.id}
            zone={selected.zone}
            intentClient={intentClient}
            onRefresh={async () => {
              readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
              f1HarvestPanel.rerender(renderF1Harvest());
            }}
          />
        </IntentClientProvider>
      );
    };
    const f1HarvestPanel = render(renderF1Harvest());
    expect(screen.getByText("1 erntereif")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Erntereife Pflanzen ernten (1)" }));
    expect(screen.getByRole("button", { name: "Ernte wird bestätigt…" })).toBeDisabled();
    await waitFor(() => expect(readModels.runSummary.status).toBe("completed"), { timeout: 10_000 });
    f1HarvestPanel.unmount();

    expect(readModels.runSummary.completed).toBe(true);
    expect(readModels.runSummary.entries.map((entry) => entry.role)).toEqual(["seed-parent", "pollen-parent", "selected-f1"]);
    const f1Summary = readModels.runSummary.entries.find((entry) => entry.role === "selected-f1");
    expect(f1Summary?.name).toBe("Ramp One");
    expect(f1Summary?.actual).not.toBeNull();
    expect(f1Summary?.actual?.harvestedPlantCount).toBe(1);
    expect(f1Summary?.actual?.harvestedFreshWeightG).toBeGreaterThan(0);
    expect(f1Summary?.actual?.saleStatus).toBe("not-sold");
    expect(readModels.inventory.lots.some((lot) => lot.strainId === selectedCandidate.candidateId)).toBe(true);
    const completedSummary = render(<RunSummaryPanel summary={readModels.runSummary} />);
    expect(screen.getByRole("status")).toHaveTextContent("Ziel abgeschlossen");
    const renderedF1Summary = screen.getByRole("row", { name: /Ramp One/ });
    expect(within(renderedF1Summary).getByText(`${f1Summary!.actual!.harvestedFreshWeightG.toFixed(1)} g`)).toBeVisible();
    expect(within(renderedF1Summary).getByText(`${(f1Summary!.actual!.averageQuality01 * 100).toFixed(1)}%`)).toBeVisible();
    expect(within(renderedF1Summary).getByText(`${f1Summary!.blueprintPotential.yieldPotentialGPerPlant.toFixed(1)} g/Pflanze`)).toBeVisible();
    expect(screen.getByText(/Gemeinsame Strom-, Wasser- und Betriebskosten werden nicht künstlich/)).toBeVisible();
    completedSummary.unmount();

    playback.setSpeed(8);
    playback.pause();
    readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    const savedEvidence = {
      customStrains: structuredClone(world.breeding?.customStrainRegistry ?? []),
      inventory: structuredClone(readModels.inventory),
      balanceCc: readModels.economy.balanceCc,
      simTimeHours: readModels.simulation.simTimeHours,
      playback: structuredClone(playback.getState()),
      runSummary: structuredClone(readModels.runSummary)
    };
    let storedSlots: string | null = null;
    const reloadStorage = {
      getItem: (key: string) => key === SESSION_SLOTS_STORAGE_KEY ? storedSlots : null,
      setItem: (key: string, value: string) => {
        if (key === SESSION_SLOTS_STORAGE_KEY) storedSlots = value;
      }
    };
    const savePanel = render(
      <SessionPersistencePanel
        intentClient={intentClient}
        sessionActive
        storage={reloadStorage}
        onLoaded={() => { /* A save does not transition the session. */ }}
      />
    );
    fireEvent.change(screen.getByLabelText("Name des Speicherstands"), { target: { value: "Ramp One abgeschlossen" } });
    fireEvent.click(screen.getByRole("button", { name: "Spiel speichern" }));
    expect(await screen.findByText("„Ramp One abgeschlossen“ wurde gespeichert.", {}, { timeout: 10_000 })).toBeVisible();
    if (!storedSlots) throw new Error("The acknowledged facade envelope was not persisted in the local slot.");
    const savedSession = (JSON.parse(storedSlots) as { session: SessionEnvelope }[])[0]?.session;
    if (!savedSession) throw new Error("The named slot did not contain a facade session envelope.");
    expect(savedSession.worldHash).toBe(hashSaveGameWorld(world));
    expect(savedSession.journeyProgress.milestones).toHaveLength(9);
    expect(savedSession.playback).toEqual({ status: "paused", speedMultiplier: 8 });
    savePanel.unmount();

    const destroyResult = await intentClient.submit(
      { type: "game.new.v1", companyName: "Destroyed Session", seed: "destroyed-session" },
      { onResult() { /* Awaited below. */ } }
    );
    expect(destroyResult.ok).toBe(true);
    readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
    expect(world.company.name).toBe("Destroyed Session");
    expect(world.breeding?.customStrainRegistry ?? []).toEqual([]);
    expect(readModels.simulation.simTimeHours).not.toBe(savedEvidence.simTimeHours);

    let refreshedAfterLoad = 0;
    let reloadRevealed = false;
    let reloadSubmission: Awaited<ReturnType<IntentClient["submit"]>> | null = null;
    const reloadClient: IntentClient = {
      disconnect: () => intentClient.disconnect(),
      submit: async (intent, handlers) => {
        reloadSubmission = await intentClient.submit(intent, handlers);
        return reloadSubmission;
      }
    };
    const reloadPanel = render(
      <SessionPersistencePanel
        intentClient={reloadClient}
        sessionActive={false}
        storage={reloadStorage}
        onRefresh={async () => {
          refreshedAfterLoad += 1;
          readModels = (await providers.readModels()) as unknown as ReadModelSnapshot;
        }}
        onLoaded={() => {
          expect(refreshedAfterLoad).toBe(1);
          reloadRevealed = true;
        }}
      />
    );
    expect(screen.getByText("Ramp One abgeschlossen")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Laden" }));
    await waitFor(() => expect(reloadSubmission).not.toBeNull(), { timeout: 10_000 });
    if (!reloadSubmission?.ok) {
      throw new Error(`Session reload rejected: ${reloadSubmission?.ack.error.message ?? "missing acknowledgement"}`);
    }
    await waitFor(() => expect(reloadRevealed).toBe(true), { timeout: 10_000 });
    expect(refreshedAfterLoad).toBe(1);
    expect(hashSaveGameWorld(world)).toBe(savedSession.worldHash);
    expect(world.breeding?.customStrainRegistry).toEqual(savedEvidence.customStrains);
    expect(readModels.inventory).toEqual(savedEvidence.inventory);
    expect(readModels.economy.balanceCc).toBe(savedEvidence.balanceCc);
    expect(readModels.simulation.simTimeHours).toBe(savedEvidence.simTimeHours);
    expect(playback.getState()).toEqual(savedEvidence.playback);
    expect(journeyProgress.milestones).toEqual(savedSession.journeyProgress.milestones);
    expect(journeyProgress.milestones).toHaveLength(9);
    expect(readModels.runSummary).toEqual(savedEvidence.runSummary);
    expect(readModels.runSummary.completed).toBe(true);
    expect(readModels.runSummary.entries.find((entry) => entry.role === "selected-f1")?.name).toBe("Ramp One");
    reloadPanel.unmount();
  }, 120_000);
});
