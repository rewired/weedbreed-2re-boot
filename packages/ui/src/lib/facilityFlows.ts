import {
  AREA_QUANTUM_M2,
  ROOM_DEFAULT_HEIGHT_M
} from "@engine/constants/simConstants.ts";
import type {
  CompatibilityMaps,
  CompatibilityStatus,
  ContainerPriceEntry,
  IrrigationLinePriceEntry,
  PriceBookCatalog,
  RoomReadModel,
  SeedlingPriceEntry,
  StructureReadModel,
  SubstratePriceEntry,
  ZoneReadModel
} from "@ui/state/readModels.types";

const EPSILON = 1e-6;

export type RoomCreateIntentPayload = Readonly<{
  type: "room.create";
  structureId: string;
  name: string;
  purpose: string;
  area_m2: number;
  height_m: number;
}>;

export interface RoomCreateInput {
  readonly structure: StructureReadModel;
  readonly name: string;
  readonly purpose: string;
  readonly area_m2: number;
  readonly height_m?: number | null;
}

export interface ValidationResult<TPayload> {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly payload: TPayload | null;
}

export interface ZoneWizardInputs {
  readonly room: RoomReadModel;
  readonly area_m2: number;
  readonly cultivationMethodId: string;
  readonly areaPerPlant_m2: number;
  readonly irrigationMethodId: string;
  readonly seedlingPrice: SeedlingPriceEntry | null;
  readonly containerPrice: ContainerPriceEntry | null;
  readonly substratePrice: SubstratePriceEntry | null;
  readonly irrigationLinePrice: IrrigationLinePriceEntry | null;
  readonly compatibility: CompatibilityMaps;
}

export type ZoneCreateIntentPayload = Readonly<{
  type: "zone.create";
  structureId: string;
  roomId: string;
  area_m2: number;
  cultivationMethodId: string;
  irrigationMethodId: string;
  maxPlants: number;
}>;

export interface ZoneWizardResult extends ValidationResult<ZoneCreateIntentPayload> {
  readonly cultivationStatus: CompatibilityStatus;
  readonly irrigationStatus: CompatibilityStatus;
  readonly maxPlants: number;
  readonly acquisitionCost: number;
}

export interface SowingInputs {
  readonly zone: ZoneReadModel;
  readonly strainId: string;
  readonly count: number;
  readonly compatibility: CompatibilityMaps;
  readonly seedlingPrice: SeedlingPriceEntry | null;
}

export type SowingIntentPayload = Readonly<{
  type: "plants.sow";
  zoneId: string;
  strainId: string;
  count: number;
}>;

export interface SowingResult extends ValidationResult<SowingIntentPayload> {
  readonly cultivationStatus: CompatibilityStatus;
  readonly irrigationStatus: CompatibilityStatus;
  readonly totalCost: number;
}

export interface DuplicateRoomInputs {
  readonly structure: StructureReadModel;
  readonly room: RoomReadModel;
  readonly copies: number;
  readonly priceBook: PriceBookCatalog;
}

export type RoomDuplicateIntentPayload = Readonly<{
  type: "room.duplicate";
  sourceRoomId: string;
  structureId: string;
  copies: number;
}>;

export interface RoomDuplicateResult extends ValidationResult<RoomDuplicateIntentPayload> {
  readonly clonedPlantCount: number;
  readonly deviceCapitalExpenditure: number;
  readonly neutralOperatingCostPerHour: number;
}

export interface DuplicateZoneInputs {
  readonly structure: StructureReadModel;
  readonly room: RoomReadModel;
  readonly zone: ZoneReadModel;
  readonly copies: number;
  readonly priceBook: PriceBookCatalog;
  readonly compatibility: CompatibilityMaps;
}

export type ZoneDuplicateIntentPayload = Readonly<{
  type: "zone.duplicate";
  sourceZoneId: string;
  roomId: string;
  structureId: string;
  copies: number;
}>;

export interface ZoneDuplicateResult extends ValidationResult<ZoneDuplicateIntentPayload> {
  readonly clonedPlantCount: number;
  readonly deviceCapitalExpenditure: number;
  readonly neutralOperatingCostPerHour: number;
}

export interface RoomAreaUpdateInputs {
  readonly structure: StructureReadModel;
  readonly room: RoomReadModel;
  readonly nextArea_m2: number;
}

export type RoomSetAreaIntentPayload = Readonly<{
  type: "room.setArea";
  roomId: string;
  structureId: string;
  area_m2: number;
}>;

