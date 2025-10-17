import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
/* eslint-disable wb-sim/no-ts-import-js-extension */

import {
  companyTreeSchema,
  structureTariffsSchema,
  workforceViewSchema,
  type CompanyTreeReadModel,
  type StructureTariffsReadModel,
  type WorkforceViewReadModel
} from '../readModels/api/schemas.js';
import { validateReadModelSnapshot, type ReadModelSnapshot } from '../readModels/snapshot.js';

/**
 * Minimal logger contract consumed by the read-model HTTP server.
 */
export interface ReadModelHttpLogger {
  /**
   * Emits an error level log with optional structured details.
   */
  readonly error: (message: string, details?: Record<string, unknown>) => void;
}

/**
 * Collection of read-model providers consumed by the HTTP server.
 */
export interface ReadModelProviders {
  /**
   * Supplies the company tree read-model payload.
   */
  readonly companyTree: () => MaybePromise<CompanyTreeReadModel>;
  /**
   * Supplies the structure tariffs read-model payload.
   */
  readonly structureTariffs: () => MaybePromise<StructureTariffsReadModel>;
  /**
   * Supplies the workforce view read-model payload.
   */
  readonly workforceView: () => MaybePromise<WorkforceViewReadModel>;
  /**
   * Supplies the aggregated read-model snapshot consumed by the UI.
   */
  readonly readModels: () => MaybePromise<ReadModelSnapshot>;
}

/**
 * Options accepted by {@link createReadModelHttpServer}.
 */
export interface ReadModelHttpServerOptions {
  /**
   * Deterministic providers returning the latest read-model payloads.
   */
  readonly providers: ReadModelProviders;
  /**
   * Optional logger used to surface validation failures.
   */
  readonly logger?: ReadModelHttpLogger;
}

/**
 * Represents a synchronous or asynchronous value.
 */
type MaybePromise<T> = T | Promise<T>;

/**
 * Creates a Fastify instance exposing read-model endpoints validated against schema contracts.
 */
export function createReadModelHttpServer(options: ReadModelHttpServerOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  const HTTP_STATUS_OK = 200;
  const HTTP_STATUS_INTERNAL_ERROR = 500;
  const HEALTH_STATUS_RESPONSE = { status: 'ok' } as const;
  const logger: ReadModelHttpLogger = options.logger ?? {
    error(message: string, details?: Record<string, unknown>) {
      console.error(message, details);
    }
  };

  async function handleReadModel<T>(
    reply: FastifyReply,
    route: keyof ReadModelProviders,
    provider: () => MaybePromise<T>,
    validate: (payload: unknown) => T
  ): Promise<T | FastifyReply> {
    try {
      const payload = await provider();
      return validate(payload);
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to compose ${route} read-model`, { error: description });
      return reply.status(HTTP_STATUS_INTERNAL_ERROR).send({ error: 'Failed to compose read-model.' });
    }
  }

  app.route({
    method: ['GET', 'HEAD'],
    url: '/healthz',
    handler(request, reply) {
      reply.status(HTTP_STATUS_OK);
      reply.header('content-type', 'application/json; charset=utf-8');

      if (request.method === 'HEAD') {
        return reply.send();
      }

      return reply.send(HEALTH_STATUS_RESPONSE);
    },
  });

  app.get('/api/companyTree', (_request, reply) =>
    handleReadModel(reply, 'companyTree', options.providers.companyTree, (payload) =>
      companyTreeSchema.parse(payload)
    )
  );

  app.get('/api/structureTariffs', (_request, reply) =>
    handleReadModel(reply, 'structureTariffs', options.providers.structureTariffs, (payload) =>
      structureTariffsSchema.parse(payload)
    )
  );

  app.get('/api/workforceView', (_request, reply) =>
    handleReadModel(reply, 'workforceView', options.providers.workforceView, (payload) =>
      workforceViewSchema.parse(payload)
    )
  );

  app.get('/api/read-models', (_request, reply) =>
    handleReadModel(reply, 'readModels', options.providers.readModels, (payload) =>
      validateReadModelSnapshot(payload)
    )
  );

  return app;
}

export type ReadModelHttpServer = FastifyInstance;
