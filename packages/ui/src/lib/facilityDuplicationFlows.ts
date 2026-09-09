import { AREA_QUANTUM_M2, ROOM_DEFAULT_HEIGHT_M } from "@engine/constants/simConstants.ts";
import { assessCapacity, assessCultivationIrrigation } from "@ui/lib/validation";
import type { PriceBookCatalog, ZoneReadModel } from "@ui/state/readModels.types";
import type {
  DuplicateRoomInputs,
  DuplicateZoneInputs,
  RoomAreaUpdateInputs,
  RoomAreaUpdateResult,
  RoomDuplicateIntentPayload,
  RoomDuplicateResult,
  RoomSetAreaIntentPayload,
  ZoneAreaUpdateInputs,
  ZoneAreaUpdateResult,
  ZoneDuplicateIntentPayload,
  ZoneDuplicateResult,
  ZoneSetAreaIntentPayload
} from "./facilityFlows";

function appendError(errors: string[], message: string): void {
  if (!errors.includes(message)) errors.push(message);
}
function ensurePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
function isMultipleOfQuantum(area_m2: number): boolean {
  const scaled = area_m2 / AREA_QUANTUM_M2;
  return Math.abs(scaled - Math.round(scaled)) <= 1e-6;
}
function computeVolume(area_m2: number, height_m: number): number {
  return area_m2 * height_m;
}
function calculateMaxPlants(area_m2: number, areaPerPlant_m2: number): number {
  if (!Number.isFinite(areaPerPlant_m2) || areaPerPlant_m2 <= 0) return 0;
  return Math.floor(area_m2 / areaPerPlant_m2);
}

function sumDeviceCapex(zone: ZoneReadModel, priceBook: PriceBookCatalog): number {
  let total = 0;
  for (const device of zone.devices) {
    const priceEntry = priceBook.devices.find((entry) => entry.deviceSlug === device.slug);
    if (priceEntry) {
      total += priceEntry.capitalExpenditure;
    }
  }
  return total;
}

export function previewRoomDuplicate(inputs: DuplicateRoomInputs): RoomDuplicateResult {
  const { structure, room, copies, priceBook } = inputs;
  const errors: string[] = [];

  if (!Number.isInteger(copies) || copies <= 0) {
    appendError(errors, "Copies must be a positive integer.");
  }

  const areaCapacity = assessCapacity({
    available: structure.capacity.areaFree_m2,
    required: room.area_m2 * copies,
    subject: "Room duplicate",
    container: "Structure",
    unit: "m²"
  });
  if (areaCapacity.status === "block") {
    appendError(
      errors,
      areaCapacity.message ?? "Structure does not have enough free area for the duplicates."
    );
  }

  const volumeCapacity = assessCapacity({
    available: structure.capacity.volumeFree_m3,
    required: room.volume_m3 * copies,
    subject: "Room duplicate",
    container: "Structure",
    unit: "m³"
  });
  if (volumeCapacity.status === "block") {
    appendError(
      errors,
      volumeCapacity.message ?? "Structure does not have enough free volume for the duplicates."
    );
  }

  const clonedPlantCount = 0;
  const zoneDeviceCost = room.zones.reduce(
    (accumulator, zone) => accumulator + sumDeviceCapex(zone, priceBook),
    0
  );
  const structureDeviceCost = room.devices.reduce((accumulator, device) => {
    const entry = priceBook.devices.find((item) => item.deviceSlug === device.slug);
    return entry ? accumulator + entry.capitalExpenditure : accumulator;
  }, 0);
  const deviceCapitalExpenditure = (zoneDeviceCost + structureDeviceCost) * copies;

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      payload: null,
      clonedPlantCount,
      deviceCapitalExpenditure,
      neutralOperatingCostPerHour: 0,
      capacity: { area: areaCapacity, volume: volumeCapacity }
    };
  }

  const payload: RoomDuplicateIntentPayload = {
    type: "room.duplicate",
    sourceRoomId: room.id,
    structureId: structure.id,
    copies
  };

  return {
    isValid: true,
    errors,
    payload,
    clonedPlantCount,
    deviceCapitalExpenditure,
    neutralOperatingCostPerHour: 0,
    capacity: { area: areaCapacity, volume: volumeCapacity }
  };
}

