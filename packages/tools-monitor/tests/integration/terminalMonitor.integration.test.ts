import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createMonitorRuntime,
  type MonitorRuntime,
  type MonitorUi,
  type MonitorViewModel,
} from '../../src/runtime.ts';
import { createSocketTelemetryClient } from '../../src/socketTelemetryClient.ts';
import {
  createSocketTransportAdapter,
  type SocketTransportAdapter,
  type TelemetryEvent,
} from '@wb/transport-sio';

interface TransportHarness {
  readonly port: number;
  readonly adapter: SocketTransportAdapter;
  close(): Promise<void>;
}

class StubMonitorUi implements MonitorUi {
  readonly renders: MonitorViewModel[] = [];
  initialize(): void {
    /* noop */
  }
  render(view: MonitorViewModel): void {
    this.renders.push(view);
  }
  destroy(): void {
    /* noop */
  }
  get lastView(): MonitorViewModel | undefined {
    return this.renders.at(-1);
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
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

      setTimeout(check, 20);
    };

    check();
  });
}

async function createTransportHarness(): Promise<TransportHarness> {
  const httpServer = createServer();

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });

  const address = httpServer.address() as AddressInfo | null;

  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind telemetry harness.');
  }

  const adapter = createSocketTransportAdapter({
    httpServer,
    onIntent: () => {
      /* noop */
    },
  });

  return {
    port: address.port,
    adapter,
    async close() {
      await adapter.close();
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          resolve();
        });
      });
    },
  } satisfies TransportHarness;
}

describe('terminal monitor integration', () => {
  let harness: TransportHarness | undefined;
  let runtime: MonitorRuntime | undefined;

  afterEach(async () => {
    if (runtime) {
      await runtime.stop();
      runtime = undefined;
    }

    if (harness) {
      await harness.close();
      harness = undefined;
    }
  });

  it('subscribes to telemetry without triggering write rejections', async () => {
    harness = await createTransportHarness();

    const telemetryUrl = `http://127.0.0.1:${String(harness.port)}/telemetry`;
    const ui = new StubMonitorUi();
    const telemetryClient = createSocketTelemetryClient(telemetryUrl);

    runtime = createMonitorRuntime({
      telemetryClient,
      ui,
      targetUrl: telemetryUrl,
      refreshIntervalMs: 50,
    });

    runtime.start();

    await waitFor(() => ui.lastView?.connection === 'connected', 2000);

    const event: TelemetryEvent = {
      topic: 'telemetry.workforce.kpi.v1',
      payload: {
        snapshot: {
          simTimeHours: 24,
          tasksCompleted: 5,
          queueDepth: 2,
          laborHoursCommitted: 8,
          overtimeHoursCommitted: 1,
          overtimeMinutes: 60,
          utilization01: 0.5,
          p95WaitTimeHours: 1.5,
          maintenanceBacklog: 1,
          averageMorale01: 0.7,
          averageFatigue01: 0.3,
        },
      },
    } satisfies TelemetryEvent;

    harness.adapter.publishTelemetry(event);

    await waitFor(() => ui.lastView?.workforce.queueDepth === 2, 2000);

    expect(ui.lastView?.errors).toStrictEqual([]);
    expect(ui.lastView?.events.at(-1)?.topic).toBe('telemetry.workforce.kpi.v1');
  });
});
