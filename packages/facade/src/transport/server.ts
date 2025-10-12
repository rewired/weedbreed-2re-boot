/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import {
  createSocketTransportAdapter,
  type SocketTransportAdapter,
  type SocketTransportAdapterOptions,
  type TransportIntentEnvelope,
} from './adapter.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 7101;

/**
 * CORS configuration compatible with the underlying Socket.IO transport adapter.
 */
export interface TransportCorsOptions {
  readonly origin?: string | true | RegExp | string[];
  readonly credentials?: boolean;
  readonly allowedHeaders?: string | string[];
  readonly exposedHeaders?: string | string[];
  readonly methods?: string | string[];
  readonly maxAge?: number;
}

/**
 * Options accepted by {@link createTransportServer}.
 */
export interface TransportServerOptions {
  /** Hostname where the transport server should bind. Defaults to {@link DEFAULT_HOST}. */
  readonly host?: string;
  /** TCP port where the transport server listens. Defaults to {@link DEFAULT_PORT}. */
  readonly port?: number;
  /** Optional CORS configuration forwarded to the Socket.IO adapter. */
  readonly cors?: TransportCorsOptions;
  /** Intent handler invoked whenever the intents namespace receives a submission. */
  readonly onIntent: (intent: TransportIntentEnvelope) => void | Promise<void>;
}

/**
 * Runtime transport server exposing Socket.IO namespaces and lifecycle helpers.
 */
export interface TransportServer {
  /** Resolved hostname after the server binds. */
  readonly host: string;
  /** Resolved TCP port. */
  readonly port: number;
  /** HTTP origin clients should target. */
  readonly url: string;
  /** Bound Socket.IO namespaces. */
  readonly namespaces: SocketTransportAdapter['namespaces'];
  /** Closes the Socket.IO adapter and HTTP listener. */
  close(): Promise<void>;
}

function ensureError(candidate: unknown): Error {
  return candidate instanceof Error ? candidate : new Error(String(candidate));
}

function normaliseHeaderValue(value: string | readonly string[]): string {
  if (typeof value === 'string') {
    return value;
  }

  return value.join(', ');
}

type HealthHandler = (request: IncomingMessage, response: ServerResponse) => void;

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_NOT_FOUND = 404;
const ACCESS_CONTROL_ALLOW_METHODS = 'GET, OPTIONS';

function getRequestOrigin(request: IncomingMessage): string | undefined {
  const header = request.headers.origin;
  if (typeof header === 'string') {
    return header;
  }

  if (Array.isArray(header)) {
    return header[0];
  }

  return undefined;
}

function resolveAllowedOrigin(
  request: IncomingMessage,
  cors?: TransportCorsOptions
): string | undefined {
  if (!cors?.origin) {
    return undefined;
  }

  const requestOrigin = getRequestOrigin(request);
  const { origin } = cors;

  if (origin === '*') {
    return '*';
  }

  if (origin === true) {
    return requestOrigin ?? '*';
  }

  if (typeof origin === 'string') {
    return origin;
  }

  if (Array.isArray(origin)) {
    if (origin.length === 0) {
      return undefined;
    }

    if (requestOrigin && origin.includes(requestOrigin)) {
      return requestOrigin;
    }

    return origin[0];
  }

  if (origin instanceof RegExp) {
    if (requestOrigin && origin.test(requestOrigin)) {
      return requestOrigin;
    }

    return undefined;
  }

  return undefined;
}

function applyCorsHeaders(
  request: IncomingMessage,
  response: ServerResponse,
  cors?: TransportCorsOptions
): void {
  if (!cors) {
    return;
  }

  const allowedOrigin = resolveAllowedOrigin(request, cors);

  if (allowedOrigin) {
    response.setHeader('access-control-allow-origin', allowedOrigin);

    if (allowedOrigin !== '*') {
      response.setHeader('vary', 'Origin');
    }
  }

  if (cors.credentials) {
    response.setHeader('access-control-allow-credentials', 'true');
  }

  if (cors.allowedHeaders) {
    response.setHeader(
      'access-control-allow-headers',
      normaliseHeaderValue(cors.allowedHeaders)
    );
  }

  if (cors.exposedHeaders) {
    response.setHeader(
      'access-control-expose-headers',
      normaliseHeaderValue(cors.exposedHeaders)
    );
  }

  if (typeof cors.maxAge === 'number') {
    response.setHeader('access-control-max-age', String(cors.maxAge));
  }
}

function createHealthHandler(statusBody: string, cors?: TransportCorsOptions): HealthHandler {
  return (request: IncomingMessage, response: ServerResponse): void => {
    if (!request.url) {
      response.writeHead(HTTP_STATUS_NOT_FOUND);
      response.end();
      return;
    }

    const { method, url } = request;

    if (method === 'GET' && new URL(url, 'http://localhost').pathname === '/healthz') {
      applyCorsHeaders(request, response, cors);
      response.statusCode = HTTP_STATUS_OK;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(statusBody);
      return;
    }

    if (method === 'OPTIONS') {
      applyCorsHeaders(request, response, cors);
      response.setHeader('access-control-allow-methods', ACCESS_CONTROL_ALLOW_METHODS);
      response.end();
      return;
    }

    response.writeHead(HTTP_STATUS_NOT_FOUND);
    response.end();
  };
}

async function closeHttpServer(server: ReturnType<typeof createHttpServer>): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING') {
        reject(ensureError(error));
        return;
      }

      resolve();
    });
  });
}

/**
 * Creates an HTTP server bound to Socket.IO namespaces (`/telemetry`, `/intents`) while
 * exposing a deterministic `/healthz` endpoint.
 *
 * @param options - Transport configuration.
 * @returns A running transport server reference.
 */
export async function createTransportServer(options: TransportServerOptions): Promise<TransportServer> {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const httpServer = createHttpServer(
    createHealthHandler('{"status":"ok"}', options.cors)
  );
  const serverOptions: SocketTransportAdapterOptions['serverOptions'] | undefined = options.cors
    ? { cors: options.cors }
    : undefined;
  const adapter = createSocketTransportAdapter({
    httpServer,
    onIntent: options.onIntent,
    serverOptions,
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const handleError = (error: unknown) => {
        httpServer.off('error', handleError);
        reject(ensureError(error));
      };

      httpServer.once('error', handleError);
      httpServer.listen(port, host, () => {
        httpServer.off('error', handleError);
        resolve();
      });
    });
  } catch (error) {
    await adapter.close();
    await closeHttpServer(httpServer);
    throw ensureError(error);
  }

  const address = httpServer.address();

  if (!address || typeof address === 'string') {
    await adapter.close();
    await closeHttpServer(httpServer);
    throw new Error('Transport server failed to resolve a TCP address.');
  }

  const { port: resolvedPort } = address;
  const resolvedPortLabel = String(resolvedPort);
  const url = `http://${host}:${resolvedPortLabel}`;

  return {
    host,
    port: resolvedPort,
    url,
    namespaces: adapter.namespaces,
    async close() {
      await adapter.close();
      await closeHttpServer(httpServer);
    },
  } satisfies TransportServer;
}












