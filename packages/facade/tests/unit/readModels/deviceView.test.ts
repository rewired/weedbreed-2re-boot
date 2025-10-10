import { describe, expect, it } from 'vitest';
import { uuidSchema, type DeviceInstance } from '@wb/engine';
import { mapDeviceToView } from '../../../src/readModels/deviceView.ts';

function createDevice(overrides: Partial<DeviceInstance> = {}): DeviceInstance {
  const base: DeviceInstance = {
    id: uuidSchema.parse('00000000-0000-0000-0000-000000000001'),
    slug: 'test-device',
    name: 'Test Device',
    blueprintId: uuidSchema.parse('00000000-0000-0000-0000-000000000010'),
    placementScope: 'zone',
    quality01: 0.5,
    condition01: 0.5,
    powerDraw_W: 1200,
    dutyCycle01: 0.75,
    efficiency01: 0.65,
    coverage_m2: 12,
    airflow_m3_per_h: 0,
    sensibleHeatRemovalCapacity_W: 0
  };

  return { ...base, ...overrides };
}

describe('mapDeviceToView', () => {
  it('forwards the canonical device fields while appending percentage metrics', () => {
    const device = createDevice({ quality01: 0.81, condition01: 0.64 });

    const view = mapDeviceToView(device);

    expect(view).not.toBe(device);
    expect(view.quality01).toBe(device.quality01);
    expect(view.condition01).toBe(device.condition01);
    expect(view.qualityPercent).toBe(81);
    expect(view.conditionPercent).toBe(64);
  });

  it('rounds percentage metrics to the nearest integer', () => {
    const device = createDevice({ quality01: 0.834, condition01: 0.995 });

    const view = mapDeviceToView(device);

    expect(view.qualityPercent).toBe(83);
    expect(view.conditionPercent).toBe(100);
  });
});
