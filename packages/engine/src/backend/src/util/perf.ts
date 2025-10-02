export interface PerfSample {
  readonly label: string;
  readonly startedAtNs: bigint;
  readonly durationNs: bigint;
  readonly heapUsedBeforeBytes: number;
  readonly heapUsedAfterBytes: number;
}

export interface PerfStageResult<T> {
  readonly result: T;
  readonly sample: PerfSample;
}

export function withPerfStage<T>(label: string, fn: () => T): PerfStageResult<T> {
  const startedAtNs = process.hrtime.bigint();
  const heapUsedBeforeBytes = process.memoryUsage().heapUsed;

  const result = fn();

  const endedAtNs = process.hrtime.bigint();
  const heapUsedAfterBytes = process.memoryUsage().heapUsed;

  return {
    result,
    sample: {
      label,
      startedAtNs,
      durationNs: endedAtNs - startedAtNs,
      heapUsedBeforeBytes,
      heapUsedAfterBytes
    }
  } satisfies PerfStageResult<T>;
}
