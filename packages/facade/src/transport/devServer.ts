import process from 'node:process';
import { createTransportServer } from './server.ts';

const host = process.env.FACADE_TRANSPORT_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.FACADE_TRANSPORT_PORT ?? '7101', 10);
const corsOrigin = process.env.FACADE_TRANSPORT_CORS_ORIGIN ?? 'http://localhost:5173';

async function main(): Promise<void> {
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('FACADE_TRANSPORT_PORT must be a positive integer.');
  }

  const server = await createTransportServer({
    host,
    port,
    cors: { origin: corsOrigin },
    async onIntent(intent) {
      console.warn('Intent received without a registered handler:', intent);
    },
  });

  console.info('Facade transport server listening on %s', server.url);
  console.info('Health endpoint available at %s/healthz', server.url);

  const handleShutdown = async () => {
    console.info('\nShutting down transport server...');
    await server.close();
    process.exit(0);
  };

  process.once('SIGINT', handleShutdown);
  process.once('SIGTERM', handleShutdown);
}

main().catch((error) => {
  console.error('Failed to start transport server:', error);
  process.exit(1);
});
