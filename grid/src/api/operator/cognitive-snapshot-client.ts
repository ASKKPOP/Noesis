/**
 * Fetch a Brain cognitive snapshot via HTTP.
 *
 * SECURITY: The closed-tuple key check (EXPECTED_KEYS) is the STRUCTURAL defense against
 * accidental plaintext leak from the Brain endpoint (D-25a-05). If the Brain response includes
 * any extra key beyond the expected 5, this client throws BrainMalformedResponseError and
 * the Grid proxy returns 503. Do NOT relax this check.
 *
 * The client is injectable via `brainFetch` so tests can inject a mock without monkey-patching
 * the global `fetch`. Pattern mirrors brain-hash-state-client.ts (AGENCY-05 D-03).
 *
 * Error class mapping:
 *   Network error / abort  → BrainUnreachableError
 *   HTTP non-200           → BrainUnknownDidError
 *   JSON parse failure     → BrainMalformedResponseError
 *   Schema mismatch        → BrainMalformedResponseError
 *
 * See: .planning/phases/25a-observer-surfaces/25a-CONTEXT.md D-25a-05
 */

import {
    BrainUnreachableError,
    BrainUnknownDidError,
    BrainMalformedResponseError,
} from './brain-http-errors.js';

export type { BrainUnreachableError, BrainUnknownDidError, BrainMalformedResponseError };

// ── Response shape ─────────────────────────────────────────────────────────────

export interface BrainCognitiveSnapshot {
    drive_levels: {
        hunger: number;
        curiosity: number;
        safety: number;
        boredom: number;
        loneliness: number;
    };
    last_sleep_tick: number;
    reflexion_count: number;
    rule_count: number;
    skill_titles_topk: string[];
}

// ── Closed-tuple key constants ─────────────────────────────────────────────────

/**
 * Sorted tuple of the 5 expected Brain cognitive-snapshot response keys.
 * Any extra or missing key triggers BrainMalformedResponseError.
 *
 * D-25a-05: This is the STRUCTURAL plaintext-leak defense at the client layer.
 * Do NOT add any plaintext content keys here. See FORBIDDEN_KEY_PATTERN in
 * grid/src/audit/broadcast-allowlist.ts and D-25a-05 in the planning docs.
 */
const EXPECTED_KEYS = [
    'drive_levels',
    'last_sleep_tick',
    'reflexion_count',
    'rule_count',
    'skill_titles_topk',
] as const;

/** Sorted drive keys for validating the nested drive_levels object. */
const EXPECTED_DRIVE_KEYS = [
    'boredom',
    'curiosity',
    'hunger',
    'loneliness',
    'safety',
] as const;

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetches the Brain cognitive snapshot for a given DID over HTTP.
 *
 * @param brainBaseUrl  Base URL of the Brain HTTP API (e.g. "http://brain-alpha:8090").
 *                      The client appends `/cognitive-snapshot/<did>`.
 * @param did           Target Nous DID (URL-encoded before appending).
 * @param brainFetch    `fetch`-compatible function (injectable for testing).
 * @param timeoutMs     Abort timeout in milliseconds (default 5 000 ms).
 *
 * @throws BrainUnreachableError   on network error or timeout.
 * @throws BrainUnknownDidError    on non-200 HTTP status.
 * @throws BrainMalformedResponseError  on invalid JSON or schema mismatch.
 */
export async function fetchCognitiveSnapshot(
    brainBaseUrl: string,
    did: string,
    brainFetch: typeof fetch,
    timeoutMs = 5_000,
): Promise<BrainCognitiveSnapshot> {
    const url = `${brainBaseUrl}/cognitive-snapshot/${encodeURIComponent(did)}`;
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
        response = await brainFetch(url, {
            signal: controller.signal,
            headers: {
                'X-Brain-Secret': process.env.BRAIN_HTTP_SECRET ?? '',
            },
        });
    } catch (err) {
        clearTimeout(timerId);
        throw new BrainUnreachableError(err);
    } finally {
        clearTimeout(timerId);
    }

    if (!response.ok) {
        throw new BrainUnknownDidError(did, response.status);
    }

    let body: unknown;
    try {
        body = await response.json();
    } catch (err) {
        throw new BrainMalformedResponseError(
            `JSON parse failure: ${err instanceof Error ? err.message : String(err)}`,
        );
    }

    // D-25a-05: structural plaintext-leak defense — closed-tuple key check.
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new BrainMalformedResponseError('body must be a plain object');
    }

    const actualKeys = Object.keys(body as Record<string, unknown>).sort();
    if (
        actualKeys.length !== EXPECTED_KEYS.length ||
        !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])
    ) {
        throw new BrainMalformedResponseError(
            `expected keys ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    const rec = body as Record<string, unknown>;

    // Validate drive_levels: must be an object with exactly the 5 expected drive keys.
    const driveLevels = rec['drive_levels'];
    if (driveLevels === null || typeof driveLevels !== 'object' || Array.isArray(driveLevels)) {
        throw new BrainMalformedResponseError('drive_levels must be a plain object');
    }
    const actualDriveKeys = Object.keys(driveLevels as Record<string, unknown>).sort();
    if (
        actualDriveKeys.length !== EXPECTED_DRIVE_KEYS.length ||
        !actualDriveKeys.every((k, i) => k === EXPECTED_DRIVE_KEYS[i])
    ) {
        throw new BrainMalformedResponseError(
            `drive_levels expected keys ${JSON.stringify(EXPECTED_DRIVE_KEYS)}, got ${JSON.stringify(actualDriveKeys)}`,
        );
    }

    // Validate skill_titles_topk: must be an array of strings.
    const skillTitles = rec['skill_titles_topk'];
    if (!Array.isArray(skillTitles) || !skillTitles.every((s) => typeof s === 'string')) {
        throw new BrainMalformedResponseError('skill_titles_topk must be an array of strings');
    }

    return rec as unknown as BrainCognitiveSnapshot;
}
