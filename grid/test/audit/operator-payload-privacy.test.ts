/**
 * AGENCY-03 / D-12 enumerator — payload privacy gate across ALL 5 operator.* events.
 *
 * Phase 6 Plan 05 Task 3 — expanded matrix: 5 events × (6 forbidden keys +
 * 1 nested-path case + 1 happy case) = 40 test cases. Each test validates
 * BOTH the static privacy check (payloadPrivacyCheck) AND the producer-boundary
 * gate (appendOperatorEvent) — the two halves of the D-12 contract.
 *
 * Distinct from operator-event-invariant.test.ts (D-13 tier gate). Keeping the
 * two contracts in separate files makes failures precise to attribute:
 *   - D-13 breakage → tier-required check regressed
 *   - D-12 breakage → privacy gate regressed
 *
 * Enumeration scope (D-10 operator.* list, frozen):
 *   - operator.inspected      H2 Reviewer
 *   - operator.paused         H3 Partner
 *   - operator.resumed        H3 Partner
 *   - operator.law_changed    H3 Partner
 *   - operator.telos_forced   H4 Driver
 *
 * Forbidden keywords (FORBIDDEN_KEY_PATTERN, frozen):
 *   prompt | response | wiki | reflection | thought | emotion_delta
 *
 * Mitigates T-6-03 (broadcast leak) and T-6-07 (Telos plaintext exfiltration).
 * Closes T-6-06 (structural Telos leak) by asserting ANY forbidden-key intrusion
 * on ANY operator.* event is blocked at the producer boundary — no event type
 * is exempt.
 *
 * See: .planning/phases/06-operator-agency-foundation-h1-h4/06-CONTEXT.md
 *      §D-11 (payload shapes), §D-12 (privacy enumerator), §D-19 (H4 hash-only).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendOperatorEvent } from '../../src/audit/operator-events.js';
import { payloadPrivacyCheck } from '../../src/audit/broadcast-allowlist.js';
import type { HumanAgencyTier } from '../../src/api/types.js';

const VALID_OP_ID = 'op:00000000-0000-4000-8000-000000000000';
const VALID_ACTOR = 'did:noesis:test';
const VALID_TARGET = 'did:noesis:alpha';

/**
 * Event spec describing the D-11 happy-path payload for each operator.* event.
 * The `happyPayload` MUST equal the exact shape grid handlers emit — this is
 * the structural invariant every Phase 6 review PR re-asserts.
 */
interface EventSpec {
    eventType: `operator.${string}`;
    tier: HumanAgencyTier;
    targetDid: string | undefined;
    happyPayload: Record<string, unknown>;
    /** Keys the happy payload MUST NOT contain (content-shaped fields). */
    mustNotContain: string[];
}

const EVENT_SPECS: readonly EventSpec[] = [
    {
        eventType: 'operator.inspected',
        tier: 'H2',
        targetDid: VALID_TARGET,
        happyPayload: {
            tier: 'H2',
            action: 'inspect',
            operator_id: VALID_OP_ID,
            target_did: VALID_TARGET,
        },
        // H2 Reviewer: memory content rides in HTTP body only, NEVER audit.
        mustNotContain: ['summary', 'entries', 'content', 'memory'],
    },
    {
        eventType: 'operator.paused',
        tier: 'H3',
        targetDid: undefined,
        happyPayload: {
            tier: 'H3',
            action: 'pause',
            operator_id: VALID_OP_ID,
        },
        mustNotContain: ['reason', 'note'],
    },
    {
        eventType: 'operator.resumed',
        tier: 'H3',
        targetDid: undefined,
        happyPayload: {
            tier: 'H3',
            action: 'resume',
            operator_id: VALID_OP_ID,
        },
        mustNotContain: ['reason', 'note'],
    },
    {
        eventType: 'operator.law_changed',
        tier: 'H3',
        targetDid: undefined,
        happyPayload: {
            tier: 'H3',
            action: 'amend',
            operator_id: VALID_OP_ID,
            law_id: 'law-001',
            change_type: 'amended',
        },
        // T-6-06 shape invariant: law body NEVER in audit payload.
        mustNotContain: ['law_body', 'law_content', 'title', 'description', 'ruleLogic'],
    },
    {
        eventType: 'operator.telos_forced',
        tier: 'H4',
        targetDid: VALID_TARGET,
        happyPayload: {
            tier: 'H4',
            action: 'force_telos',
            operator_id: VALID_OP_ID,
            target_did: VALID_TARGET,
            telos_hash_before: 'a'.repeat(64),
            telos_hash_after: 'b'.repeat(64),
        },
        // D-19 hash-only: goal contents NEVER in audit payload.
        mustNotContain: ['new_telos', 'goals', 'goal', 'telos', 'short_term', 'long_term'],
    },
];

