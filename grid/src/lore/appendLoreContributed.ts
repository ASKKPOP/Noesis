/**
 * appendLoreContributed — Phase 20 sole producer for lore.contributed (pos 42).
 *
 * Closed-tuple: {category_tag, content_hash, contributor_did, tick} — 4 keys (D-20-12).
 * 3-keys-not-5: Brain sends {content_hash, category_tag} (2 keys); Grid injects contributor_did + tick.
 *
 * Validation discipline (10 steps — locked order):
 *   1. actorDid DID_RE
 *   2. contributor_did DID_RE
 *   3. Self-report: contributor_did === actorDid
 *   4. tick non-negative integer
 *   5. content_hash HEX64_RE (64-char hex)
 *   6. category_tag closed enum (VALID_LORE_CATEGORIES)
 *   7. Closed-tuple: Object.keys(payload).sort() === LORE_CONTRIBUTED_KEYS
 *   8. Explicit reconstruction (prototype-pollution defense)
 *   9. payloadPrivacyCheck
 *  10. audit.append (sole emit line)
 */
import type { AuditChain } from '../audit/chain.js';
import type { AuditEntry } from '../audit/types.js';
import { payloadPrivacyCheck } from '../audit/broadcast-allowlist.js';
import { LORE_CONTRIBUTED_KEYS, VALID_LORE_CATEGORIES, type LoreContributedPayload } from './types.js';

/** DID regex. Phase 48 (Library v3, CIVLIB-02): widened to accept Civic-DIDs and
 *  sub-namespaced DIDs so a Civic-DID holder contributing to the Library emits the
 *  existing lore.contributed/lore.cited (the v2.4 lore commons IS the Library backend).
 *  Backward-compatible — `did:noesis:<name>` still matches; adds `did:civic:noesis:…`
 *  and sub-namespaces (`did:noesis:nous:…`). */
export const DID_RE = /^did:(?:civic:)?noesis:[a-z0-9_:\-]+$/i;

/** Canonical event type string — imported by listeners to avoid literal duplication. */
export const LORE_CONTRIBUTED_EVENT = 'lore.contributed' as const;

/** 64-char lowercase hex (full sha256 hexdigest). */
export const HEX64_RE = /^[0-9a-f]{64}$/;

export function appendLoreContributed(
    audit: AuditChain,
    actorDid: string,
    payload: LoreContributedPayload,
): AuditEntry {
    // 1. actorDid format
    if (typeof actorDid !== 'string' || !DID_RE.test(actorDid)) {
        throw new TypeError(`appendLoreContributed: invalid actorDid ${JSON.stringify(actorDid)} (DID_RE failed)`);
    }
    // 2. contributor_did format
    if (typeof payload?.contributor_did !== 'string' || !DID_RE.test(payload.contributor_did)) {
        throw new TypeError(`appendLoreContributed: invalid contributor_did ${JSON.stringify(payload?.contributor_did)}`);
    }
    // 3. Self-report invariant
    if (payload.contributor_did !== actorDid) {
        throw new TypeError(`appendLoreContributed: self-report violation — contributor_did ${payload.contributor_did} !== actorDid ${actorDid}`);
    }
    // 4. tick non-negative integer
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendLoreContributed: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 5. content_hash 64-char lowercase hex
    if (typeof payload.content_hash !== 'string' || !HEX64_RE.test(payload.content_hash)) {
        throw new TypeError(`appendLoreContributed: invalid content_hash — must be 64-char lowercase hex`);
    }
    // 6. category_tag closed enum
    if (!VALID_LORE_CATEGORIES.has(payload.category_tag as string)) {
        throw new TypeError(`appendLoreContributed: unknown category_tag ${JSON.stringify(payload.category_tag)} — not in VALID_LORE_CATEGORIES`);
    }
    // 7. Closed-tuple enforcement
    const actualKeys = Object.keys(payload).sort();
    if (
        actualKeys.length !== LORE_CONTRIBUTED_KEYS.length ||
        !actualKeys.every((k, i) => k === LORE_CONTRIBUTED_KEYS[i])
    ) {
        throw new TypeError(
            `appendLoreContributed: closed-tuple violation — expected ${JSON.stringify(LORE_CONTRIBUTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
        );
    }
    // 8. Explicit reconstruction (prototype-pollution defense — never spread ...payload)
    const cleanPayload: LoreContributedPayload = {
        category_tag: payload.category_tag,
        content_hash: payload.content_hash,
        contributor_did: payload.contributor_did,
        tick: payload.tick,
    };
    // 9. Privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendLoreContributed: payload privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 10. Commit to chain (sole producer)
    return audit.append('lore.contributed', actorDid, cleanPayload);
}
