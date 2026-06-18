/**
 * appendToolInvoked — SOLE producer boundary for `tool.invoked` audit events (Phase 72b).
 *
 * A Nous's tool activity is mirrored to the audit chain as DIGESTS only: the city
 * sees *that* a Nous called a tool, never *what* it ran or returned. Mirrors the
 * appendTelosRefined discipline:
 *   1. Regex-guard every input (DID_RE, HEX64_RE, TOOL_NAME_RE).
 *   2. Closed 4-key payload — {did, tool_name, output_sha256, is_error}.
 *   3. payloadPrivacyCheck before chain.append.
 *
 * Any other file in grid/src/ calling audit.append('tool.invoked', …) fails the
 * producer-boundary invariant test (tool-invoked-producer-boundary.test.ts).
 */

import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

export const HEX64_RE = /^[0-9a-f]{64}$/;
export const DID_RE = /^did:noesis:[a-z0-9_\-]+$/i;
/** Tool names are lowercase identifiers (web_search, web_fetch, run_code). */
export const TOOL_NAME_RE = /^[a-z][a-z0-9_]{1,40}$/;

/** Closed 4-key payload for tool.invoked. */
export interface ToolInvokedPayload {
    readonly did: string;
    readonly tool_name: string;
    readonly output_sha256: string;
    readonly is_error: boolean;
}

const EXPECTED_KEYS = ['did', 'is_error', 'output_sha256', 'tool_name'] as const;

export function appendToolInvoked(
    audit: AuditChain,
    actorDid: string,
    payload: ToolInvokedPayload,
): AuditEntry {
    // 1. Regex / type guards.
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendToolInvoked: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`);
    }
    if (typeof payload?.did !== 'string' || !DID_RE.test(payload.did)) {
        throw new TypeError(`appendToolInvoked: invalid payload.did (DID_RE failed)`);
    }
    if (payload.did !== actorDid) {
        throw new TypeError(`appendToolInvoked: payload.did must equal actorDid (self-report invariant)`);
    }
    if (typeof payload.tool_name !== 'string' || !TOOL_NAME_RE.test(payload.tool_name)) {
        throw new TypeError(`appendToolInvoked: tool_name must match TOOL_NAME_RE`);
    }
    if (typeof payload.output_sha256 !== 'string' || !HEX64_RE.test(payload.output_sha256)) {
        throw new TypeError(`appendToolInvoked: output_sha256 must match HEX64_RE`);
    }
    if (typeof payload.is_error !== 'boolean') {
        throw new TypeError(`appendToolInvoked: is_error must be a boolean`);
    }

    // 2. Closed-tuple check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(
            `appendToolInvoked: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }

    // 3. Explicit reconstruction — no prototype pollution / inherited keys.
    const cleanPayload = {
        did: payload.did,
        tool_name: payload.tool_name,
        output_sha256: payload.output_sha256,
        is_error: payload.is_error,
    };

    // 4. Privacy gate (regression backstop — the 4 keys are natively clean).
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendToolInvoked: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }

    // 5. Commit.
    return audit.append('tool.invoked', actorDid, cleanPayload);
}
