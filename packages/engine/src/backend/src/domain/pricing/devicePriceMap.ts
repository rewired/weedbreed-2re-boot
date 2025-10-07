import { z } from 'zod';

const uuidString = z.string().uuid('Device price map keys must be UUID v4 identifiers.');
const nonNegativeNumber = z
  .number({ invalid_type_error: 'Price values must be numbers.' })
  .finite('Price values must be finite numbers.')
  .min(0, 'Price values must be non-negative.');

const devicePriceEntrySchema = z
  .object({
    capitalExpenditure: nonNegativeNumber,
    baseMaintenanceCostPerHour: nonNegativeNumber,
    costIncreasePer1000Hours: nonNegativeNumber,
    maintenanceServiceCost: nonNegativeNumber
  })
  .strict();

export const devicePriceMapSchema = z
  .object({
    devicePrices: z.record(uuidString, devicePriceEntrySchema)
  })
  .strict();

export type DevicePriceEntry = z.infer<typeof devicePriceEntrySchema>;
export type DevicePriceMap = z.infer<typeof devicePriceMapSchema>;

export function parseDevicePriceMap(input: unknown): DevicePriceMap {
  return devicePriceMapSchema.parse(input);
}
