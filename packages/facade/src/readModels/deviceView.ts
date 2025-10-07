import type { DeviceInstance } from '@wb/engine';

/**
 * Public read-model contract representing a device enriched with UI-friendly metrics.
 */
export interface DeviceView extends DeviceInstance {
  /**
   * Device quality expressed as a percentage on the 0–100 scale for UI consumers.
   */
  readonly qualityPercent: number;

  /**
   * Device condition expressed as a percentage on the 0–100 scale for UI consumers.
   */
  readonly conditionPercent: number;
}

function normalisePercent(value01: number): number {
  return Math.round(value01 * 100);
}

/**
 * Projects a deterministic device instance onto the public read-model contract expected by UI layers.
 *
 * @param device - Canonical device instance emitted by the engine/domain layer.
 * @returns Device view including raw [0,1] fields and their rounded percentage counterparts.
 */
export function mapDeviceToView(device: DeviceInstance): DeviceView {
  const qualityPercent = normalisePercent(device.quality01);
  const conditionPercent = normalisePercent(device.condition01);

  return {
    ...device,
    qualityPercent,
    conditionPercent
  } satisfies DeviceView;
}
