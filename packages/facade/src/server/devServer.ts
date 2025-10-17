/* eslint-disable wb-sim/no-ts-import-js-extension */

import process from 'node:process';

import { initializeFacade } from '../index.js';
import { createReadModelHttpServer } from './http.js';
import { createReadModelProviders } from './readModelProviders.js';
import { createDemoWorld } from '@/backend/src/engine/testHarness.ts';

const DEFAULT_HTTP_PORT = 3333;
const DECIMAL_RADIX = 10;

async function bootstrap() {
  const world = createDemoWorld();
  const { engineConfig, companyWorld } = initializeFacade({
    scenarioId: 'demo',
    verbose: true,
    world: world.company
  });

  const providers = createReadModelProviders({
    world,
    companyWorld,
    config: engineConfig
  });

  const port = Number.parseInt(
    process.env.FACADE_HTTP_PORT ?? DEFAULT_HTTP_PORT.toString(),
    DECIMAL_RADIX
  );

  const server = createReadModelHttpServer({ providers });

  const shutdown = async (signal: NodeJS.Signals | 'exit') => {
    try {
      await server.close();
    } finally {
      if (signal !== 'exit') {
        process.exit(0);
      }
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('exit', () => {
    void shutdown('exit');
  });

  await server
    .listen({ port, host: '0.0.0.0' })
    .then(() => {
      console.log(`Read-model HTTP server listening on http://localhost:${String(port)}`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Failed to start read-model HTTP server', message);
      process.exitCode = 1;
    });
}

await bootstrap();
