/**
 * Work Card — sole producer of work.stage_changed.
 *
 * Emitted once each time a Work's stage moves: when a goal is stated (from `enter`) and
 * on every later move round the loop. The card's wording stays in the `works` table;
 * only its sha256 crosses. Actor DID hashed. actorDid = actor_did_hash.
 * 6-key closed tuple (alpha).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { STAGE_EDGES, WORK_STAGES, type WorkStage } from '../work/work-logic.js';
import { HEX64_RE } from '../util/id-patterns.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const WORK_STAGE_CHANGED_KEYS = ['actor_did_hash', 'card_hash', 'from_stage', 'tick', 'to_stage', 'work_id'] as const;

export interface WorkStageChangedPayload {
    actor_did_hash: string;
    card_hash: string;
    /** `enter` when the Work is created. */
    from_stage: WorkStage | 'enter';
    tick: number;
    to_stage: WorkStage;
    work_id: string;
}

export function appendWorkStageChanged(audit: AuditChain, payload: WorkStageChangedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendWorkStageChanged: payload must be a plain object`);
    }
    if (typeof payload.actor_did_hash !== 'string' || !HEX64_RE.test(payload.actor_did_hash)) {
        throw new TypeError(`appendWorkStageChanged: actor_did_hash must match HEX64, got ${JSON.stringify(payload.actor_did_hash)}`);
    }
    if (typeof payload.card_hash !== 'string' || !HEX64_RE.test(payload.card_hash)) {
        throw new TypeError(`appendWorkStageChanged: card_hash must match HEX64, got ${JSON.stringify(payload.card_hash)}`);
    }
    if (!(WORK_STAGES as readonly string[]).includes(payload.to_stage)) {
        throw new TypeError(`appendWorkStageChanged: to_stage must be a stage, got ${JSON.stringify(payload.to_stage)}`);
    }
    const allowed: readonly string[] = payload.from_stage === 'enter' ? ['goal', 'define'] : (STAGE_EDGES[payload.from_stage] ?? []);
    if (!allowed.includes(payload.to_stage)) {
        throw new TypeError(`appendWorkStageChanged: no move from ${JSON.stringify(payload.from_stage)} to ${JSON.stringify(payload.to_stage)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendWorkStageChanged: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (typeof payload.work_id !== 'string' || !UUID_RE.test(payload.work_id)) {
        throw new TypeError(`appendWorkStageChanged: work_id must be a UUID, got ${JSON.stringify(payload.work_id)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== WORK_STAGE_CHANGED_KEYS.length || !actualKeys.every((k, i) => k === WORK_STAGE_CHANGED_KEYS[i])) {
        throw new TypeError(`appendWorkStageChanged: closed-tuple violation — expected ${JSON.stringify(WORK_STAGE_CHANGED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = {
        actor_did_hash: payload.actor_did_hash, card_hash: payload.card_hash, from_stage: payload.from_stage,
        tick: payload.tick, to_stage: payload.to_stage, work_id: payload.work_id,
    };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendWorkStageChanged: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('work.stage_changed', payload.actor_did_hash, cleanPayload);
}
