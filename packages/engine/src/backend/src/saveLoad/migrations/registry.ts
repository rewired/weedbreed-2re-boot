import { z } from 'zod';

import { saveGameEnvelopeSchema } from '../schemas.js';

export interface SaveGameMigrationStep {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly migrate: (input: unknown) => unknown | Promise<unknown>;
}

const schemaVersionSchema = saveGameEnvelopeSchema.extend({
  schemaVersion: z.number().int().nonnegative(),
});

function extractSchemaVersion(payload: unknown): number {
  const parsed = schemaVersionSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error('Save game payload is missing a numeric schemaVersion');
  }

  return parsed.data.schemaVersion;
}

export class SaveGameMigrationRegistry {
  private readonly steps = new Map<number, SaveGameMigrationStep>();

  public constructor(private readonly targetVersion: number) {}

  public register(step: SaveGameMigrationStep): void {
    if (this.steps.has(step.fromVersion)) {
      throw new Error(`Migration from version ${step.fromVersion} already registered`);
    }

    if (step.toVersion <= step.fromVersion) {
      throw new Error('Migration steps must increase schemaVersion');
    }

    this.steps.set(step.fromVersion, step);
  }

  public async migrate(payload: unknown, targetVersion = this.targetVersion): Promise<unknown> {
    let working = payload;
    let version = extractSchemaVersion(working);

    if (version > targetVersion) {
      throw new Error(`Cannot migrate save from newer schemaVersion ${version}`);
    }

    while (version < targetVersion) {
      const step = this.steps.get(version);

      if (!step) {
        throw new Error(`No migration registered for schemaVersion ${version}`);
      }

       
      working = await step.migrate(working);
      version = extractSchemaVersion(working);

      if (version !== step.toVersion) {
        throw new Error(
          `Migration from ${step.fromVersion} returned schemaVersion ${version}; expected ${step.toVersion}`,
        );
      }
    }

    return working;
  }
}
