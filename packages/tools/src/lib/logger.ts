import pino, { type LoggerOptions } from 'pino';

const DEFAULT_LEVEL = process.env.WB_TOOLS_LOG_LEVEL ?? 'silent';

function buildOptions(): LoggerOptions {
  const options: LoggerOptions = {
    level: DEFAULT_LEVEL
  };

  const enablePretty =
    process.stdout.isTTY && (process.env.WB_TOOLS_LOG_PRETTY ?? '1') !== '0';

  if (enablePretty) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: true
      }
    };
  }

  return options;
}

export function createToolsLogger() {
  return pino(buildOptions());
}

export const logger = createToolsLogger();
