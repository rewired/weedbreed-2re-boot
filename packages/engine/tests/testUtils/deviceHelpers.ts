import type { DeviceBlueprint } from '@/backend/src/domain/blueprints/deviceBlueprint.js';
import {
  createDeviceInstance,
  type DeviceQualityPolicy,
  type Uuid
} from '@/backend/src/domain/world.js';

export function deviceQuality(
  qualityPolicy: DeviceQualityPolicy,
  seed: string,
  id: Uuid,
  blueprint: DeviceBlueprint
): number {
  return createDeviceInstance(qualityPolicy, seed, id, blueprint).quality01;
}