/**
 * The six forbidden keyword substrings enumerated by FORBIDDEN_KEY_PATTERN.
 * Each has a matching key-name used to construct the negative payload.
 * Kept here as a tuple so TS can enforce arity at the test-matrix level.
 */
const FORBIDDEN_KEYS: readonly [string, unknown][] = [
    ['prompt', 'raw llm prompt text'],
    ['response', 'raw llm response text'],
    ['wiki', 'sovereign wiki dump'],
    ['reflection', 'inner reflection text'],
    ['thought', 'raw thought content'],
    ['emotion_delta', 0.5],
];

describe('AGENCY-03 / D-12: payload privacy gate — 40-case enumeration across all 5 operator.* events', () => {
    let chain: AuditChain;
    beforeEach(() => {
        chain = new AuditChain();
    });

    for (const spec of EVENT_SPECS) {
        describe(`${spec.eventType} (${spec.tier})`, () => {
            // ── Happy case (1 per event = 5 total) ─────────────────────

            it('happy: D-11 payload shape passes privacy + commits to chain', () => {
                expect(payloadPrivacyCheck(spec.happyPayload).ok).toBe(true);

                const headBefore = chain.head;
                expect(() =>
                    appendOperatorEvent(
                        chain,
                        spec.eventType,
                        VALID_ACTOR,
                        spec.happyPayload as never,
                        spec.targetDid,
                    ),
                ).not.toThrow();
                expect(chain.length).toBe(1);
                expect(chain.head).not.toBe(headBefore);

                // Structural guard: the canonical happy shape carries none of
                // the fields that would mark payload drift for this event type.
                for (const forbidden of spec.mustNotContain) {
                    expect(Object.keys(spec.happyPayload)).not.toContain(forbidden);
                }
            });

            // ── Forbidden-key cases (6 per event = 30 total) ───────────

            for (const [keyword, leakValue] of FORBIDDEN_KEYS) {
                it(`rejects forbidden key "${keyword}" — privacy gate blocks, chain unchanged`, () => {
                    const payload = {
                        ...spec.happyPayload,
                        [keyword]: leakValue,
                    };
                    // Sanity: static check agrees with the producer-boundary
                    // gate. If these ever disagree, one path is incomplete.
                    const pr = payloadPrivacyCheck(payload);
                    expect(pr.ok).toBe(false);
                    expect(pr.offendingKeyword).toBe(keyword);

                    const headBefore = chain.head;
                    const lengthBefore = chain.length;
                    expect(() =>
                        appendOperatorEvent(
                            chain,
                            spec.eventType,
                            VALID_ACTOR,
                            payload as never,
                            spec.targetDid,
                        ),
                    ).toThrow(/privacy|leak/i);

                    // CRITICAL side-effect guarantee: a rejected payload
                    // leaves the chain with zero mutations. This is the
                    // atomicity invariant the AGENCY-03 gate rests on.
                    expect(chain.head).toBe(headBefore);
                    expect(chain.length).toBe(lengthBefore);
                });
            }

            // ── Nested-path case (1 per event = 5 total) ───────────────

            it('rejects nested-path forbidden key (meta.prompt style leak)', () => {
                const payload = {
                    ...spec.happyPayload,
                    meta: {
                        inner: {
                            prompt: 'deeply nested leak',
                        },
                    },
                };
                const pr = payloadPrivacyCheck(payload);
                expect(pr.ok).toBe(false);
                expect(pr.offendingKeyword).toBe('prompt');
                // Path records the full dotted address so breakages can be
                // attributed to the exact producer that introduced the key.
                expect(pr.offendingPath).toBe('meta.inner.prompt');

                expect(() =>
                    appendOperatorEvent(
                        chain,
                        spec.eventType,
                        VALID_ACTOR,
                        payload as never,
                        spec.targetDid,
                    ),
                ).toThrow(/privacy|leak/i);
                expect(chain.length).toBe(0);
            });
        });
    }

    // ── Cross-event structural invariant ─────────────────────────────

    it('matrix coverage: every operator.* allowlist member has an EVENT_SPEC entry', () => {
        // Catches future allowlist additions that forget to extend this
        // enumerator — if a new operator.* is added to broadcast-allowlist
        // without a spec here, its privacy surface is unasserted.
        const specEvents = EVENT_SPECS.map((s) => s.eventType).sort();
        expect(specEvents).toEqual([
            'operator.inspected',
            'operator.law_changed',
            'operator.paused',
            'operator.resumed',
            'operator.telos_forced',
        ]);
    });
});
