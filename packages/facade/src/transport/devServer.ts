import process from 'node:process';
/* eslint-disable wb-sim/no-ts-import-js-extension */

import { createTransportServer, type TransportServer } from './server.js';

const host = process.env.FACADE_TRANSPORT_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.FACADE_TRANSPORT_PORT ?? '7101', 10);
const corsOrigin = process.env.FACADE_TRANSPORT_CORS_ORIGIN ?? 'http://localhost:5173';

function ensureError(candidate: unknown): Error {
  return candidate instanceof Error ? candidate : new Error(String(candidate));
}

async function main(): Promise<void> {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('FACADE_TRANSPORT_PORT must be a positive integer.');
  }

  const server: TransportServer = await createTransportServer({
    host,
    port,
    cors: { origin: corsOrigin },
    onIntent(intent) {
      console.warn('Intent received without a registered handler:', intent);
    },
  });

  console.info('Facade transport server listening on %s', server.url);
  console.info('Health endpoint available at %s/healthz', server.url);

  const initiateShutdown = () => {
    console.info('\nShutting down transport server...');

    void (async () => {
      try {
        await server.close();
        process.exit(0);
      } catch (error) {
        const normalisedError = ensureError(error);
        console.error('Failed to close transport server:', normalisedError);
        process.exit(1);
      }
    })();
  };

  process.once('SIGINT', initiateShutdown);
  process.once('SIGTERM', initiateShutdown);
}

main().catch((error: unknown) => {
  const normalisedError = ensureError(error);
  console.error('Failed to start transport server:', normalisedError);
  process.exit(1);
});