export function previewZoneDuplicate(inputs: DuplicateZoneInputs): ZoneDuplicateResult {
  const { structure, room, zone, copies, priceBook, compatibility } = inputs;
  const errors: string[] = [];

  if (!Number.isInteger(copies) || copies <= 0) {
    appendError(errors, "Copies must be a positive integer.");
  }

  const roomCapacity = assessCapacity({
    available: room.capacity.areaFree_m2,
    required: zone.area_m2 * copies,
    subject: "Zone duplicate",
    container: "Room",
    unit: "m²"
  });
  if (roomCapacity.status === "block") {
    appendError(errors, roomCapacity.message ?? "Room does not have enough free area for the duplicates.");
  }

  const duplicationCompatibility = assessCultivationIrrigation({
    compatibility,
    cultivationMethodId: zone.cultivationMethodId,
    irrigationMethodId: zone.irrigationMethodId
  });
  const cultivationStatus = duplicationCompatibility.cultivation.status;
  const irrigationStatus = duplicationCompatibility.irrigation.status;

  if (cultivationStatus === "block") {
    appendError(
      errors,
      duplicationCompatibility.cultivation.message ??
        "Zone cultivation method is no longer eligible for duplication."
    );
  }

  if (irrigationStatus === "block") {
    appendError(
      errors,
      duplicationCompatibility.irrigation.message ??
        "Zone irrigation method is no longer eligible for duplication."
    );
  }

  const clonedPlantCount = 0;
  const deviceCapitalExpenditure = sumDeviceCapex(zone, priceBook) * copies;

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      payload: null,
      clonedPlantCount,
      deviceCapitalExpenditure,
      neutralOperatingCostPerHour: 0,
      capacity: roomCapacity,
      cultivation: duplicationCompatibility.cultivation,
      irrigation: duplicationCompatibility.irrigation
    };
  }

  const payload: ZoneDuplicateIntentPayload = {
    type: "zone.duplicate",
    sourceZoneId: zone.id,
    roomId: room.id,
    structureId: structure.id,
    copies
  };

  return {
    isValid: true,
    errors,
    payload,
    clonedPlantCount,
    deviceCapitalExpenditure,
    neutralOperatingCostPerHour: 0,
    capacity: roomCapacity,
    cultivation: duplicationCompatibility.cultivation,
    irrigation: duplicationCompatibility.irrigation
  };
}

export function validateRoomAreaUpdate(inputs: RoomAreaUpdateInputs): RoomAreaUpdateResult {
  const { structure, room, nextArea_m2 } = inputs;
  const errors: string[] = [];

  if (!ensurePositive(nextArea_m2)) {
    appendError(errors, "Room area must be a positive number.");
  } else if (!isMultipleOfQuantum(nextArea_m2)) {
    appendError(errors, `Room area must align to ${String(AREA_QUANTUM_M2)} m² increments.`);
  }

  const areaCapacity = assessCapacity({
    available: structure.capacity.areaFree_m2 + room.area_m2,
    required: nextArea_m2,
    subject: "Room",
    container: "Structure",
    unit: "m²"
  });
  if (areaCapacity.status === "block") {
    appendError(
      errors,
      areaCapacity.message ?? "Structure does not have enough free area for the updated room size."
    );
  }

  const currentHeight = room.area_m2 > 0 ? room.volume_m3 / room.area_m2 : ROOM_DEFAULT_HEIGHT_M;
  const nextVolume_m3 = computeVolume(nextArea_m2, currentHeight);
  const volumeCapacity = assessCapacity({
    available: structure.capacity.volumeFree_m3 + room.volume_m3,
    required: nextVolume_m3,
    subject: "Room",
    container: "Structure",
    unit: "m³"
  });
  if (volumeCapacity.status === "block") {
    appendError(
      errors,
      volumeCapacity.message ?? "Structure does not have enough free volume for the updated room size."
    );
  }

  if (errors.length > 0) {
    return { isValid: false, errors, payload: null, nextVolume_m3, capacity: { area: areaCapacity, volume: volumeCapacity } };
  }

  const payload: RoomSetAreaIntentPayload = {
    type: "room.setArea",
    roomId: room.id,
    structureId: structure.id,
    area_m2: nextArea_m2
  };

  return { isValid: true, errors, payload, nextVolume_m3, capacity: { area: areaCapacity, volume: volumeCapacity } };
}

export function validateZoneAreaUpdate(inputs: ZoneAreaUpdateInputs): ZoneAreaUpdateResult {
  const { room, zone, nextArea_m2, areaPerPlant_m2 } = inputs;
  const errors: string[] = [];

  if (!ensurePositive(nextArea_m2)) {
    appendError(errors, "Zone area must be a positive number.");
  } else if (!isMultipleOfQuantum(nextArea_m2)) {
    appendError(errors, `Zone area must align to ${String(AREA_QUANTUM_M2)} m² increments.`);
  }

  const capacity = assessCapacity({
    available: room.capacity.areaFree_m2 + zone.area_m2,
    required: nextArea_m2,
    subject: "Zone",
    container: "Room",
    unit: "m²"
  });
  if (capacity.status === "block") {
    appendError(errors, capacity.message ?? "Room does not have enough free area for the updated zone size.");
  }

  const maxPlants = calculateMaxPlants(nextArea_m2, areaPerPlant_m2);
  if (maxPlants < zone.currentPlantCount) {
    appendError(errors, "Updated zone would not accommodate existing plants.");
  }

  if (errors.length > 0) {
    return { isValid: false, errors, payload: null, maxPlants, capacity };
  }

  const payload: ZoneSetAreaIntentPayload = {
    type: "zone.setArea",
    zoneId: zone.id,
    roomId: room.id,
    structureId: room.structureId,
    area_m2: nextArea_m2,
    maxPlants
  };

  return { isValid: true, errors, payload, maxPlants, capacity };
}
