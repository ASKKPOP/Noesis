/**
 * Groups & Holdings · Phase 69 / D-GROUP-01 — Sole-producer for group.project_completed.
 *
 * Closed 4-key payload (keys ALPHABETICAL): {blueprint_hash, group_id, project_id, tick}.
 * actorDid = group_id. A completed research project PRODUCES a blueprint/skill: the
 *   blueprint_hash IS the Phase 18 skill hash (HEX64) that diffuses via the existing
 *   skill lineage. The project title + recipe body stay Grid-side. Allowlist position 105.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const GROUP_ID_RE = /^[a-z0-9_-]+:group:[a-z]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64_RE = /^[0-9a-f]{64}$/i;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface GroupProjectCompletedPayload {
    readonly blueprint_hash: string;  // HEX64 (the produced skill/recipe hash)
    readonly group_id: string;        // GROUP_ID_RE
    readonly project_id: string;      // UUID
    readonly tick: number;            // non-negative integer
}

const EXPECTED_KEYS = ['blueprint_hash', 'group_id', 'project_id', 'tick'] as const;

export function appendGroupProjectCompleted(audit: AuditChain, payload: GroupProjectCompletedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGroupProjectCompleted: payload must be a plain object`);
    }
    if (typeof payload.blueprint_hash !== 'string' || !HEX64_RE.test(payload.blueprint_hash)) {
        throw new TypeError(`appendGroupProjectCompleted: blueprint_hash must be 64-char hex (HEX64), got ${JSON.stringify(payload.blueprint_hash)}`);
    }
    if (typeof payload.group_id !== 'string' || !GROUP_ID_RE.test(payload.group_id)) {
        throw new TypeError(`appendGroupProjectCompleted: group_id must match GROUP_ID_RE, got ${JSON.stringify(payload.group_id)}`);
    }
    if (typeof payload.project_id !== 'string' || !UUID_RE.test(payload.project_id)) {
        throw new TypeError(`appendGroupProjectCompleted: project_id must be a UUID, got ${JSON.stringify(payload.project_id)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendGroupProjectCompleted: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendGroupProjectCompleted: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        blueprint_hash: payload.blueprint_hash,
        group_id: payload.group_id,
        project_id: payload.project_id,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGroupProjectCompleted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('group.project_completed', payload.group_id, cleanPayload);
}
