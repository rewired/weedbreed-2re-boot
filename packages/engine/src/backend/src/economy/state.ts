import { z } from 'zod';

import type { SimulationWorld, Uuid } from '../domain/entities.ts';
import { uuidSchema } from '../domain/schemas/primitives.ts';
import { deterministicUuid } from '../util/uuid.ts';

/** Starting liquidity of the canonical `game.new.v1` journey, in company credits. */
export const DEMO_STARTING_BALANCE_CC = 20_000 as const;

/** Stable classifications used by the authoritative company ledger. */
export const ECONOMY_LEDGER_CATEGORIES = [
  'capital_expenditure',
  'operating_expense',
  'seed',
  'sale',
] as const;

/** Classification of one immutable company-ledger entry. */
export type EconomyLedgerCategory = (typeof ECONOMY_LEDGER_CATEGORIES)[number];

/** One immutable posting in the authoritative company ledger. */
export interface EconomyLedgerEntry {
  readonly id: Uuid;
  readonly intentId?: Uuid;
  readonly category: EconomyLedgerCategory;
  readonly direction: 'debit' | 'credit';
  readonly amountCc: number;
  readonly balanceAfterCc: number;
  readonly occurredAtSimTimeHours: number;
  readonly referenceId: string;
  readonly description: string;
  /** Deterministic domain values required to explain or replay the posting. */
  readonly metadata?: Readonly<Record<string, string | number>>;
}

/** Persistent monetary state stored directly in a simulation-world snapshot. */
export interface EconomyState {
  readonly startingBalanceCc: number;
  readonly balanceCc: number;
  readonly ledger: readonly EconomyLedgerEntry[];
}

const finiteNonNegative = z.number().finite().min(0);
const ledgerEntrySchema: z.ZodType<EconomyLedgerEntry, z.ZodTypeDef, unknown> = z.object({
  id: uuidSchema,
  intentId: uuidSchema.optional(),
  category: z.enum(ECONOMY_LEDGER_CATEGORIES),
  direction: z.enum(['debit', 'credit']),
  amountCc: finiteNonNegative,
  balanceAfterCc: z.number().finite(),
  occurredAtSimTimeHours: finiteNonNegative,
  referenceId: z.string().min(1),
  description: z.string().min(1),
  metadata: z.record(z.union([z.string(), z.number().finite()])).readonly().optional(),
}).strict();

/** Runtime schema for persisted economy state. */
export const economyStateSchema: z.ZodType<EconomyState, z.ZodTypeDef, unknown> = z.object({
  startingBalanceCc: finiteNonNegative,
  balanceCc: z.number().finite(),
  ledger: z.array(ledgerEntrySchema).readonly(),
}).strict();

/** Creates an empty persistent economy account. */
export function createEconomyState(startingBalanceCc: number): EconomyState {
  return economyStateSchema.parse({
    startingBalanceCc,
    balanceCc: startingBalanceCc,
    ledger: [],
  });
}

/** Input shared by deterministic debit and credit postings. */
export interface EconomyPostingInput {
  readonly intentId?: Uuid;
  readonly category: EconomyLedgerCategory;
  readonly amountCc: number;
  readonly referenceId: string;
  readonly description: string;
  readonly identity: string;
  /** Operational accruals may cross zero; discretionary purchases may not. */
  readonly allowNegativeBalance?: boolean;
  readonly metadata?: Readonly<Record<string, string | number>>;
}

/** Result of an atomic ledger posting. */
export type EconomyPostingResult =
  | { readonly ok: true; readonly economy: EconomyState; readonly entry: EconomyLedgerEntry }
  | { readonly ok: false; readonly reason: 'economy_unavailable' | 'insufficient_funds' };

function post(
  world: SimulationWorld,
  direction: EconomyLedgerEntry['direction'],
  input: EconomyPostingInput,
): EconomyPostingResult {
  if (!world.economy) return { ok: false, reason: 'economy_unavailable' };
  if (!Number.isFinite(input.amountCc) || input.amountCc < 0) {
    throw new RangeError('Ledger amountCc must be finite and non-negative.');
  }
  if (direction === 'debit' && input.amountCc > 0 && !input.allowNegativeBalance && world.economy.balanceCc < input.amountCc) {
    return { ok: false, reason: 'insufficient_funds' };
  }

  const entryId = deterministicUuid(world.seed, `economy:ledger:${input.identity}`);
  const existing = world.economy.ledger.find((entry) => entry.id === entryId);
  if (existing) return { ok: true, economy: world.economy, entry: existing };
  const balanceAfterCc = world.economy.balanceCc
    + (direction === 'credit' ? input.amountCc : -input.amountCc);
  const entry = ledgerEntrySchema.parse({
    id: entryId,
    ...(input.intentId ? { intentId: input.intentId } : {}),
    category: input.category,
    direction,
    amountCc: input.amountCc,
    balanceAfterCc,
    occurredAtSimTimeHours: world.simTimeHours,
    referenceId: input.referenceId,
    description: input.description,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  });
  return {
    ok: true,
    economy: economyStateSchema.parse({
      ...world.economy,
      balanceCc: balanceAfterCc,
      ledger: [...world.economy.ledger, entry],
    }),
    entry,
  };
}

/** Atomically debits a world account, rejecting purchases without liquidity. */
export function postEconomyDebit(
  world: SimulationWorld,
  input: EconomyPostingInput,
): EconomyPostingResult {
  return post(world, 'debit', input);
}

/** Atomically credits a world account. */
export function postEconomyCredit(
  world: SimulationWorld,
  input: EconomyPostingInput,
): EconomyPostingResult {
  return post(world, 'credit', input);
}
