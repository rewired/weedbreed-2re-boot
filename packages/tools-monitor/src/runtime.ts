import { ZodError } from 'zod';
import {
  appendLog,
  createInitialMonitorState,
  recordError,
  type MonitorState,
  type RenderConfig,
} from './runtime/state.ts';
import { buildView, handleTelemetryMessage } from './runtime/telemetry.ts';
import type { MonitorRuntime, MonitorRuntimeOptions, TelemetryMessage } from './runtime/types.ts';

export type {
  MonitorRuntime,
  MonitorUi,
  MonitorViewModel,
  MonitorRuntimeOptions,
  TelemetryClient,
  TelemetryClientEventMap,
  TelemetryConnectionState,
  TelemetryMessage,
  WorkforcePanelView,
  HealthPanelView,
  MaintenancePanelView,
  EconomyPanelView,
  EnergyPanelView,
  MonitorEventLogEntry,
} from './runtime/types.ts';

const DEFAULT_REFRESH_INTERVAL_MS = 1_000;
const DEFAULT_MAX_LOG_ENTRIES = 50;
const DEFAULT_MAX_ERROR_ENTRIES = 10;

export function createMonitorRuntime(options: MonitorRuntimeOptions): MonitorRuntime {
  const { telemetryClient, ui, targetUrl } = options;
  const refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
  const maxLogEntries = options.maxLogEntries ?? DEFAULT_MAX_LOG_ENTRIES;
  const maxErrorEntries = options.maxErrorEntries ?? DEFAULT_MAX_ERROR_ENTRIES;
  const config: RenderConfig = { maxLogEntries, maxErrorEntries };

  const state: MonitorState = createInitialMonitorState(targetUrl);

  let started = false;
  let stopping = false;
  let refreshTimer: NodeJS.Timeout | undefined;

  const handleConnect = () => {
    state.connection = 'connected';
    state.statusMessage = `Connected to ${targetUrl}`;
    appendLog(state, { topic: 'connection', summary: 'Telemetry connection established.' }, maxLogEntries);
    renderNow();
  };

  const handleDisconnect = () => {
    state.connection = 'disconnected';
    state.statusMessage = `Disconnected from ${targetUrl}`;
    appendLog(state, { topic: 'connection', summary: 'Telemetry connection lost.' }, maxLogEntries);
    renderNow();
  };

  const handleError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    recordError(state, message, maxErrorEntries);
    renderNow();
  };

  const handleEvent = (message: TelemetryMessage) => {
    try {
      handleTelemetryMessage(state, message, config);
    } catch (error: unknown) {
      const reason =
        error instanceof ZodError ? error.issues.map((issue) => issue.message).join('; ') : String(error);
      recordError(state, `Failed to parse ${message.topic}: ${reason}`, maxErrorEntries);
    }

    renderNow();
  };

  const renderNow = () => {
    const view = buildView(state);
    ui.render(view);
  };

  return {
    start() {
      if (started) {
        return;
      }

      started = true;
      ui.initialize();
      renderNow();

      telemetryClient.on('connect', handleConnect);
      telemetryClient.on('disconnect', handleDisconnect);
      telemetryClient.on('event', handleEvent);
      telemetryClient.on('error', handleError);

      telemetryClient.connect();

      refreshTimer = setInterval(() => {
        renderNow();
      }, refreshIntervalMs);
    },
    async stop() {
      if (!started || stopping) {
        return;
      }

      stopping = true;

      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = undefined;
      }

      telemetryClient.off('connect', handleConnect);
      telemetryClient.off('disconnect', handleDisconnect);
      telemetryClient.off('event', handleEvent);
      telemetryClient.off('error', handleError);

      await telemetryClient.disconnect();
      ui.destroy();
      state.connection = 'disconnected';
    },
  } satisfies MonitorRuntime;
}
