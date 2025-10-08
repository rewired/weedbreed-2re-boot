import { createServer } from 'node:http';
import process from 'node:process';
import {
  createSocketTransportAdapter,
  type SocketTransportAdapter,
  type TelemetryEvent,
} from '@wb/transport-sio';

interface MockServerOptions {
  readonly host: string;
  readonly port: number;
  readonly intervalMs: number;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptions(argv: readonly string[], env: NodeJS.ProcessEnv): MockServerOptions {
  let host = env.WB_MOCK_TELEMETRY_HOST?.trim() || '127.0.0.1';
  let port = parsePositiveInteger(env.WB_MOCK_TELEMETRY_PORT, 4000);
  let intervalMs = parsePositiveInteger(env.WB_MOCK_TELEMETRY_INTERVAL_MS, 1000);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';

    if (argument === '--host') {
      host = argv[index + 1]?.trim() || host;
      index += 1;
      continue;
    }

    if (argument.startsWith('--host=')) {
      const [, value] = argument.split('=', 2);
      host = value?.trim() || host;
      continue;
    }

    if (argument === '--port') {
      port = parsePositiveInteger(argv[index + 1], port);
      index += 1;
      continue;
    }

    if (argument.startsWith('--port=')) {
      const [, value] = argument.split('=', 2);
      port = parsePositiveInteger(value, port);
      continue;
    }

    if (argument === '--interval-ms') {
      intervalMs = parsePositiveInteger(argv[index + 1], intervalMs);
      index += 1;
      continue;
    }

    if (argument.startsWith('--interval-ms=')) {
      const [, value] = argument.split('=', 2);
      intervalMs = parsePositiveInteger(value, intervalMs);
    }
  }

  return { host, port, intervalMs } satisfies MockServerOptions;
}

