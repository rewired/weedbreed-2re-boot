/**
 * Represents a metric that the monitoring tools can display in the terminal dashboard.
 */
export interface MonitorMetric {
  /**
   * Unique metric identifier (slugified).
   */
  readonly id: string;

  /**
   * Human readable label for the metric.
   */
  readonly label: string;

  /**
   * Numerical value rendered in the dashboard.
   */
  readonly value: number;
}

/**
 * Creates a {@link MonitorMetric} ensuring that values are finite numbers.
 *
 * @param id - Unique identifier for the metric.
 * @param label - Display label for the metric.
 * @param value - Value associated with the metric.
 * @returns An immutable monitor metric instance.
 */
export function createMonitorMetric(id: string, label: string, value: number): MonitorMetric {
  if (!Number.isFinite(value)) {
    throw new Error('Monitor metric value must be a finite number');
  }

  return {
    id,
    label,
    value
  } satisfies MonitorMetric;
}
