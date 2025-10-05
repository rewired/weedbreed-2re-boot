import { withPerfStage } from '../util/perf.js';

export type StepName =
  | 'applyDeviceEffects'
  | 'updateEnvironment'
  | 'applySensors'
  | 'applyIrrigationAndNutrients'
  | 'applyWorkforce'
  | 'advancePhysiology'
  | 'applyHarvestAndInventory'
  | 'applyEconomyAccrual'
  | 'commitAndTelemetry';

export interface TraceStep {
  readonly name: StepName;
  readonly startedAtNs: number;
  readonly durationNs: number;
  readonly endedAtNs: number;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
  readonly heapUsedDeltaBytes: number;
}

export interface TickTrace {
  readonly startedAtNs: number;
  readonly endedAtNs: number;
  readonly durationNs: number;
  readonly steps: readonly TraceStep[];
  readonly totalHeapUsedDeltaBytes: number;
  readonly maxHeapUsedBytes: number;
}

interface TraceCollector {
  readonly measureStage: <T>(name: StepName, fn: () => T) => T;
  readonly finalize: () => TickTrace;
}

export function createTickTraceCollector(): TraceCollector {
  const tickStartTime = process.hrtime.bigint();
  const tickStartHeap = process.memoryUsage().heapUsed;
  const steps: TraceStep[] = [];
  let tickEndTime = tickStartTime;
  let maxHeapUsedBytes = tickStartHeap;
  let totalHeapDeltaSum = 0;

  return {
    measureStage(name, fn) {
      const { sample, result } = withPerfStage(name, fn);
      const startedAtOffset = Number(sample.startedAtNs - tickStartTime);
      const durationNs = Number(sample.durationNs);
      const endedAtOffset = startedAtOffset + durationNs;
      const heapDelta = sample.heapUsedAfterBytes - sample.heapUsedBeforeBytes;
      totalHeapDeltaSum += heapDelta;

      if (sample.heapUsedAfterBytes > maxHeapUsedBytes) {
        maxHeapUsedBytes = sample.heapUsedAfterBytes;
      }

      tickEndTime = sample.startedAtNs + sample.durationNs;
      steps.push({
        name,
        startedAtNs: startedAtOffset,
        durationNs,
        endedAtNs: endedAtOffset,
        heapUsedBeforeBytes: sample.heapUsedBeforeBytes,
        heapUsedAfterBytes: sample.heapUsedAfterBytes,
        heapUsedDeltaBytes: heapDelta
      });

      return result;
    },
    finalize() {
      const durationNs = Number(tickEndTime - tickStartTime);

      return {
        startedAtNs: 0,
        endedAtNs: durationNs,
        durationNs,
        steps: steps.slice(),
        totalHeapUsedDeltaBytes: totalHeapDeltaSum,
        maxHeapUsedBytes
      } satisfies TickTrace;
    }
  } satisfies TraceCollector;
}
