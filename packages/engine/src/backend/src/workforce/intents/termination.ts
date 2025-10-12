import type {
  Employee,
  WorkforceTerminationIntent,
  WorkforceTerminationTelemetryEvent,
} from '../../domain/world.ts';
import { clamp01 } from '../../util/math.ts';

/* eslint-disable @typescript-eslint/no-magic-numbers -- Termination ripple uses canonical morale delta */
const DEFAULT_MORALE_RIPPLE01 = -0.02 as const;
/* eslint-enable @typescript-eslint/no-magic-numbers */

export interface TerminationProcessingResult {
  readonly employees: ReadonlyMap<Employee['id'], Employee>;
  readonly terminatedIds: ReadonlySet<Employee['id']>;
  readonly telemetry: readonly WorkforceTerminationTelemetryEvent[];
}

export function processTerminationIntents({
  employees,
  intents,
  currentSimDay,
}: {
  readonly employees: ReadonlyMap<Employee['id'], Employee>;
  readonly intents: readonly WorkforceTerminationIntent[];
  readonly currentSimDay: number;
}): TerminationProcessingResult {
  const directory = new Map(employees);
  const terminated = new Set<Employee['id']>();
  const telemetry: WorkforceTerminationTelemetryEvent[] = [];

  for (const intent of intents) {
    const employee = directory.get(intent.employeeId);

    if (!employee) {
      continue;
    }

    directory.delete(employee.id);
    terminated.add(employee.id);

    telemetry.push({
      employeeId: employee.id,
      structureId: employee.assignedStructureId,
      simDay: currentSimDay,
      reasonSlug: intent.reasonSlug,
      severanceCc: intent.severanceCc,
    });

    const ripple = intent.moraleRipple01 ?? DEFAULT_MORALE_RIPPLE01;

    if (ripple === 0) {
      continue;
    }

    for (const [otherId, otherEmployee] of directory.entries()) {
      if (otherEmployee.assignedStructureId !== employee.assignedStructureId || otherId === employee.id) {
        continue;
      }

      const adjustedMorale = clamp01(otherEmployee.morale01 + ripple);

      if (adjustedMorale !== otherEmployee.morale01) {
        directory.set(otherId, { ...otherEmployee, morale01: adjustedMorale } satisfies Employee);
      }
    }
  }

  return { employees: directory, terminatedIds: terminated, telemetry };
}