export interface RoomAreaUpdateResult extends ValidationResult<RoomSetAreaIntentPayload> {
  readonly nextVolume_m3: number;
}

export interface ZoneAreaUpdateInputs {
  readonly room: RoomReadModel;
  readonly zone: ZoneReadModel;
  readonly nextArea_m2: number;
  readonly areaPerPlant_m2: number;
}

export type ZoneSetAreaIntentPayload = Readonly<{
  type: "zone.setArea";
  zoneId: string;
  roomId: string;
  structureId: string;
  area_m2: number;
  maxPlants: number;
}>;

export interface ZoneAreaUpdateResult extends ValidationResult<ZoneSetAreaIntentPayload> {
  readonly maxPlants: number;
}

function ensurePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isMultipleOfQuantum(area_m2: number): boolean {
  const quantised = Math.round(area_m2 / AREA_QUANTUM_M2) * AREA_QUANTUM_M2;
  return Math.abs(quantised - area_m2) < EPSILON;
}

function normaliseHeight(height_m?: number | null): number {
  if (!Number.isFinite(height_m ?? Number.NaN)) {
    return ROOM_DEFAULT_HEIGHT_M;
  }

  const parsed = Number(height_m);
  return parsed > 0 ? parsed : ROOM_DEFAULT_HEIGHT_M;
}

function computeVolume(area_m2: number, height_m: number): number {
  return area_m2 * height_m;
}

function appendError(errors: string[], message: string): void {
  if (!errors.includes(message)) {
    errors.push(message);
  }
}

export function validateRoomCreate(input: RoomCreateInput): ValidationResult<RoomCreateIntentPayload> {
  const errors: string[] = [];

  if (!ensurePositive(input.area_m2)) {
    appendError(errors, "Room area must be a positive number.");
  } else if (!isMultipleOfQuantum(input.area_m2)) {
    appendError(errors, `Room area must align to ${String(AREA_QUANTUM_M2)} m² increments.`);
  }

  const height_m = normaliseHeight(input.height_m);
  const volume_m3 = computeVolume(input.area_m2, height_m);

  const { structure } = input;
  const freeArea = structure.capacity.areaFree_m2;
  const freeVolume = structure.capacity.volumeFree_m3;

  if (input.area_m2 - freeArea > EPSILON) {
    appendError(errors, "Structure does not have enough free area for the new room.");
  }

  if (volume_m3 - freeVolume > EPSILON) {
    appendError(errors, "Structure does not have enough free volume for the new room.");
  }

  if (input.name.trim().length === 0) {
    appendError(errors, "Room name is required.");
  }

  if (input.purpose.trim().length === 0) {
    appendError(errors, "Room purpose is required.");
  }

  if (errors.length > 0) {
    return { isValid: false, errors, payload: null };
  }

  const payload: RoomCreateIntentPayload = {
    type: "room.create",
    structureId: structure.id,
    name: input.name.trim(),
    purpose: input.purpose,
    area_m2: input.area_m2,
    height_m
  };

  return { isValid: true, errors, payload };
}

function getCompatibilityStatus(
  record: Readonly<Record<string, CompatibilityStatus>> | undefined,
  key: string
): CompatibilityStatus {
  if (!record) {
    return "block";
  }

  return record[key] ?? "block";
}

function calculateMaxPlants(area_m2: number, areaPerPlant_m2: number): number {
  if (!ensurePositive(area_m2) || !ensurePositive(areaPerPlant_m2)) {
    return 0;
  }

  return Math.max(0, Math.floor(area_m2 / areaPerPlant_m2));
}

function calculateZoneAcquisitionCost(
  maxPlants: number,
  area_m2: number,
  seedlingPrice: SeedlingPriceEntry | null,
  containerPrice: ContainerPriceEntry | null,
  substratePrice: SubstratePriceEntry | null,
  irrigationLinePrice: IrrigationLinePriceEntry | null
): number {
  const plantCost = seedlingPrice ? seedlingPrice.pricePerUnit * maxPlants : 0;
  const containerCost = containerPrice ? containerPrice.pricePerUnit * maxPlants : 0;
  const substrateCost =
    containerPrice && substratePrice
      ? containerPrice.capacityLiters * substratePrice.unitPrice_per_L * maxPlants
      : 0;
  const irrigationCost = irrigationLinePrice ? irrigationLinePrice.pricePerSquareMeter * area_m2 : 0;

  return plantCost + containerCost + substrateCost + irrigationCost;
}

