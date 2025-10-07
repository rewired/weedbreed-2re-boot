import blessed from 'neo-blessed';
import type Blessed from 'blessed';
import type { Widgets } from 'blessed';

const typedBlessed = blessed as unknown as typeof Blessed;
import type { MonitorUi, MonitorViewModel } from '../runtime.js';

export interface BlessedMonitorOptions {
  readonly targetUrl: string;
  readonly onExit: () => void;
}

function formatNumber(value: number | undefined, digits = 2): string {
  if (value === undefined || Number.isNaN(value)) {
    return '—';
  }

  return value.toFixed(digits);
}

function formatInteger(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return '—';
  }

  return Math.round(value).toString();
}

function renderList(entries: readonly string[], emptyMessage: string): string {
  if (entries.length === 0) {
    return `  ${emptyMessage}`;
  }

  return entries.map((entry) => `  ${entry}`).join('\n');
}

export function createBlessedMonitorUi(options: BlessedMonitorOptions): MonitorUi {
  let screen: Widgets.Screen | undefined;
  let statusBox: Widgets.BoxElement | undefined;
  let workforceBox: Widgets.BoxElement | undefined;
  let healthBox: Widgets.BoxElement | undefined;
  let maintenanceBox: Widgets.BoxElement | undefined;
  let economyBox: Widgets.BoxElement | undefined;
  let logBox: Widgets.BoxElement | undefined;
  let focusIndex = 0;
  let panels: Widgets.BoxElement[] = [];

  const focusPanel = (index: number) => {
    if (!screen || panels.length === 0) {
      return;
    }

    focusIndex = (index + panels.length) % panels.length;
    panels[focusIndex].focus();
    screen.render();
  };

  return {
    initialize() {
      screen = typedBlessed.screen({
        smartCSR: true,
        title: 'Weed Breed Terminal Monitor',
      });

      statusBox = typedBlessed.box({
        top: 0,
        left: 0,
        width: '100%',
        height: 3,
        tags: true,
        padding: { left: 1, right: 1 },
        border: { type: 'line' },
        style: {
          border: { fg: 'cyan' },
        },
        label: 'Status',
      });

      workforceBox = typedBlessed.box({
        top: 3,
        left: 0,
        width: '50%',
        height: '30%',
        label: 'Workforce',
        border: { type: 'line' },
        padding: { left: 1, right: 1 },
        tags: true,
        style: {
          border: { fg: 'green' },
          focus: { border: { fg: 'yellow' } },
        },
        scrollable: true,
        keys: true,
        mouse: true,
        alwaysScroll: true,
      });

      healthBox = typedBlessed.box({
        top: 3,
        left: '50%',
        width: '50%',
        height: '30%',
        label: 'Environment & Health',
        border: { type: 'line' },
        padding: { left: 1, right: 1 },
        tags: true,
        style: {
          border: { fg: 'magenta' },
          focus: { border: { fg: 'yellow' } },
        },
        scrollable: true,
        keys: true,
        mouse: true,
        alwaysScroll: true,
      });

      maintenanceBox = typedBlessed.box({
        top: '33%',
        left: 0,
        width: '50%',
        height: '30%',
        label: 'Maintenance',
        border: { type: 'line' },
        padding: { left: 1, right: 1 },
        tags: true,
        style: {
          border: { fg: 'blue' },
          focus: { border: { fg: 'yellow' } },
        },
        scrollable: true,
        keys: true,
        mouse: true,
        alwaysScroll: true,
      });

      economyBox = typedBlessed.box({
        top: '33%',
        left: '50%',
        width: '50%',
        height: '30%',
        label: 'Economy',
        border: { type: 'line' },
        padding: { left: 1, right: 1 },
        tags: true,
        style: {
          border: { fg: 'yellow' },
          focus: { border: { fg: 'yellow' } },
        },
        scrollable: true,
        keys: true,
        mouse: true,
        alwaysScroll: true,
      });

      logBox = typedBlessed.box({
        top: '63%',
        left: 0,
        width: '100%',
        height: '37%',
        label: 'Telemetry Log',
        border: { type: 'line' },
        padding: { left: 1, right: 1 },
        tags: true,
        style: {
          border: { fg: 'white' },
          focus: { border: { fg: 'yellow' } },
        },
        scrollable: true,
        keys: true,
        mouse: true,
        alwaysScroll: true,
        scrollbar: {
          ch: ' ',
          track: {
            bg: 'grey',
          },
          style: {
            inverse: true,
          },
        },
      });

      panels = [workforceBox, healthBox, maintenanceBox, economyBox, logBox];

      screen.append(statusBox);
      screen.append(workforceBox);
      screen.append(healthBox);
      screen.append(maintenanceBox);
      screen.append(economyBox);
      screen.append(logBox);

      screen.key(['q', 'C-c', 'escape'], () => {
        options.onExit();
      });

      screen.key(['left', 'S-tab'], () => {
        focusPanel(focusIndex - 1);
      });

      screen.key(['right', 'tab'], () => {
        focusPanel(focusIndex + 1);
      });

      focusPanel(0);
      screen.render();
    },
    render(view: MonitorViewModel) {
      if (!screen || !statusBox || !workforceBox || !healthBox || !maintenanceBox || !economyBox || !logBox) {
        return;
      }

      const statusLines = [
        `{bold}Connection:{/bold} ${view.connection} — ${view.statusMessage}`,
        `{bold}Endpoint:{/bold} ${view.targetUrl}`,
        'Keys: ←/→ cycle panels • q to quit',
      ];

      if (view.errors.length > 0) {
        const lastError = view.errors.at(-1);
        statusLines.push(`{red-fg}Last error:{/red-fg} ${lastError ?? ''}`);
      }

      statusBox.setContent(statusLines.join('\n'));

      const workforce = view.workforce;
      const workforceLines = [
        `Tick: ${formatInteger(workforce.lastUpdatedTick)}`,
        `Queue depth: ${formatInteger(workforce.queueDepth)}`,
        `Tasks completed: ${formatInteger(workforce.tasksCompleted)}`,
        `Utilisation: ${workforce.utilizationPercent !== undefined ? `${formatNumber(workforce.utilizationPercent, 2)}%` : '—'}`,
        `Labor hours (per tick): ${formatNumber(workforce.laborHoursCommitted, 2)}`,
        `Overtime hours (per tick): ${formatNumber(workforce.overtimeHoursCommitted, 2)}`,
        `Overtime minutes: ${formatNumber(workforce.overtimeMinutes, 0)}`,
        `Maintenance backlog: ${formatInteger(workforce.maintenanceBacklog)}`,
        `Average morale: ${workforce.moralePercent !== undefined ? `${formatNumber(workforce.moralePercent, 2)}%` : '—'}`,
        `Average fatigue: ${workforce.fatiguePercent !== undefined ? `${formatNumber(workforce.fatiguePercent, 2)}%` : '—'}`,
        `p95 wait time (h): ${formatNumber(workforce.p95WaitTimeHours, 2)}`,
        '',
        'Warnings:',
        renderList(workforce.warnings, 'No workforce warnings'),
      ];
      workforceBox.setContent(workforceLines.join('\n'));

      const health = view.health;
      const healthLines = [
        `Energy: ${view.energy.status}`,
        '',
        `Pest warnings: ${formatInteger(health.warningCount)}`,
        `Highest risk level: ${health.highestRiskLevel ?? '—'}`,
        `Highest risk score: ${health.highestRisk01 !== undefined ? formatNumber(health.highestRisk01, 2) : '—'}`,
        '',
        'Recent signals:',
        renderList(health.notes, 'No recent warnings'),
      ];
      healthBox.setContent(healthLines.join('\n'));

      const maintenance = view.maintenance;
      const maintenanceLines = [
        `Scheduled tasks: ${formatInteger(maintenance.scheduledCount)}`,
        `Total service hours: ${formatNumber(maintenance.totalServiceHours, 2)}`,
        `Total visit cost (cc): ${formatNumber(maintenance.totalVisitCostCc, 2)}`,
        `Replacement advisories: ${formatInteger(maintenance.replacementCount)}`,
        '',
        'Upcoming maintenance:',
        renderList(maintenance.scheduledSummaries, 'No active maintenance tasks'),
        '',
        'Replacement recommendations:',
        renderList(maintenance.replacementSummaries, 'No replacement advisories'),
      ];
      maintenanceBox.setContent(maintenanceLines.join('\n'));

      const economy = view.economy;
      const economyLines = [
        `Payroll day index: ${economy.dayIndex !== undefined ? String(economy.dayIndex) : '—'}`,
        `Labour cost per hour (cc): ${economy.laborCostPerHourCc !== undefined ? formatNumber(economy.laborCostPerHourCc, 4) : '—'}`,
        `Base cost per hour (cc): ${economy.baseCostPerHourCc !== undefined ? formatNumber(economy.baseCostPerHourCc, 4) : '—'}`,
        `Overtime cost per hour (cc): ${economy.overtimeCostPerHourCc !== undefined ? formatNumber(economy.overtimeCostPerHourCc, 4) : '—'}`,
      ];
      economyBox.setContent(economyLines.join('\n'));

      const logLines = view.events
        .slice(-50)
        .map((entry) => `[${entry.topic}] ${entry.summary}`)
        .join('\n');
      logBox.setContent(logLines.length > 0 ? logLines : 'No telemetry received yet.');

      screen.render();
    },
    destroy() {
      if (screen) {
        screen.destroy();
        screen = undefined;
        statusBox = undefined;
        workforceBox = undefined;
        healthBox = undefined;
        maintenanceBox = undefined;
        economyBox = undefined;
        logBox = undefined;
        panels = [];
      }
    },
  } satisfies MonitorUi;
}
