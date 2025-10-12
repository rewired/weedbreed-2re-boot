import type { TransportServerOptions } from '../../../src/transport/server.ts';
import {
  createTransportServer,
  type TransportCorsOptions,
  type TransportServer,
} from '../../../src/transport/server.ts';
import {
  createReadModelHttpServer,
  type ReadModelHttpServer,
  type ReadModelProviders,
} from '../../../src/server/http.ts';

const LOOPBACK_HOST = '127.0.0.1';

type OnIntentHandler = TransportServerOptions['onIntent'];

function ensureError(candidate: unknown): Error {
  return candidate instanceof Error ? candidate : new Error(String(candidate));
}

export interface ContractServerHarness {
  readonly http: {
    readonly server: ReadModelHttpServer;
    readonly url: string;
  };
  readonly transport: TransportServer;
  close(): Promise<void>;
}

export interface ContractServerHarnessOptions {
  readonly providers: ReadModelProviders;
  readonly onIntent?: OnIntentHandler;
  readonly cors?: TransportCorsOptions;
}

export async function createContractServerHarness(
  options: ContractServerHarnessOptions,
): Promise<ContractServerHarness> {
  const httpServer = createReadModelHttpServer({ providers: options.providers });

  try {
    await httpServer.listen({ port: 0, host: LOOPBACK_HOST });
  } catch (error) {
    await httpServer.close().catch(() => undefined);
    throw ensureError(error);
  }

  const httpAddress = httpServer.server.address();

  if (!httpAddress || typeof httpAddress === 'string') {
    await httpServer.close().catch(() => undefined);
    throw new Error('Read-model HTTP server failed to expose a TCP address.');
  }

  const httpPort = httpAddress.port;
  const httpUrl = `http://${LOOPBACK_HOST}:${String(httpPort)}`;

  let transportServer: TransportServer;

  try {
    transportServer = await createTransportServer({
      host: LOOPBACK_HOST,
      port: 0,
      cors: options.cors,
      onIntent: options.onIntent ?? (() => undefined),
    });
  } catch (error) {
    await httpServer.close().catch(() => undefined);
    throw ensureError(error);
  }

  return {
    http: {
      server: httpServer,
      url: httpUrl,
    },
    transport: transportServer,
    async close() {
      const closeErrors: Error[] = [];

      try {
        await transportServer.close();
      } catch (error) {
        closeErrors.push(ensureError(error));
      }

      try {
        await httpServer.close();
      } catch (error) {
        closeErrors.push(ensureError(error));
      }

      if (closeErrors.length > 0) {
        throw closeErrors[0];
      }
    },
  } satisfies ContractServerHarness;
}
