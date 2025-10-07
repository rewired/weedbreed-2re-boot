import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import {
  createMonitorRuntime,
  type MonitorUi,
  type MonitorViewModel,
  type TelemetryClient,
  type TelemetryClientEventMap,
  type TelemetryMessage,
} from '../../src/runtime.js';

class StubTelemetryClient
  extends EventEmitter<TelemetryClientEventMap>
  implements TelemetryClient
{
  connect(): void {
    this.emit('connect');
  }

  disconnect(): Promise<void> {
    this.emit('disconnect');
    return Promise.resolve();
  }

  override on<E extends keyof TelemetryClientEventMap>(
    event: E,
    handler: TelemetryClientEventMap[E]
  ): this {
    return super.on(event, handler);
  }

  override off<E extends keyof TelemetryClientEventMap>(
    event: E,
    handler: TelemetryClientEventMap[E]
  ): this {
    return super.off(event, handler);
  }

  emitTelemetry(message: TelemetryMessage): void {
    this.emit('event', message);
  }

  emitTelemetryError(error: unknown): void {
    this.emit('error', error);
  }
}

class StubMonitorUi implements MonitorUi {
  readonly renders: MonitorViewModel[] = [];
  initializeCalls = 0;
  destroyCalls = 0;

  initialize(): void {
    this.initializeCalls += 1;
  }

  render(view: MonitorViewModel): void {
    this.renders.push(view);
  }

  destroy(): void {
    this.destroyCalls += 1;
  }

  get lastView(): MonitorViewModel | undefined {
    return this.renders.at(-1);
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const start = Date.now();

  return new Promise<void>((resolve, reject) => {
    const check = () => {
      if (predicate()) {
        resolve();
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        reject(new Error('Timed out waiting for condition.'));
        return;
      }

      setTimeout(check, 10);
    };

    check();
  });
}

describe('createMonitorRuntime', () => {
  it('projects workforce telemetry into the view model', async () => {
    const client = new StubTelemetryClient();
    const ui = new StubMonitorUi();
    const runtime = createMonitorRuntime({
      telemetryClient: client,
      ui,
      targetUrl: 'http://example.test/telemetry',
      refreshIntervalMs: 20,
    });

    runtime.start();

    expect(ui.initializeCalls).toBe(1);

    client.connect();

    await waitFor(() => ui.lastView?.connection === 'connected');

    client.emitTelemetry({
      topic: 'telemetry.workforce.kpi.v1',
      payload: {
        snapshot: {
          simTimeHours: 12,
          tasksCompleted: 3,
          queueDepth: 4,
          laborHoursCommitted: 6,
          overtimeHoursCommitted: 1,
          overtimeMinutes: 45,
          utilization01: 0.75,
          p95WaitTimeHours: 2.5,
          maintenanceBacklog: 2,
          averageMorale01: 0.8,
          averageFatigue01: 0.2,
        },
      },
    });

    await waitFor(() => ui.lastView?.workforce.queueDepth === 4);

    const view = ui.lastView;
    expect(view).toBeDefined();
    expect(view?.workforce.utilizationPercent).toBeCloseTo(75, 5);
    expect(view?.workforce.moralePercent).toBeCloseTo(80, 5);
    expect(view?.events.at(-1)?.topic).toBe('telemetry.workforce.kpi.v1');

    await runtime.stop();
    expect(ui.destroyCalls).toBe(1);
  });

  it('records schema errors when telemetry payloads are malformed', async () => {
    const client = new StubTelemetryClient();
    const ui = new StubMonitorUi();
    const runtime = createMonitorRuntime({
      telemetryClient: client,
      ui,
      targetUrl: 'http://example.test/telemetry',
      refreshIntervalMs: 20,
    });

    runtime.start();
    client.connect();

    await waitFor(() => ui.lastView?.connection === 'connected');

    client.emitTelemetry({
      topic: 'telemetry.workforce.kpi.v1',
      payload: {},
    });

    await waitFor(() => (ui.lastView?.errors.length ?? 0) > 0);
    expect(ui.lastView?.errors.at(-1)).toMatch(/Failed to parse telemetry.workforce.kpi.v1/);

    await runtime.stop();
  });
});
