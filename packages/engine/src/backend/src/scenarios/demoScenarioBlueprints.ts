import basicSoilPotJson from '../../../../../../data/blueprints/cultivation-method/basic-soil-pot.json' with { type: 'json' };
import pot10LJson from '../../../../../../data/blueprints/container/pot-10l.json' with { type: 'json' };
import manualWateringJson from '../../../../../../data/blueprints/irrigation/manual-watering-can.json' with { type: 'json' };
import laboratoryJson from '../../../../../../data/blueprints/room/purpose/laboratory.json' with { type: 'json' };
import growroomJson from '../../../../../../data/blueprints/room/purpose/growroom.json' with { type: 'json' };
import storageJson from '../../../../../../data/blueprints/room/purpose/storage.json' with { type: 'json' };
import shedJson from '../../../../../../data/blueprints/structure/shed.json' with { type: 'json' };
import cocoCoirJson from '../../../../../../data/blueprints/substrate/coco-coir.json' with { type: 'json' };
import soilMultiCycleJson from '../../../../../../data/blueprints/substrate/soil-multi-cycle.json' with { type: 'json' };
import soilSingleCycleJson from '../../../../../../data/blueprints/substrate/soil-single-cycle.json' with { type: 'json' };

import {
  parseContainerBlueprint,
  type ContainerBlueprint,
} from '../domain/blueprints/containerBlueprint.ts';
import {
  parseCultivationMethodBlueprint,
  type CultivationMethodBlueprint,
} from '../domain/blueprints/cultivationMethodBlueprint.ts';
import {
  parseIrrigationBlueprint,
  type IrrigationBlueprint,
} from '../domain/blueprints/irrigationBlueprint.ts';
import {
  parseRoomPurposeBlueprint,
  type RoomPurposeBlueprint,
} from '../domain/blueprints/roomBlueprint.ts';
import {
  parseStructureBlueprint,
  type StructureBlueprint,
} from '../domain/blueprints/structureBlueprint.ts';
import {
  parseSubstrateBlueprint,
  type SubstrateBlueprint,
} from '../domain/blueprints/substrateBlueprint.ts';

export interface DemoScenarioBlueprints {
  readonly structure: StructureBlueprint;
  readonly growroom: RoomPurposeBlueprint;
  readonly storageRoom: RoomPurposeBlueprint;
  readonly laboratory: RoomPurposeBlueprint;
  readonly cultivationMethod: CultivationMethodBlueprint;
  readonly container: ContainerBlueprint;
  readonly substrate: SubstrateBlueprint;
  readonly irrigation: IrrigationBlueprint;
}

/**
 * Loads and validates the existing blueprint records used by the canonical demo start.
 * The loader is read-only and never writes derived state back into `/data`.
 */
export function loadDemoScenarioBlueprints(): DemoScenarioBlueprints {
  const substrates = [cocoCoirJson, soilMultiCycleJson, soilSingleCycleJson]
    .map((input) => parseSubstrateBlueprint(input));
  const substrateSlugs = substrates.map((blueprint) => blueprint.slug);
  const substrate = substrates.find((blueprint) => blueprint.slug === 'soil-single-cycle');

  if (!substrate) {
    throw new Error('Demo scenario requires the soil-single-cycle substrate blueprint.');
  }

  const cultivationMethod = parseCultivationMethodBlueprint(basicSoilPotJson);
  const container = parseContainerBlueprint(pot10LJson);
  const irrigation = parseIrrigationBlueprint(manualWateringJson, {
    knownSubstrateSlugs: substrateSlugs,
  });

  if (!cultivationMethod.containers.includes(container.slug)) {
    throw new Error('Demo cultivation method is incompatible with the selected container.');
  }

  if (!cultivationMethod.substrates.includes(substrate.slug)) {
    throw new Error('Demo cultivation method is incompatible with the selected substrate.');
  }

  if (!irrigation.compatibility.substrates.includes(substrate.slug)) {
    throw new Error('Demo irrigation method is incompatible with the selected substrate.');
  }

  return {
    structure: parseStructureBlueprint(shedJson),
    growroom: parseRoomPurposeBlueprint(growroomJson),
    storageRoom: parseRoomPurposeBlueprint(storageJson),
    laboratory: parseRoomPurposeBlueprint(laboratoryJson),
    cultivationMethod,
    container,
    substrate,
    irrigation,
  } satisfies DemoScenarioBlueprints;
}
