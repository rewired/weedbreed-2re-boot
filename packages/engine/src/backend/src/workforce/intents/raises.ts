import type {
  Employee,
  WorkforceRaiseIntent,
  WorkforceRaiseTelemetryEvent,
} from '../../domain/world.ts';
import { applyRaiseIntent } from '../../services/workforce/raises.ts';

export interface RaiseProcessingResult {
  readonly employees: ReadonlyMap<Employee['id'], Employee>;
  readonly telemetry: readonly WorkforceRaiseTelemetryEvent[];
}

export function processRaiseIntents({
  employees,
  intents,
  currentSimDay,
}: {
  readonly employees: ReadonlyMap<Employee['id'], Employee>;
  readonly intents: readonly WorkforceRaiseIntent[];
  readonly currentSimDay: number;
}): RaiseProcessingResult {
  const directory = new Map(employees);
  const telemetry: WorkforceRaiseTelemetryEvent[] = [];

  for (const intent of intents) {
    const employee = directory.get(intent.employeeId);

    if (!employee) {
      continue;
    }

    const outcome = applyRaiseIntent({ employee, intent, currentSimDay });

    if (!outcome) {
      continue;
    }

    directory.set(employee.id, outcome.employee);
    telemetry.push({
      action: outcome.action,
      employeeId: employee.id,
      structureId: employee.assignedStructureId,
      simDay: currentSimDay,
      rateIncreaseFactor: outcome.rateIncreaseFactor,
      moraleDelta01: outcome.moraleDelta01,
      salaryExpectation_per_h: outcome.employee.salaryExpectation_per_h,
      bonusAmount_cc: outcome.bonusAmount_cc,
    });
  }

  return { employees: directory, telemetry };
}