export function deriveZoneWizardResult(inputs: ZoneWizardInputs): ZoneWizardResult {
  const {
    room,
    area_m2,
    cultivationMethodId,
    areaPerPlant_m2,
    irrigationMethodId,
    seedlingPrice,
    containerPrice,
    substratePrice,
    irrigationLinePrice,
    compatibility
  } = inputs;

  const errors: string[] = [];

  if (!ensurePositive(area_m2)) {
    appendError(errors, "Zone area must be a positive number.");
  } else if (!isMultipleOfQuantum(area_m2)) {
    appendError(errors, `Zone area must align to ${String(AREA_QUANTUM_M2)} m² increments.`);
  }

  const availableRoomArea = room.capacity.areaFree_m2;
  if (area_m2 - availableRoomArea > EPSILON) {
    appendError(errors, "Room does not have enough free area for the zone.");
  }

  const irrigationMap = Object.hasOwn(compatibility.cultivationToIrrigation, cultivationMethodId)
    ? compatibility.cultivationToIrrigation[cultivationMethodId]
    : undefined;
  const cultivationStatus = (() => {
    if (!irrigationMap) {
      return "block" as const;
    }

    const statuses = Object.values(irrigationMap);
    if (statuses.includes("ok")) {
      return "ok" as const;
    }

    if (statuses.includes("warn")) {
      return "warn" as const;
    }

    return "block" as const;
  })();
  const irrigationStatus = getCompatibilityStatus(irrigationMap, irrigationMethodId);

  if (irrigationStatus === "block") {
    appendError(errors, "Irrigation method is incompatible with the selected cultivation method.");
  }

  const maxPlants = calculateMaxPlants(area_m2, areaPerPlant_m2);
  const acquisitionCost = calculateZoneAcquisitionCost(
    maxPlants,
    area_m2,
    seedlingPrice,
    containerPrice,
    substratePrice,
    irrigationLinePrice
  );

  if (maxPlants <= 0) {
    appendError(errors, "Zone must support at least one plant.");
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      payload: null,
      cultivationStatus,
      irrigationStatus,
      maxPlants,
      acquisitionCost
    };
  }

  const payload: ZoneCreateIntentPayload = {
    type: "zone.create",
    structureId: room.structureId,
    roomId: room.id,
    area_m2,
    cultivationMethodId,
    irrigationMethodId,
    maxPlants
  };

  return {
    isValid: true,
    errors,
    payload,
    cultivationStatus,
    irrigationStatus,
    maxPlants,
    acquisitionCost
  };
}

function findSeedlingPrice(
  priceBook: PriceBookCatalog,
  strainId: string
): SeedlingPriceEntry | null {
  return priceBook.seedlings.find((entry) => entry.strainId === strainId) ?? null;
}

export function validateSowing(inputs: SowingInputs): SowingResult {
  const { zone, strainId, count, compatibility, seedlingPrice } = inputs;
  const errors: string[] = [];

  if (zone.currentPlantCount > 0) {
    appendError(errors, "Zone must be empty before sowing new plants.");
  }

  if (!Number.isInteger(count) || count <= 0) {
    appendError(errors, "Plant count must be a positive integer.");
  }

  if (count - zone.maxPlants > EPSILON) {
    appendError(errors, "Plant count exceeds zone capacity.");
  }

  const strainEntry = Object.hasOwn(compatibility.strainToCultivation, strainId)
    ? compatibility.strainToCultivation[strainId]
    : undefined;
  const cultivationStatus = getCompatibilityStatus(strainEntry?.cultivation, zone.cultivationMethodId);
  const irrigationStatus = getCompatibilityStatus(strainEntry?.irrigation, zone.irrigationMethodId);

  if (cultivationStatus === "block") {
    appendError(errors, "Selected strain is incompatible with the zone's cultivation method.");
  }

  if (irrigationStatus === "block") {
    appendError(errors, "Selected strain is incompatible with the zone's irrigation method.");
  }

  const totalCost = seedlingPrice ? seedlingPrice.pricePerUnit * count : 0;

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      payload: null,
      cultivationStatus,
      irrigationStatus,
      totalCost
    };
  }

  const payload: SowingIntentPayload = {
    type: "plants.sow",
    zoneId: zone.id,
    strainId,
    count
  };

  return {
    isValid: true,
    errors,
    payload,
    cultivationStatus,
    irrigationStatus,
    totalCost
  };
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

  const availableArea = structure.capacity.areaFree_m2;
  const requiredArea = room.area_m2 * copies;
  if (requiredArea - availableArea > EPSILON) {
    appendError(errors, "Structure does not have enough free area for the duplicates.");
  }

  const availableVolume = structure.capacity.volumeFree_m3;
  const requiredVolume = room.volume_m3 * copies;
  if (requiredVolume - availableVolume > EPSILON) {
    appendError(errors, "Structure does not have enough free volume for the duplicates.");
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
      neutralOperatingCostPerHour: 0
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
    neutralOperatingCostPerHour: 0
  };
}