function createMockPayloads(tick: number): TelemetryEvent[] {
  const simTimeHours = tick;
  const queueDepth = tick % 6;
  const overtimeMinutes = (tick % 4) * 30;

  const workforceEvent: TelemetryEvent = {
    topic: 'telemetry.workforce.kpi.v1',
    payload: {
      snapshot: {
        simTimeHours,
        tasksCompleted: tick * 3,
        queueDepth,
        laborHoursCommitted: 8 + (tick % 4),
        overtimeHoursCommitted: overtimeMinutes / 60,
        overtimeMinutes,
        utilization01: ((tick % 10) + 2) / 12,
        p95WaitTimeHours: 0.5 + (tick % 5) * 0.25,
        maintenanceBacklog: tick % 4,
        averageMorale01: 0.55 + ((tick % 3) * 0.05),
        averageFatigue01: 0.35 + ((tick % 4) * 0.08),
      },
    },
  } satisfies TelemetryEvent;

  const workforceWarningsEvent: TelemetryEvent = {
    topic: 'telemetry.workforce.warning.v1',
    payload: {
      warnings:
        queueDepth > 3
          ? [
              {
                simTimeHours,
                code: 'queue_depth_high',
                message: `Queue depth ${queueDepth} waiting tasks`,
                severity: queueDepth >= 5 ? 'critical' : 'warning',
                metadata: { queueDepth },
              },
            ]
          : [],
    },
  } satisfies TelemetryEvent;

  const events: TelemetryEvent[] = [workforceEvent, workforceWarningsEvent];

  if (tick % 3 === 0) {
    events.push({
      topic: 'telemetry.health.pest_disease.risk.v1',
      payload: {
        warnings: [
          {
            structureId: 'structure-1',
            roomId: 'room-1',
            zoneId: `zone-${(tick % 3) + 1}`,
            riskLevel: tick % 6 === 0 ? 'severe' : 'elevated',
            risk01: 0.3 + (tick % 5) * 0.1,
            tick: simTimeHours,
          },
        ],
      },
    });
  }

  if (tick % 4 === 0) {
    events.push({
      topic: 'telemetry.health.pest_disease.task_emitted.v1',
      payload: {
        events: [
          {
            taskId: `task-${tick}`,
            taskCode: 'inspect_zone',
            structureId: 'structure-1',
            roomId: 'room-1',
            zoneId: `zone-${(tick % 3) + 1}`,
            tick: simTimeHours,
            riskLevel: 'follow_up',
            risk01: 0.2 + (tick % 4) * 0.1,
          },
        ],
      },
    });
  }

  if (tick % 8 === 0) {
    events.push({
      topic: 'telemetry.device.maintenance.scheduled.v1',
      payload: {
        taskId: `maint-${tick}`,
        deviceId: `device-${(tick % 5) + 1}`,
        structureId: 'structure-1',
        roomId: 'room-1',
        zoneId: `zone-${(tick % 3) + 1}`,
        startTick: simTimeHours,
        endTick: simTimeHours + 4,
        serviceHours: 1 + (tick % 3) * 0.5,
        reason: tick % 16 === 0 ? 'Filter replacement' : 'Routine inspection',
        serviceVisitCostCc: 85 + (tick % 4) * 15,
      },
    });
  }

  if (tick % 12 === 0) {
    events.push({
      topic: 'telemetry.device.replacement.recommended.v1',
      payload: {
        deviceId: `device-${(tick % 5) + 1}`,
        structureId: 'structure-1',
        roomId: 'room-1',
        zoneId: `zone-${(tick % 3) + 1}`,
        recommendedSinceTick: simTimeHours - 6,
        totalMaintenanceCostCc: 320 + tick * 4,
        replacementCostCc: 540 + tick * 8,
      },
    });
  }

  if (tick % 6 === 0) {
    const dayIndex = tick / 6;
    const baseMinutes = 480 + (dayIndex % 3) * 30;
    const otMinutes = 60 + (dayIndex % 2) * 30;
    const baseCost = baseMinutes * 1.2;
    const otCost = otMinutes * 1.8;
    const totalLaborCost = baseCost + otCost;

    events.push({
      topic: 'telemetry.workforce.payroll_snapshot.v1',
      payload: {
        snapshot: {
          dayIndex,
          totals: {
            baseMinutes,
            otMinutes,
            baseCost,
            otCost,
            totalLaborCost,
          },
          byStructure: [
            {
              structureId: 'structure-1',
              baseMinutes: baseMinutes * 0.6,
              otMinutes: otMinutes * 0.5,
              baseCost: baseCost * 0.6,
              otCost: otCost * 0.5,
              totalLaborCost: totalLaborCost * 0.55,
            },
            {
              structureId: 'structure-2',
              baseMinutes: baseMinutes * 0.4,
              otMinutes: otMinutes * 0.5,
              baseCost: baseCost * 0.4,
              otCost: otCost * 0.5,
              totalLaborCost: totalLaborCost * 0.45,
            },
          ],
        },
      },
    });
  }

  return events;
}

async function startServer(options: MockServerOptions): Promise<{
  readonly adapter: SocketTransportAdapter;
  stop(): Promise<void>;
}> {
  const httpServer = createServer();

  await new Promise<void>((resolve) => {
    httpServer.listen(options.port, options.host, () => {
      resolve();
    });
  });

  console.log(
    `[mock-telemetry] Listening on http://${options.host}:${String(options.port)}/telemetry`
  );

  const adapter = createSocketTransportAdapter({
    httpServer,
    onIntent: () => {
      console.warn('[mock-telemetry] Ignoring intent on read-only mock server.');
    },
  });

  adapter.namespaces.telemetry.on('connection', (socket) => {
    console.log('[mock-telemetry] Telemetry subscriber connected.');
    socket.on('disconnect', (reason) => {
      console.log(`[mock-telemetry] Telemetry subscriber disconnected (${reason}).`);
    });
  });

  return {
    adapter,
    async stop() {
      await adapter.close();
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          resolve();
        });
      });
    },
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2), process.env);
  const server = await startServer(options);

  let tick = 0;
  const interval = setInterval(() => {
    tick += 1;
    const payloads = createMockPayloads(tick);
    for (const event of payloads) {
      server.adapter.publishTelemetry(event);
    }
  }, options.intervalMs);

  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    clearInterval(interval);

    try {
      await server.stop();
    } catch (error) {
      console.error('[mock-telemetry] Failed to close server cleanly.', error);
    }

    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

main().catch((error) => {
  console.error('[mock-telemetry] Fatal error starting mock telemetry server.', error);
  process.exit(1);
});
