/**
 * SOLE PRODUCER for `law.triggered` audit event. Per D-12-10 / VOTE-04:
 *   This is the ONLY file in grid/src/** that may call `audit.append('law.triggered', ...)`.
 *   The grep gate `grid/test/governance/governance-producer-boundary.test.ts` enforces this contract.
 *
 * Pre-existing operator law-management code paths (governance-laws.ts) use
 * `operator.law_changed` — they do NOT call law.triggered directly. Per RESEARCH:
 * no pre-existing `audit.append('law.triggered', ...)` call sites existed before Phase 12.
 *
 * Forbidden siblings (any of these in grid/src/** = test failure):
 *   law.changed, law.applied, law.created, collective.law, operator.law_changed (for this event)
 *
 * `enacted_by` distinguishes collective governance-driven enactment from operator-driven
 * enactment (T-09-15 forensic defence). Phase 12 is the first time law.triggered is emitted
 * programmatically — the event existed in the allowlist since v2.0 but had no producer.
 *
 * Wall-clock ban: no Date.now / Math.random in this file. Tick is provided by caller.
 *
 * Phase 12 Wave 2 — VOTE-04 / D-12-10 / T-09-15 / CONTEXT-12.
 */

import { createHash } from 'node:crypto';
import type { AuditChain } from '../audit/chain.js';
import type { LogosEngine } from '../logos/engine.js';
import type { Law } from '../logos/types.js';
import { LAW_TRIGGERED_KEYS, type LawTriggeredPayload } from '../logos/types.js';
import { GOVERNANCE_FORBIDDEN_KEYS } from './types.js';

export interface AppendLawTriggeredInput {
    law: Law;
    enacted_by: 'collective' | 'operator';
    currentTick: number;
    logos: LogosEngine;
}

/**
 * Compute a canonical sha256 hash of a Law object for the `law_hash` payload key.
 * Canonical = sorted keys in the JSON serialization (stable across runs).
 */
function computeLawHash(law: Law): string {
    const canonical = JSON.stringify({
        description: law.description,
        id: law.id,
        ruleLogic: law.ruleLogic,
        severity: law.severity,
        status: law.status,
        title: law.title,
        ...(law.proposedBy !== undefined ? { proposedBy: law.proposedBy } : {}),
    });
    return createHash('sha256').update(canonical).digest('hex');
}

export async function appendLawTriggered(
    audit: AuditChain,
    input: AppendLawTriggeredInput,
): Promise<void> {
    // 1. Add law to LogosEngine BEFORE audit.append (DB-write-first pattern)
    input.logos.addLaw(input.law);

    // 2. Build closed payload
    const law_hash = computeLawHash(input.law);
    const payload: LawTriggeredPayload = {
        enacted_by: input.enacted_by,
        law_hash,
        law_id: input.law.id,
        triggered_at_tick: input.currentTick,
    };

    // 3. Closed-tuple shape check
    const actualKeys = Object.keys(payload).sort();
    const expectedKeys = [...LAW_TRIGGERED_KEYS].sort();
    if (actualKeys.length !== expectedKeys.length || !actualKeys.every((k, i) => k === expectedKeys[i])) {
        throw new Error(`law.triggered: payload keys ${JSON.stringify(actualKeys)} != ${JSON.stringify(expectedKeys)}`);
    }

    // 4. Forbidden-key check (vote-weighting keys must never appear)
    const forbiddenSet = new Set<string>(GOVERNANCE_FORBIDDEN_KEYS as readonly string[]);
    for (const k of actualKeys) {
        if (forbiddenSet.has(k)) {
            throw new Error(`law.triggered: forbidden key "${k}" in payload`);
        }
    }

    // 5. Audit append (sole producer line)
    audit.append('law.triggered', input.law.id, payload as unknown as Record<string, unknown>);
}
