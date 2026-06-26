/**
 * Phase 37b (TYPE-B-02) — Sole-producer for registry.sponsorship_bond_posted (Polis-β).
 *
 * Emitted when a founding sponsor posts the refundable bond (10× the community-founding cost,
 * scaling nonlinearly with active Type B count). DIDs hashed. actorDid = sponsor_did_hash.
 * Closed 4-key (alphabetical).
 */
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
import { type RegistrySponsorshipBondPostedPayload, REGISTRY_SPONSORSHIP_BOND_POSTED_KEYS } from '../typeb/registry-types.js';

const HEX64_RE = /^[0-9a-f]{64}$/i;

export function appendRegistrySponsorshipBondPosted(audit: AuditChain, payload: RegistrySponsorshipBondPostedPayload): AuditEntry {
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendRegistrySponsorshipBondPosted: payload must be a plain object`);
    }
    if (!Number.isFinite(payload.bond_amount) || payload.bond_amount <= 0) {
        throw new TypeError(`appendRegistrySponsorshipBondPosted: bond_amount must be a positive number, got ${JSON.stringify(payload.bond_amount)}`);
    }
    if (typeof payload.sponsor_did_hash !== 'string' || !HEX64_RE.test(payload.sponsor_did_hash)) {
        throw new TypeError(`appendRegistrySponsorshipBondPosted: sponsor_did_hash must match HEX64, got ${JSON.stringify(payload.sponsor_did_hash)}`);
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendRegistrySponsorshipBondPosted: tick must be non-negative integer, got ${JSON.stringify(payload.tick)}`);
    }
    if (typeof payload.type_b_did_hash !== 'string' || !HEX64_RE.test(payload.type_b_did_hash)) {
        throw new TypeError(`appendRegistrySponsorshipBondPosted: type_b_did_hash must match HEX64, got ${JSON.stringify(payload.type_b_did_hash)}`);
    }
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== REGISTRY_SPONSORSHIP_BOND_POSTED_KEYS.length || !actualKeys.every((k, i) => k === REGISTRY_SPONSORSHIP_BOND_POSTED_KEYS[i])) {
        throw new TypeError(`appendRegistrySponsorshipBondPosted: closed-tuple violation — expected ${JSON.stringify(REGISTRY_SPONSORSHIP_BOND_POSTED_KEYS)}, got ${JSON.stringify(actualKeys)}`);
    }
    const cleanPayload = { bond_amount: payload.bond_amount, sponsor_did_hash: payload.sponsor_did_hash, tick: payload.tick, type_b_did_hash: payload.type_b_did_hash };
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) {
        throw new TypeError(`appendRegistrySponsorshipBondPosted: privacy violation — path=${privacy.offendingPath}, keyword=${privacy.offendingKeyword}`);
    }
    return audit.append('registry.sponsorship_bond_posted', payload.sponsor_did_hash, cleanPayload);
}
