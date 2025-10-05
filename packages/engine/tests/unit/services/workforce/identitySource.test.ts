import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EmployeeRngSeedUuid } from '@/backend/src/domain/workforce/Employee.js';
import { resolveWorkforceIdentity } from '@/backend/src/services/workforce/identitySource.js';

describe('resolveWorkforceIdentity', () => {
  const ONLINE_SEED = 'online-seed';
  const RNG_SEED_ALPHA = '018f29ce-0000-7000-8000-0000000000a1' as EmployeeRngSeedUuid;
  const RNG_SEED_BRAVO = '018f29ce-0000-7000-8000-0000000000b2' as EmployeeRngSeedUuid;
  const RNG_SEED_CHARLIE = '018f29ce-0000-7000-8000-0000000000c3' as EmployeeRngSeedUuid;

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns identity from randomuser when the HTTP request succeeds', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          results: [
            {
              gender: 'male',
              name: { first: 'Jordan', last: 'Rivera' },
            },
          ],
        }),
      } as unknown as Response),
    );

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const identity = await resolveWorkforceIdentity({
      randomUserSeed: ONLINE_SEED,
      rngSeedUuid: RNG_SEED_ALPHA,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = fetchMock.mock.calls[0][0] as URL;
    expect(requestUrl).toBeInstanceOf(URL);
    expect(requestUrl.searchParams.get('seed')).toBe(ONLINE_SEED);
    expect(requestUrl.searchParams.get('inc')).toBe('gender,name');
    expect(requestUrl.searchParams.get('noinfo')).toBe('true');

    expect(identity).toMatchObject({
      firstName: 'Jordan',
      lastName: 'Rivera',
      gender: 'm',
      source: 'randomuser',
    });

    expect(identity.traits).toMatchInlineSnapshot(`
      [
        {
          "description": "Slightly increases the chance of minor errors during maintenance tasks.",
          "id": "trait_clumsy",
          "name": "Clumsy",
          "type": "negative",
        },
      ]
    `);
  });

  it('falls back to pseudodata when the randomuser request times out', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>((_, init) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      }),
    );

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    vi.useFakeTimers();

    const identityPromise = resolveWorkforceIdentity({
      randomUserSeed: ONLINE_SEED,
      rngSeedUuid: RNG_SEED_BRAVO,
    });

    await vi.advanceTimersByTimeAsync(600);
    const identity = await identityPromise;

    expect(identity).toMatchObject({ source: 'fallback' });
    expect(identity).toMatchInlineSnapshot(`
      {
        "firstName": "Aria",
        "gender": "f",
        "lastName": "Banerjee",
        "source": "fallback",
        "traits": [
          {
            "description": "Accepts a slightly lower salary than their skills would normally demand.",
            "id": "trait_frugal",
            "name": "Frugal",
            "type": "positive",
          },
        ],
      }
    `);
  });

  it('uses deterministic pseudodata when the HTTP request fails', async () => {
    const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>(() =>
      Promise.reject(new Error('network unavailable')),
    );

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const identity = await resolveWorkforceIdentity({
      randomUserSeed: 'unused-seed',
      rngSeedUuid: RNG_SEED_CHARLIE,
    });

    expect(identity).toMatchObject({ source: 'fallback' });
    expect(identity).toMatchInlineSnapshot(`
      {
        "firstName": "Jessica",
        "gender": "f",
        "lastName": "Chavez",
        "source": "fallback",
        "traits": [
          {
            "description": "Slightly increases the chance of minor errors during maintenance tasks.",
            "id": "trait_clumsy",
            "name": "Clumsy",
            "type": "negative",
          },
        ],
      }
    `);
  });
});
