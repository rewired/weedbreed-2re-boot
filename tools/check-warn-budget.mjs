#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const DEFAULT_BUDGET = 30;
const DEFAULT_COMMAND = {
  command: 'pnpm',
  args: [
    '-r',
    '--workspace-concurrency=1',
    'lint',
    '--',
    '--max-warnings=2147483647',
    '--format',
    'json'
  ]
};

export function extractLintReportsFromOutput(output) {
  let capturing = false;
  let depth = 0;
  let current = '';
  const segments = [];

  for (const char of output) {
    if (!capturing) {
      if (char === '[') {
        capturing = true;
        depth = 1;
        current = '[';
      }
      continue;
    }

    current += char;
    if (char === '[') {
      depth += 1;
    } else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        segments.push(current);
        capturing = false;
        current = '';
      }
    }
  }

  return segments.map((segment) => {
    try {
      return JSON.parse(segment);
    } catch (error) {
      const parsingError = new Error('Failed to parse ESLint JSON output segment');
      parsingError.cause = error;
      throw parsingError;
    }
  });
}

export function countWarningsFromReports(reportGroups) {
  return reportGroups
    .flat()
    .reduce((total, report) => {
      if (typeof report.warningCount === 'number') {
        return total + report.warningCount;
      }
      const messages = Array.isArray(report.messages) ? report.messages : [];
      const warningMessages = messages.filter((message) => message && message.severity === 1);
      return total + warningMessages.length;
    }, 0);
}

export function parseCliArguments(argv) {
  let budget = DEFAULT_BUDGET;
  let commandTokens = null;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') {
      commandTokens = argv.slice(index + 1);
      break;
    }

    if (token === '--help' || token === '-h') {
      return { showHelp: true };
    }

    if (token === '--budget' || token === '-b') {
      const next = argv[index + 1];
      if (typeof next === 'undefined') {
        throw new Error('Missing value for --budget flag');
      }
      index += 1;
      budget = Number.parseInt(next, 10);
      continue;
    }

    if (token.startsWith('--budget=')) {
      budget = Number.parseInt(token.split('=')[1] ?? '', 10);
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (!Number.isInteger(budget) || budget < 0) {
    throw new Error('Budget must be a non-negative integer');
  }

  if (commandTokens === null || commandTokens.length === 0) {
    return {
      budget,
      command: DEFAULT_COMMAND
    };
  }

  return {
    budget,
    command: {
      command: commandTokens[0],
      args: commandTokens.slice(1)
    }
  };
}

export async function runBudgetGuard({ budget, command }) {
  const child = spawn(command.command, command.args, {
    stdio: ['inherit', 'pipe', 'pipe']
  });

  let stdout = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
    process.stdout.write(chunk);
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', (error) => reject(error));
    child.on('close', (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 0);
    });
  });

  if (exitCode !== 0) {
    return exitCode;
  }

  const reports = extractLintReportsFromOutput(stdout);
  const warningCount = countWarningsFromReports(reports);
  const budgetMessage = `[lint:strict] ESLint warnings: ${warningCount} / ${budget}`;
  if (warningCount > budget) {
    process.stderr.write(`\n${budgetMessage} — exceeds temporary budget.\n`);
    return 1;
  }

  process.stdout.write(`\n${budgetMessage} — within budget.\n`);
  return 0;
}

function printHelp() {
  process.stdout.write(`Usage: node tools/check-warn-budget.mjs [--budget <number>] [-- command ...]\n`);
  process.stdout.write(`\nRuns the provided lint command (defaults to "pnpm -r lint") and fails when ESLint warnings exceed the budget.\n`);
}

async function cli() {
  try {
    const parsed = parseCliArguments(process.argv.slice(2));
    if (parsed.showHelp) {
      printHelp();
      return;
    }
    const exitCode = await runBudgetGuard(parsed);
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write(`check-warn-budget: ${(error && error.message) || 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

const isDirectExecution = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  cli();
}
