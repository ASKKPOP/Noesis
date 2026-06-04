/**
 * Phase 46 (CIVGOV-06) — Government v3 audit payload shapes + closed-tuple keys.
 *
 * Mirrors the governance/types.ts discipline (Phase 12): closed alphabetical tuples,
 * hash-only cross-boundary (bill body NEVER appears — only title_hash/body_hash).
 * Operators do not legislate; these are civic (Nous) acts. Speaker is a civic role.
 *
 * No Date.now / Math.random — ticks come from the request boundary.
 * No runtime side-effects in this file. Types + tuples only.
 */

// ── gov.bill_drafted ─────────────────────────────────────────────────────────
/**
 * Closed 6-key payload. Keys ALPHABETICAL. actorDid = author_civic_did_hash.
 * D-46-01: the bill-body hash is named `content_hash` (NOT `body_hash`) — the frozen
 * FORBIDDEN_KEY_PATTERN privacy walker forbids the substring `body`, but allows
 * `content_hash` via its `content(?!_hash)` escape hatch (same convention as lore content_hash).
 * content_hash = sha256(bill body_text); the body itself never crosses the audit boundary.
 */
export interface GovBillDraftedPayload {
    readonly author_civic_did_hash: string; // HEX64 — sha256(author Civic-DID)
    readonly bill_id: string;               // UUID
    readonly category: string;              // non-empty, ≤63 chars
    readonly content_hash: string;          // HEX64 — sha256(body_text) (D-46-01: named content_hash, not body_hash)
    readonly tick: number;                  // non-negative integer
    readonly title_hash: string;            // HEX64 — sha256(title)
}
export const GOV_BILL_DRAFTED_KEYS = [
    'author_civic_did_hash', 'bill_id', 'category', 'content_hash', 'tick', 'title_hash',
] as const;

// ── gov.bill_cosponsored ──────────────────────────────────────────────────────
/** Closed 4-key payload. actorDid = cosponsor_civic_did_hash. */
export interface GovBillCosponsoredPayload {
    readonly bill_id: string;                   // UUID
    readonly cosponsor_civic_did_hash: string;  // HEX64
    readonly cosponsor_count: number;           // positive integer (count after this co-sponsorship)
    readonly tick: number;                      // non-negative integer
}
export const GOV_BILL_COSPONSORED_KEYS = [
    'bill_id', 'cosponsor_civic_did_hash', 'cosponsor_count', 'tick',
] as const;

// ── gov.session_opened ────────────────────────────────────────────────────────
/**
 * Closed 5-key payload. actorDid = speaker_civic_did_hash.
 * D-46-01: the session id is named `gov_session_id` (NOT `session_id`) — the frozen
 * FORBIDDEN_KEY_PATTERN forbids the exact key `session_id` (Phase 33 portal-auth anti-leak,
 * word-boundary anchored). The prefixed `gov_session_id` passes the walker (no \b before it)
 * and is the legislative-session UUID (not a login session token). DB column stays `session_id`.
 */
export interface GovSessionOpenedPayload {
    readonly bill_id: string;                 // UUID
    readonly debate_deadline_tick: number;    // positive integer (> opened tick)
    readonly gov_session_id: string;          // UUID (D-46-01: named gov_session_id, not session_id)
    readonly speaker_civic_did_hash: string;  // HEX64 — sha256(Speaker Civic-DID)
    readonly tick: number;                    // non-negative integer
}
export const GOV_SESSION_OPENED_KEYS = [
    'bill_id', 'debate_deadline_tick', 'gov_session_id', 'speaker_civic_did_hash', 'tick',
] as const;

// ── gov.session_closed ────────────────────────────────────────────────────────
export type SessionOutcome = 'advanced_to_vote' | 'withdrawn';
/** Closed 5-key payload. actorDid = speaker_civic_did_hash. D-46-01: gov_session_id, not session_id. */
export interface GovSessionClosedPayload {
    readonly bill_id: string;                 // UUID
    readonly gov_session_id: string;          // UUID (D-46-01)
    readonly outcome: SessionOutcome;
    readonly speaker_civic_did_hash: string;  // HEX64
    readonly tick: number;                    // non-negative integer
}
export const GOV_SESSION_CLOSED_KEYS = [
    'bill_id', 'gov_session_id', 'outcome', 'speaker_civic_did_hash', 'tick',
] as const;

// ── gov.law_enacted ───────────────────────────────────────────────────────────
/**
 * Closed 4-key payload. actorDid = law_id (a civic/system act, not a person).
 * supersedes_law_id is ALWAYS present for closed-tuple integrity; value is a UUID
 * (when this law replaces an existing one) or null.
 */
export interface GovLawEnactedPayload {
    readonly bill_id: string;                  // UUID
    readonly enacted_at_tick: number;          // non-negative integer
    readonly law_id: string;                   // UUID
    readonly supersedes_law_id: string | null; // UUID or null
}
export const GOV_LAW_ENACTED_KEYS = [
    'bill_id', 'enacted_at_tick', 'law_id', 'supersedes_law_id',
] as const;

// ── gov.law_repealed ──────────────────────────────────────────────────────────
/** Closed 3-key payload. actorDid = law_id. */
export interface GovLawRepealedPayload {
    readonly law_id: string;              // UUID
    readonly repealing_bill_id: string;   // UUID
    readonly tick: number;                // non-negative integer
}
export const GOV_LAW_REPEALED_KEYS = ['law_id', 'repealing_bill_id', 'tick'] as const;
