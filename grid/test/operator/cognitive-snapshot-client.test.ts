/**
 * Unit tests for fetchCognitiveSnapshot HTTP client.
 *
 * All tests inject a mock `brainFetch` to avoid real network calls.
 * The tests exercise the closed-tuple schema check (structural plaintext defense),
 * error class mapping, and header forwarding.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    fetchCognitiveSnapshot,
} from '../../src/api/operator/cognitive-snapshot-client.js';
import {
    BrainUnreachableError,
    BrainUnknownDidError,
    BrainMalformedResponseError,
} from '../../src/api/operator/brain-http-errors.js';

const VALID_BRAIN_RESPONSE = {
    drive_levels: {
        hunger: 0.1,
        curiosity: 0.5,
        safety: 0.9,
        boredom: 0.2,
        loneliness: 0.3,
    },
    last_sleep_tick: 42,
    reflexion_count: 7,
    rule_count: 3,
    skill_titles_topk: ['planning', 'dialogue'],
};

function makeFetch(status: number, body: unknown): typeof fetch {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
    }) as unknown as typeof fetch;
}

function makeNetworkErrorFetch(): typeof fetch {
    return vi.fn().mockRejectedValue(new TypeError('network failure')) as unknown as typeof fetch;
}

function makeJsonErrorFetch(): typeof fetch {
    return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('invalid json')),
    }) as unknown as typeof fetch;
}

describe('fetchCognitiveSnapshot', () => {
    const BASE_URL = 'http://brain:8090';
    const DID = 'did:noesis:agent001';

    it('resolves with correct shape when Brain returns valid 5-key response', async () => {
        const brainFetch = makeFetch(200, VALID_BRAIN_RESPONSE);
        const result = await fetchCognitiveSnapshot(BASE_URL, DID, brainFetch);

        expect(result).toEqual(VALID_BRAIN_RESPONSE);
        expect(result.drive_levels.hunger).toBe(0.1);
        expect(result.skill_titles_topk).toEqual(['planning', 'dialogue']);
    });

    it('sends X-Brain-Secret header', async () => {
        const brainFetch = makeFetch(200, VALID_BRAIN_RESPONSE);
        process.env.BRAIN_HTTP_SECRET = 'test-secret-abc';
        await fetchCognitiveSnapshot(BASE_URL, DID, brainFetch);
        process.env.BRAIN_HTTP_SECRET = '';

        const calls = (brainFetch as ReturnType<typeof vi.fn>).mock.calls;
        expect(calls.length).toBe(1);
        const [url, init] = calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toContain('/cognitive-snapshot/');
        expect(init.headers['X-Brain-Secret']).toBe('test-secret-abc');
    });

    it('uses correct URL: brainBaseUrl + /cognitive-snapshot/ + encoded DID', async () => {
        const brainFetch = makeFetch(200, VALID_BRAIN_RESPONSE);
        const did = 'did:noesis:agent with spaces';
        await fetchCognitiveSnapshot(BASE_URL, did, brainFetch);
        const [url] = (brainFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
        expect(url).toBe(`${BASE_URL}/cognitive-snapshot/${encodeURIComponent(did)}`);
    });

    it('throws BrainUnknownDidError on non-200 status (401)', async () => {
        const brainFetch = makeFetch(401, {});
        await expect(fetchCognitiveSnapshot(BASE_URL, DID, brainFetch)).rejects.toThrow(BrainUnknownDidError);
    });

    it('throws BrainUnknownDidError on non-200 status (404)', async () => {
        const brainFetch = makeFetch(404, {});
        await expect(fetchCognitiveSnapshot(BASE_URL, DID, brainFetch)).rejects.toThrow(BrainUnknownDidError);
    });

    it('throws BrainUnreachableError on network error', async () => {
        const brainFetch = makeNetworkErrorFetch();
        await expect(fetchCognitiveSnapshot(BASE_URL, DID, brainFetch)).rejects.toThrow(BrainUnreachableError);
    });

    it('throws BrainMalformedResponseError on invalid JSON', async () => {
        const brainFetch = makeJsonErrorFetch();
        await expect(fetchCognitiveSnapshot(BASE_URL, DID, brainFetch)).rejects.toThrow(BrainMalformedResponseError);
    });

    it('[CRITICAL] throws BrainMalformedResponseError when Brain returns 6 keys (extra reflexion_text — structural plaintext defense)', async () => {
        const bodyWith6Keys = { ...VALID_BRAIN_RESPONSE, reflexion_text: 'secret content' };
        const brainFetch = makeFetch(200, bodyWith6Keys);
        await expect(fetchCognitiveSnapshot(BASE_URL, DID, brainFetch)).rejects.toThrow(BrainMalformedResponseError);
    });

    it('throws BrainMalformedResponseError when Brain returns only 4 keys (missing key)', async () => {
        const bodyWith4Keys = {
            drive_levels: VALID_BRAIN_RESPONSE.drive_levels,
            last_sleep_tick: 42,
            reflexion_count: 7,
            rule_count: 3,
            // skill_titles_topk missing
        };
        const brainFetch = makeFetch(200, bodyWith4Keys);
        await expect(fetchCognitiveSnapshot(BASE_URL, DID, brainFetch)).rejects.toThrow(BrainMalformedResponseError);
    });

    it('throws BrainMalformedResponseError when drive_levels is missing a drive', async () => {
        const bodyMissingDrive = {
            ...VALID_BRAIN_RESPONSE,
            drive_levels: {
                hunger: 0.1,
                curiosity: 0.5,
                safety: 0.9,
                boredom: 0.2,
                // loneliness missing
            },
        };
        const brainFetch = makeFetch(200, bodyMissingDrive);
        await expect(fetchCognitiveSnapshot(BASE_URL, DID, brainFetch)).rejects.toThrow(BrainMalformedResponseError);
    });

    it('throws BrainMalformedResponseError when skill_titles_topk is not an array', async () => {
        const bodyBadSkills = { ...VALID_BRAIN_RESPONSE, skill_titles_topk: 'not-an-array' };
        const brainFetch = makeFetch(200, bodyBadSkills);
        await expect(fetchCognitiveSnapshot(BASE_URL, DID, brainFetch)).rejects.toThrow(BrainMalformedResponseError);
    });

    it('throws BrainUnreachableError when fetch times out (timeoutMs exceeded)', async () => {
        const brainFetch: typeof fetch = vi.fn().mockImplementation((_url: unknown, init: RequestInit) => {
            return new Promise<Response>((_res, rej) => {
                const sig = init?.signal as AbortSignal | undefined;
                if (sig) {
                    sig.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
                }
                // Never resolve — simulates hang
            });
        }) as unknown as typeof fetch;

        await expect(
            fetchCognitiveSnapshot(BASE_URL, DID, brainFetch, 50),
        ).rejects.toThrow(BrainUnreachableError);
    });
});
