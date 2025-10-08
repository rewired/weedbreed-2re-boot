import process from 'node:process';
import { createMonitorRuntime, type MonitorRuntime } from './runtime.ts';
import { createSocketTelemetryClient } from './socketTelemetryClient.ts';
import { createBlessedMonitorUi } from './ui/blessedUi.ts';

interface CliOptions {
  readonly baseUrl: string;
  readonly refreshIntervalMs: number;
}

function normaliseBaseUrl(raw: string | undefined): string {
  const fallback = 'http://127.0.0.1:4000';
  if (!raw) {
    return fallback;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  const withoutTelemetry = trimmed.endsWith('/telemetry')
    ? trimmed.slice(0, Math.max(0, trimmed.length - '/telemetry'.length))
    : trimmed;

  return withoutTelemetry.replace(/\/+$/, '');
}

function parseRefreshInterval(raw: string | undefined, defaultValue: number): number {
  if (!raw) {
    return defaultValue;
  }

  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

function parseCliOptions(argv: readonly string[], env: NodeJS.ProcessEnv): CliOptions {
  let baseUrl = normaliseBaseUrl(env.WB_MONITOR_BASE_URL);
  let refreshIntervalMs = parseRefreshInterval(env.WB_MONITOR_REFRESH_MS, 1000);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? '';

    if (argument === '--base-url' || argument === '--url') {
      baseUrl = normaliseBaseUrl(argv[index + 1]);
      index += 1;
      continue;
    }

    if (argument.startsWith('--base-url=') || argument.startsWith('--url=')) {
      const [, value] = argument.split('=', 2);
      baseUrl = normaliseBaseUrl(value);
      continue;
    }

    if (argument === '--refresh-ms') {
      refreshIntervalMs = parseRefreshInterval(argv[index + 1], refreshIntervalMs);
      index += 1;
      continue;
    }

    if (argument.startsWith('--refresh-ms=')) {
      const [, value] = argument.split('=', 2);
      refreshIntervalMs = parseRefreshInterval(value, refreshIntervalMs);
    }
  }

  return { baseUrl, refreshIntervalMs } satisfies CliOptions;
}

function buildTelemetryUrl(baseUrl: string): string {
  const normalised = normaliseBaseUrl(baseUrl);
  return `${normalised}/telemetry`;
}

function runCli(): void {
  const argv = process.argv.slice(2);

  if (argv.includes('--help') || argv.includes('-h')) {
    process.stdout.write(`Weed Breed Terminal Monitor\n`);
    process.stdout.write(`Usage: pnpm monitor:terminal [--base-url=http://host:port] [--refresh-ms=1000]\n`);
    process.stdout.write(`Environment variables:\n`);
    process.stdout.write(`  WB_MONITOR_BASE_URL   Override telemetry base URL (default http://127.0.0.1:4000)\n`);
    process.stdout.write(`  WB_MONITOR_REFRESH_MS Refresh cadence in milliseconds (default 1000)\n`);
    return;
  }

  const options = parseCliOptions(argv, process.env);
  const telemetryUrl = buildTelemetryUrl(options.baseUrl);
  const telemetryClient = createSocketTelemetryClient(telemetryUrl);

  let shuttingDown = false;
  let runtime: MonitorRuntime | undefined;

  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    if (runtime) {
      await runtime.stop();
      runtime = undefined;
    }

    process.exit(0);
  };

  const ui = createBlessedMonitorUi({
    targetUrl: telemetryUrl,
    onExit: () => {
      void shutdown();
    },
  });

  runtime = createMonitorRuntime({
    telemetryClient,
    ui,
    targetUrl: telemetryUrl,
    refreshIntervalMs: options.refreshIntervalMs,
  });

  runtime.start();

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  runCli();
}

export { createMonitorRuntime } from './runtime.ts';
export type {
  EconomyPanelView,
  EnergyPanelView,
  HealthPanelView,
  MaintenancePanelView,
  MonitorEventLogEntry,
  MonitorRuntime,
  MonitorRuntimeOptions,
  MonitorUi,
  MonitorViewModel,
  TelemetryClient,
  TelemetryClientEventMap,
  TelemetryConnectionState,
  TelemetryMessage,
  WorkforcePanelView,
} from './runtime.ts';
export { createSocketTelemetryClient } from './socketTelemetryClient.ts';
export { createBlessedMonitorUi } from './ui/blessedUi.ts';
export type { BlessedMonitorOptions } from './ui/blessedUi.ts';
