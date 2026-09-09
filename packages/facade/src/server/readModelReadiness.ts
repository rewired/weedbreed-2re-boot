/* eslint-disable wb-sim/no-ts-import-js-extension */

import type { Zone } from '@wb/engine';
import type { ZoneReadiness, ZoneMissingPrerequisite } from '../readModels/snapshot.js';
import {
  computeZoneCoverageMetrics,
  resolveContainer,
  resolveCultivationMethod,
  resolveIrrigation,
  resolveSubstrate,
  ZONE_ACH_TARGET,
} from './readModelShared.js';

function hasCompatibleCultivationConfiguration(zone: Zone): boolean {
  const cultivation = resolveCultivationMethod(zone.cultivationMethodId);
  const container = resolveContainer(zone.containerId);
  const substrate = resolveSubstrate(zone.substrateId);
  const irrigation = resolveIrrigation(zone.irrigationMethodId);

  if (!cultivation || !container || !substrate || !irrigation) {
    return false;
  }

  return (
    cultivation.containers.includes(container.slug) &&
    cultivation.substrates.includes(substrate.slug) &&
    irrigation.compatibility.substrates.includes(substrate.slug)
  );
}

/** Projects authoritative zone configuration and device capacity into wizard readiness. */
export function mapZoneReadiness(zone: Zone): ZoneReadiness {
  const missing: ZoneMissingPrerequisite[] = [];
  const cultivation = resolveCultivationMethod(zone.cultivationMethodId);
  const container = resolveContainer(zone.containerId);
  const substrate = resolveSubstrate(zone.substrateId);
  const irrigation = resolveIrrigation(zone.irrigationMethodId);

  if (!cultivation) missing.push('cultivation-method');
  if (!container) missing.push('container');
  if (!substrate) missing.push('substrate');
  if (!irrigation) missing.push('irrigation');

  if (cultivation && container && substrate && irrigation && !hasCompatibleCultivationConfiguration(zone)) {
    missing.push('cultivation-compatibility');
  }

  const coverage = computeZoneCoverageMetrics(zone);
  if (coverage.lightingCoverage01 < 1) missing.push('lighting-coverage');
  if (coverage.hvacCapacity01 < 1) missing.push('climate-control');
  if (coverage.airflowAch < ZONE_ACH_TARGET) missing.push('airflow');

  return {
    status: missing.length === 0 ? 'ready' : 'missing-prerequisites',
    missingPrerequisites: missing,
  };
}
