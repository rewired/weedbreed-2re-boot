import { useMemo } from "react";
import type { StructureCapacityTile } from "@ui/components/structures/StructureCapacityGrid";
import { HOURS_PER_DAY } from "@engine/constants/simConstants.ts";
import type { StructureRoomSummary } from "@ui/components/structures/StructureRoomsGrid";
import type { StructureWorkforceAssignmentSummary } from "@ui/components/structures/StructureWorkforceSnapshot";
import { useStructureReadModel } from "@ui/lib/readModelHooks";
import { buildRoomPath } from "@ui/lib/navigation";
import type {
  StructureReadModel,
  StructureWarning,
  WorkforceAssignment
} from "@ui/state/readModels.types";

export interface StructureHeaderSummary {
  readonly id: string;
  readonly name: string;
  readonly location: string;
  readonly areaUsedLabel: string;
  readonly areaFreeLabel: string;
  readonly volumeUsedLabel: string;
  readonly volumeFreeLabel: string;
  readonly roomsCount: number;
  readonly zonesCount: number;
  readonly averageHealthPercent: number | null;
  readonly pestActiveIssues: number;
  readonly pestDueInspections: number;
  readonly pestUpcomingTreatments: number;
  readonly tariffs: StructureTariffSnapshot;
}

export interface StructureTariffSnapshot {
  readonly electricityPricePerKwh: number;
  readonly waterPricePerM3: number;
}

export interface StructureOverview {
  readonly header: StructureHeaderSummary;
  readonly coverageWarnings: readonly StructureWarning[];
  readonly capacityTiles: readonly StructureCapacityTile[];
  readonly rooms: readonly StructureRoomSummary[];
  readonly workforce: StructureWorkforceOverview;
}

export interface StructureWorkforceOverview {
  readonly openTasks: number;
  readonly notes: string;
  readonly assignments: readonly StructureWorkforceAssignmentSummary[];
}

const ELECTRICITY_TARIFF_SAMPLE_PER_KWH = 0.42;
const WATER_TARIFF_SAMPLE_PER_M3 = 3.4;

const STRUCTURE_TARIFFS: StructureTariffSnapshot = Object.freeze({
  electricityPricePerKwh: ELECTRICITY_TARIFF_SAMPLE_PER_KWH,
  waterPricePerM3: WATER_TARIFF_SAMPLE_PER_M3
});

const STRUCTURE_TARGET_ACH = 6;

function formatNumber(value: number, fractionDigits = 0): string {
  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
  return formatter.format(value);
}

function formatArea(value: number): string {
  return `${formatNumber(value)} m²`;
}

function formatVolume(value: number): string {
  return `${formatNumber(value)} m³`;
}

function computeAverageHealth(structure: StructureReadModel): number | null {
  const zoneSnapshots = structure.rooms.flatMap((room) => room.zones);

  if (zoneSnapshots.length === 0) {
    return null;
  }

  const total = zoneSnapshots.reduce((sum, zone) => sum + zone.kpis.healthPercent, 0);
  return total / zoneSnapshots.length;
}

function sumPestMetric(structure: StructureReadModel, pick: (zone: typeof structure.rooms[number]["zones"][number]) => number): number {
  return structure.rooms.reduce((roomAcc, room) => {
    return (
      roomAcc +
      room.zones.reduce((zoneAcc, zone) => {
        return zoneAcc + pick(zone);
      }, 0)
    );
  }, 0);
}

function toRoomSummary(structureId: string, room: StructureReadModel["rooms"][number]): StructureRoomSummary {
  return {
    id: room.id,
    name: room.name,
    detailPath: buildRoomPath(structureId, room.id),
    purposeLabel: room.purpose,
    areaUsedLabel: formatArea(room.capacity.areaUsed_m2),
    areaFreeLabel: formatArea(room.capacity.areaFree_m2),
    volumeUsedLabel: formatVolume(room.capacity.volumeUsed_m3),
    volumeFreeLabel: formatVolume(room.capacity.volumeFree_m3),
    zoneCount: room.zones.length,
    warnings: room.coverage.climateWarnings,
    actions: [
      {
        id: "duplicate-room",
        label: "Duplicate room",
        onSelect: () => {
          console.info("[stub] duplicate room", { structureId, roomId: room.id });
        },
        disabledReason: "Task 7000 will wire duplication flow."
      },
      {
        id: "move-device",
        label: "Move device",
        onSelect: () => {
          console.info("[stub] move device", { structureId, roomId: room.id });
        },
        disabledReason: "Task 8000 will wire device move orchestration."
      },
      {
        id: "open-capacity-advisor",
        label: "Capacity advisor",
        onSelect: () => {
          console.info("[stub] capacity advisor", { structureId, roomId: room.id });
        },
        disabledReason: "Advisor UI lands alongside Task 8000."
      }
    ]
  } satisfies StructureRoomSummary;
}

function toAssignmentSummary(assignment: WorkforceAssignment): StructureWorkforceAssignmentSummary {
  const scopeLabel = `${assignment.assignedScope} · ${assignment.targetId}`;
  return {
    id: `${assignment.employeeId}-${assignment.targetId}`,
    employeeName: assignment.employeeName,
    role: assignment.role,
    scopeLabel
  } satisfies StructureWorkforceAssignmentSummary;
}

