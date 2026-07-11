/**
 * Phase 62 (D-MONEY-02) — Sole-producer for portal.account_linked.
 *
 * Emitted when a Nous proves ownership of its on-chain NousAccount by signing the
 * wallet-proof binding message (see account-link-store.ts). The binding itself is
 * transparent (so the commons can see which account a Civic-DID controls), but the
 * raw Civic-DID and the recovered owner EOA are HASHED before they cross the audit
 * boundary. The `nous_account` is the checksummed 0x smart-account address — a public
 * on-chain address, safe to carry in the clear (it is the whole point of the proof).
 * The raw signature NEVER leaves the store.
 *
 * Closed 4-key payload (alphabetical): { civic_did_hash, nous_account, owner_address_hash,
 * tick }. actorDid = civic_did_hash (the Nous whose account was linked).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Closed 4-key payload. Keys ALPHABETICAL. */
export interface PortalAccountLinkedPayload {
    readonly civic_did_hash: string;     // HEX64_RE — sha256 of the linked Civic-DID
    readonly nous_account: string;       // ADDRESS_RE — checksummed on-chain account (public)
    readonly owner_address_hash: string; // HEX64_RE — sha256 of the recovered owner EOA
    readonly tick: number;               // non-negative integer
}

const EXPECTED_KEYS = ['civic_did_hash', 'nous_account', 'owner_address_hash', 'tick'] as const;

export function appendPortalAccountLinked(
    audit: AuditChain,
    payload: PortalAccountLinkedPayload,
): AuditEntry {
    // 1. Type guard.
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendPortalAccountLinked: payload must be a plain object`);
    }
    // 2. Regex: civic_did_hash (HEX64).
    if (typeof payload.civic_did_hash !== 'string' || !HEX64_RE.test(payload.civic_did_hash)) {
        throw new TypeError(`appendPortalAccountLinked: civic_did_hash must match HEX64_RE, got ${JSON.stringify(payload.civic_did_hash)}`);
    }
    // 3. Regex: nous_account (0x-prefixed 40-hex address).
    if (typeof payload.nous_account !== 'string' || !ADDRESS_RE.test(payload.nous_account)) {
        throw new TypeError(`appendPortalAccountLinked: nous_account must match ADDRESS_RE, got ${JSON.stringify(payload.nous_account)}`);
    }
    // 4. Regex: owner_address_hash (HEX64).
    if (typeof payload.owner_address_hash !== 'string' || !HEX64_RE.test(payload.owner_address_hash)) {
        throw new TypeError(`appendPortalAccountLinked: owner_address_hash must match HEX64_RE, got ${JSON.stringify(payload.owner_address_hash)}`);
    }
    // 5. Non-negative integer: tick.
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendPortalAccountLinked: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    // 6. Closed-tuple structural check.
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendPortalAccountLinked: closed-tuple violation — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    // 7. Explicit reconstruction — no spread.
    const cleanPayload = {
        civic_did_hash: payload.civic_did_hash,
        nous_account: payload.nous_account,
        owner_address_hash: payload.owner_address_hash,
        tick: payload.tick,
    };
    // 8. Privacy gate.
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(
            `appendPortalAccountLinked: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`,
        );
    }
    // 9. Commit. actorDid = civic_did_hash (the linked Nous).
    return audit.append('portal.account_linked', payload.civic_did_hash, cleanPayload);
}
