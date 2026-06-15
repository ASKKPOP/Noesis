/**
 * Groups & Holdings · Phase 69 / D-GROUP-01 — Sole-producer for group.project_started.
 *
 * Closed 3-key payload (keys ALPHABETICAL): {group_id, project_id, tick}.
 * actorDid = group_id (the project belongs to the Group).
 *
 * project_id is a UUID; the project TITLE stays Grid-side and never crosses.
 * Allowlist position 104.
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const GROUP_ID_RE = /^[a-z0-9_-]+:group:[a-z]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Closed 3-key payload. Keys ALPHABETICAL. */
export interface GroupProjectStartedPayload {
    readonly group_id: string;    // GROUP_ID_RE
    readonly project_id: string;  // UUID
    readonly tick: number;        // non-negative integer
}

const EXPECTED_KEYS = ['group_id', 'project_id', 'tick'] as const;

export function appendGroupProjectStarted(audit: AuditChain, payload: GroupProjectStartedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendGroupProjectStarted: payload must be a plain object`);
    }
    if (typeof payload.group_id !== 'string' || !GROUP_ID_RE.test(payload.group_id)) {
        throw new TypeError(`appendGroupProjectStarted: group_id must match GROUP_ID_RE, got ${JSON.stringify(payload.group_id)}`);
    }
    if (typeof payload.project_id !== 'string' || !UUID_RE.test(payload.project_id)) {
        throw new TypeError(`appendGroupProjectStarted: project_id must be a UUID, got ${JSON.stringify(payload.project_id)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendGroupProjectStarted: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendGroupProjectStarted: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        group_id: payload.group_id,
        project_id: payload.project_id,
        tick: payload.tick,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendGroupProjectStarted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    return audit.append('group.project_started', payload.group_id, cleanPayload);
}