export function previewZoneDuplicate(inputs: DuplicateZoneInputs): ZoneDuplicateResult {
  const { structure, room, zone, copies, priceBook, compatibility } = inputs;
  const errors: string[] = [];

  if (!Number.isInteger(copies) || copies <= 0) {
    appendError(errors, "Copies must be a positive integer.");
  }

  const availableArea = room.capacity.areaFree_m2;
  const requiredArea = zone.area_m2 * copies;
  if (requiredArea - availableArea > EPSILON) {
    appendError(errors, "Room does not have enough free area for the duplicates.");
  }

  const strainCompatibility = Object.hasOwn(compatibility.strainToCultivation, zone.strainId)
    ? compatibility.strainToCultivation[zone.strainId]
    : undefined;
  const cultivationStatus = getCompatibilityStatus(
    strainCompatibility?.cultivation,
    zone.cultivationMethodId
  );
  const zoneIrrigationMap = Object.hasOwn(compatibility.cultivationToIrrigation, zone.cultivationMethodId)
    ? compatibility.cultivationToIrrigation[zone.cultivationMethodId]
    : undefined;
  const irrigationStatus = getCompatibilityStatus(zoneIrrigationMap, zone.irrigationMethodId);

  if (cultivationStatus === "block") {
    appendError(errors, "Zone cultivation method is no longer eligible for duplication.");
  }

  if (irrigationStatus === "block") {
    appendError(errors, "Zone irrigation method is no longer eligible for duplication.");
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
      neutralOperatingCostPerHour: 0
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
    neutralOperatingCostPerHour: 0
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

  const availableArea = structure.capacity.areaFree_m2 + room.area_m2;
  if (nextArea_m2 - availableArea > EPSILON) {
    appendError(errors, "Structure does not have enough free area for the updated room size.");
  }

  const currentHeight = room.area_m2 > 0 ? room.volume_m3 / room.area_m2 : ROOM_DEFAULT_HEIGHT_M;
  const nextVolume_m3 = computeVolume(nextArea_m2, currentHeight);
  const availableVolume = structure.capacity.volumeFree_m3 + room.volume_m3;
  if (nextVolume_m3 - availableVolume > EPSILON) {
    appendError(errors, "Structure does not have enough free volume for the updated room size.");
  }

  if (errors.length > 0) {
    return { isValid: false, errors, payload: null, nextVolume_m3 };
  }

  const payload: RoomSetAreaIntentPayload = {
    type: "room.setArea",
    roomId: room.id,
    structureId: structure.id,
    area_m2: nextArea_m2
  };

  return { isValid: true, errors, payload, nextVolume_m3 };
}

export function validateZoneAreaUpdate(inputs: ZoneAreaUpdateInputs): ZoneAreaUpdateResult {
  const { room, zone, nextArea_m2, areaPerPlant_m2 } = inputs;
  const errors: string[] = [];

  if (!ensurePositive(nextArea_m2)) {
    appendError(errors, "Zone area must be a positive number.");
  } else if (!isMultipleOfQuantum(nextArea_m2)) {
    appendError(errors, `Zone area must align to ${String(AREA_QUANTUM_M2)} m² increments.`);
  }

  const availableArea = room.capacity.areaFree_m2 + zone.area_m2;
  if (nextArea_m2 - availableArea > EPSILON) {
    appendError(errors, "Room does not have enough free area for the updated zone size.");
  }

  const maxPlants = calculateMaxPlants(nextArea_m2, areaPerPlant_m2);
  if (maxPlants < zone.currentPlantCount) {
    appendError(errors, "Updated zone would not accommodate existing plants.");
  }

  if (errors.length > 0) {
    return { isValid: false, errors, payload: null, maxPlants };
  }

  const payload: ZoneSetAreaIntentPayload = {
    type: "zone.setArea",
    zoneId: zone.id,
    roomId: room.id,
    structureId: room.structureId,
    area_m2: nextArea_m2,
    maxPlants
  };

  return { isValid: true, errors, payload, maxPlants };
}

export function findSeedlingPriceForStrain(
  priceBook: PriceBookCatalog,
  strainId: string
): SeedlingPriceEntry | null {
  return findSeedlingPrice(priceBook, strainId);
}