function toCapacityTiles(structure: StructureReadModel): StructureCapacityTile[] {
  const lightingPercent = Math.round(structure.coverage.lightingCoverage01 * 100);
  const hvacPercent = Math.round(structure.coverage.hvacCapacity01 * 100);
  const electricityPerHour = structure.devices.reduce(
    (sum, device) => sum + device.powerDraw_kWh_per_hour,
    0
  );
  const hourlyBudget = structure.kpis.energyKwhPerDay / HOURS_PER_DAY;

  return [
    {
      id: "structure-capacity-lighting",
      title: "Lighting coverage",
      metricLabel: `${formatNumber(lightingPercent)}% demand met`,
      secondaryLabel: "Coverage ratio vs canopy target",
      status: structure.coverage.lightingCoverage01 >= 1 ? "ok" : "warn",
      note: "Derived from aggregate device coverage vs. SEC canopy demand.",
      warnings: structure.coverage.warnings
        .filter((warning) => warning.message.toLowerCase().includes("lighting"))
        .map((warning) => warning.message)
    },
    {
      id: "structure-capacity-hvac",
      title: "HVAC & airflow",
      metricLabel: `${formatNumber(hvacPercent)}% capacity`,
      secondaryLabel: `Measured ACH ${formatNumber(structure.coverage.airflowAch, 1)} / ${formatNumber(STRUCTURE_TARGET_ACH)}`,
      status:
        structure.coverage.hvacCapacity01 >= 1 && structure.coverage.airflowAch >= STRUCTURE_TARGET_ACH
          ? "ok"
          : "warn",
      note: "ACH target assumes SEC §4 airflow baseline (6 air changes per hour).",
      warnings: structure.coverage.warnings.map((warning) => warning.message)
    },
    {
      id: "structure-capacity-power",
      title: "Power draw",
      metricLabel: `${formatNumber(electricityPerHour, 1)} kWh/hour`,
      secondaryLabel: `Budget ${formatNumber(hourlyBudget, 1)} kWh/hour`,
      status: electricityPerHour <= hourlyBudget ? "ok" : "warn",
      note: "Sum of structure device draw compared to 24h average energy budget.",
      warnings: electricityPerHour <= hourlyBudget
        ? []
        : ["Electrical demand exceeds configured budget. Review device scheduling."]
    }
  ];
}

function toWorkforceOverview(structure: StructureReadModel): StructureWorkforceOverview {
  return {
    openTasks: structure.workforce.openTasks,
    notes: structure.workforce.notes,
    assignments: structure.workforce.activeAssignments.map(toAssignmentSummary)
  } satisfies StructureWorkforceOverview;
}

function toHeaderSummary(structure: StructureReadModel): StructureHeaderSummary {
  const roomsCount = structure.rooms.length;
  const zonesCount = structure.rooms.reduce((sum, room) => sum + room.zones.length, 0);

  return {
    id: structure.id,
    name: structure.name,
    location: structure.location,
    areaUsedLabel: formatArea(structure.capacity.areaUsed_m2),
    areaFreeLabel: formatArea(structure.capacity.areaFree_m2),
    volumeUsedLabel: formatVolume(structure.capacity.volumeUsed_m3),
    volumeFreeLabel: formatVolume(structure.capacity.volumeFree_m3),
    roomsCount,
    zonesCount,
    averageHealthPercent: computeAverageHealth(structure),
    pestActiveIssues: sumPestMetric(structure, (zone) => zone.pestStatus.activeIssues),
    pestDueInspections: sumPestMetric(structure, (zone) => zone.pestStatus.dueInspections),
    pestUpcomingTreatments: sumPestMetric(structure, (zone) => zone.pestStatus.upcomingTreatments),
    tariffs: STRUCTURE_TARIFFS
  } satisfies StructureHeaderSummary;
}

const FALLBACK_HEADER: StructureHeaderSummary = Object.freeze({
  id: "structure-placeholder",
  name: "Structure placeholder",
  location: "—",
  areaUsedLabel: formatArea(0),
  areaFreeLabel: formatArea(0),
  volumeUsedLabel: formatVolume(0),
  volumeFreeLabel: formatVolume(0),
  roomsCount: 0,
  zonesCount: 0,
  averageHealthPercent: null,
  pestActiveIssues: 0,
  pestDueInspections: 0,
  pestUpcomingTreatments: 0,
  tariffs: STRUCTURE_TARIFFS
});

const FALLBACK_OVERVIEW: StructureOverview = Object.freeze({
  header: FALLBACK_HEADER,
  coverageWarnings: [],
  capacityTiles: [
    {
      id: "structure-capacity-lighting",
      title: "Lighting coverage",
      metricLabel: "—",
      secondaryLabel: "Coverage ratio vs canopy target",
      status: "warn",
      note: "Structure snapshot unavailable.",
      warnings: []
    },
    {
      id: "structure-capacity-hvac",
      title: "HVAC & airflow",
      metricLabel: "—",
      secondaryLabel: "Measured ACH —",
      status: "warn",
      note: "Structure snapshot unavailable.",
      warnings: []
    },
    {
      id: "structure-capacity-power",
      title: "Power draw",
      metricLabel: "—",
      secondaryLabel: "Budget —",
      status: "warn",
      note: "Structure snapshot unavailable.",
      warnings: []
    }
  ],
  rooms: [],
  workforce: { openTasks: 0, notes: "No assignments loaded.", assignments: [] }
});

export function useStructureOverview(structureId: string | null | undefined): StructureOverview {
  const structure = useStructureReadModel(structureId);

  return useMemo(() => {
    if (!structure) {
      return FALLBACK_OVERVIEW;
    }

    return {
      header: toHeaderSummary(structure),
      coverageWarnings: structure.coverage.warnings,
      capacityTiles: toCapacityTiles(structure),
      rooms: structure.rooms.map((room) => toRoomSummary(structure.id, room)),
      workforce: toWorkforceOverview(structure)
    } satisfies StructureOverview;
  }, [structure]);
}

