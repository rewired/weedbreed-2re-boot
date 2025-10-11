import { createRng, type RandomNumberGenerator } from '../../util/rng.ts';
import type { EmployeeRngSeedUuid } from '../../domain/workforce/Employee.ts';
import {
  WORKFORCE_IDENTITY_PROBABILITY_FEMALE,
  WORKFORCE_IDENTITY_PROBABILITY_MALE,
} from '../../constants/workforce.ts';

import firstNamesFemaleJson from '../../../../../../../data/personnel/names/firstNamesFemale.json' with { type: 'json' };
import firstNamesMaleJson from '../../../../../../../data/personnel/names/firstNamesMale.json' with { type: 'json' };
import lastNamesJson from '../../../../../../../data/personnel/names/lastNames.json' with { type: 'json' };
import { sampleTraitSet } from '../../domain/workforce/traits.ts';

const RANDOM_USER_ENDPOINT = 'https://randomuser.me/api/';
const RANDOM_USER_TIMEOUT_MS = 500;

const femaleFirstNames = firstNamesFemaleJson as readonly string[];
const maleFirstNames = firstNamesMaleJson as readonly string[];
const combinedFirstNames: readonly string[] = [
  ...new Set([...femaleFirstNames, ...maleFirstNames]),
];
const lastNames = lastNamesJson as readonly string[];

export type WorkforceIdentityGender = 'm' | 'f' | 'd';

export interface WorkforceIdentityTrait {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: 'positive' | 'negative';
}

export interface WorkforceIdentity {
  readonly firstName: string;
  readonly lastName: string;
  readonly gender: WorkforceIdentityGender;
  readonly traits: readonly WorkforceIdentityTrait[];
  readonly source: 'randomuser' | 'fallback';
}

export interface ResolveWorkforceIdentityOptions {
  /** Seed forwarded to the randomuser API for deterministic personas. */
  readonly randomUserSeed: string;
  /**
   * Deterministic RNG seed for employee specific draws.
   *
   * The stream identifier follows the documented `employee:<rngSeedUuid>` convention so
   * all employee-related randomness stays isolated from other RNG consumers.
   */
  readonly rngSeedUuid: EmployeeRngSeedUuid;
}

type RandomUserGender = string;

interface RandomUserResponse {
  readonly results?: readonly [
    {
      readonly gender?: RandomUserGender;
      readonly name?: { readonly first?: string; readonly last?: string };
    },
  ];
}

/**
 * Resolves a deterministic workforce identity by preferring the randomuser.me API and falling back to local pseudodata.
 */
export async function resolveWorkforceIdentity(
  options: ResolveWorkforceIdentityOptions,
): Promise<WorkforceIdentity> {
  const { randomUserSeed, rngSeedUuid } = options;

  if (!randomUserSeed) {
    throw new Error('randomUserSeed must be a non-empty string');
  }

  if (!rngSeedUuid) {
    throw new Error('rngSeedUuid must be a non-empty string');
  }

  const rngSeed = rngSeedUuid;
  const rng = createRng(rngSeed, `employee:${rngSeedUuid}`);
  const selectedTraits = selectTraits(rng);

  const remoteIdentity = await requestRandomUserIdentity(randomUserSeed);

  if (remoteIdentity) {
    return {
      ...remoteIdentity,
      traits: selectedTraits,
      source: 'randomuser',
    };
  }

  const fallbackIdentity = buildFallbackIdentity(rng);

  return {
    ...fallbackIdentity,
    traits: selectedTraits,
    source: 'fallback',
  };
}

async function requestRandomUserIdentity(
  randomUserSeed: string,
): Promise<Pick<WorkforceIdentity, 'firstName' | 'lastName' | 'gender'> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); }, RANDOM_USER_TIMEOUT_MS);

  try {
    const url = new URL(RANDOM_USER_ENDPOINT);
    url.searchParams.set('seed', randomUserSeed);
    url.searchParams.set('inc', 'gender,name');
    url.searchParams.set('noinfo', 'true');

    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RandomUserResponse;
    const result = payload.results?.[0];

    if (!result?.name?.first || !result.name.last) {
      return null;
    }

    return {
      firstName: result.name.first,
      lastName: result.name.last,
      gender: mapGender(result.gender),
    };
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function mapGender(gender?: RandomUserGender): WorkforceIdentityGender {
  if (gender === 'male') {
    return 'm';
  }

  if (gender === 'female') {
    return 'f';
  }

  return 'd';
}

function buildFallbackIdentity(
  rng: RandomNumberGenerator,
): Pick<WorkforceIdentity, 'firstName' | 'lastName' | 'gender'> {
  const gender = rollGender(rng);
  const firstName = selectFirstName(rng, gender);
  const lastName = selectLastName(rng);

  return {
    gender,
    firstName,
    lastName,
  };
}

function rollGender(rng: RandomNumberGenerator): WorkforceIdentityGender {
  const roll = rng();

  if (roll < WORKFORCE_IDENTITY_PROBABILITY_MALE) {
    return 'm';
  }

  if (roll < WORKFORCE_IDENTITY_PROBABILITY_FEMALE) {
    return 'f';
  }

  return 'd';
}

function selectFirstName(rng: RandomNumberGenerator, gender: WorkforceIdentityGender): string {
  const names =
    gender === 'm' ? maleFirstNames : gender === 'f' ? femaleFirstNames : combinedFirstNames;

  return names[Math.floor(rng() * names.length) % names.length];
}

function selectLastName(rng: RandomNumberGenerator): string {
  return lastNames[Math.floor(rng() * lastNames.length) % lastNames.length];
}

function selectTraits(rng: RandomNumberGenerator): readonly WorkforceIdentityTrait[] {
  const selected = sampleTraitSet({ rng });
  return selected.map((trait) => ({
    id: trait.id,
    name: trait.name,
    description: trait.description,
    type: trait.type,
  } satisfies WorkforceIdentityTrait));
}
