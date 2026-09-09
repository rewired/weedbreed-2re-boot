/* eslint-disable wb-sim/no-ts-import-js-extension */

export {
  devicePurchaseInstallIntentSchema,
  parseFacilityIntent,
  roomCreateIntentSchema,
  zoneCreateIntentSchema,
  type DevicePurchaseInstallIntent,
  type FacilityIntent,
  type RoomCreateIntent,
  type ZoneCreateIntent,
} from './schemas.js';
export {
  createFacilityIntentHandler,
  type FacilityAck,
  type FacilityWorldAccess,
} from './handler.js';
