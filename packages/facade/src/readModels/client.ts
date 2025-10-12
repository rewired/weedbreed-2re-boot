/* eslint-disable wb-sim/no-ts-import-js-extension */

import type { ZodIssue, ZodType, ZodTypeDef } from 'zod';
import {
  companyTreeSchema,
  structureTariffsSchema,
  workforceViewSchema,
  type CompanyTreeReadModel,
  type StructureTariffsReadModel,
  type WorkforceViewReadModel
} from './api/schemas.js';

const READ_MODEL_ENDPOINT = {
  companyTree: '/api/companyTree',
  structureTariffs: '/api/structureTariffs',
  workforceView: '/api/workforceView'
} as const;

type ReadModelKey = keyof typeof READ_MODEL_ENDPOINT;

type ReadModelClientErrorReason = 'network' | 'http' | 'schema';

interface ReadModelClientErrorInit extends ErrorOptions {
  readonly status?: number;
  readonly issues?: readonly ZodIssue[];
}

/**
 * Represents a failure encountered while fetching a read-model payload.
 */
export class ReadModelClientError extends Error {
  /**
   * Category describing why the client call failed.
   */
  public readonly reason: ReadModelClientErrorReason;

  /**
   * HTTP status code reported by the backend when {@link reason} equals `"http"`.
   */
  public readonly status?: number;

  /**
   * Zod issues describing the schema mismatches when {@link reason} equals `"schema"`.
   */
  public readonly issues?: readonly ZodIssue[];

  constructor(reason: ReadModelClientErrorReason, message: string, init: ReadModelClientErrorInit = {}) {
    super(message, init);
    this.name = 'ReadModelClientError';
    this.reason = reason;
    this.status = init.status;
    this.issues = init.issues;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

async function requestReadModel<TOutput>(
  baseUrl: string,
  key: ReadModelKey,
  schema: ZodType<TOutput, ZodTypeDef, unknown>
): Promise<TOutput> {
  const url = `${normalizeBaseUrl(baseUrl)}${READ_MODEL_ENDPOINT[key]}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new ReadModelClientError('network', `Failed to fetch ${key} read model.`, { cause: error });
  }

  if (!response.ok) {
    throw new ReadModelClientError(
      'http',
      `Request for ${key} read model failed with status ${String(response.status)}.`,
      { status: response.status }
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new ReadModelClientError('network', `Unable to parse ${key} read model response as JSON.`, { cause: error });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ReadModelClientError('schema', `Response for ${key} read model failed validation.`, {
      cause: parsed.error,
      issues: parsed.error.issues
    });
  }

  return parsed.data;
}

/**
 * Fetches and validates the company hierarchy read model from the façade backend.
 */
export async function fetchCompanyTree(baseUrl: string): Promise<CompanyTreeReadModel> {
  return requestReadModel<CompanyTreeReadModel>(baseUrl, 'companyTree', companyTreeSchema);
}

/**
 * Fetches and validates the structure tariff read model from the façade backend.
 */
export async function fetchStructureTariffs(baseUrl: string): Promise<StructureTariffsReadModel> {
  return requestReadModel<StructureTariffsReadModel>(baseUrl, 'structureTariffs', structureTariffsSchema);
}

/**
 * Fetches and validates the workforce summary read model from the façade backend.
 */
export async function fetchWorkforceView(baseUrl: string): Promise<WorkforceViewReadModel> {
  return requestReadModel<WorkforceViewReadModel>(baseUrl, 'workforceView', workforceViewSchema);
}
