import { describe, it, expect } from 'vitest';
import {
    ALLOWLIST,
    ALLOWLIST_MEMBERS,
    isAllowlisted,
    payloadPrivacyCheck,
    FORBIDDEN_KEY_PATTERN,
} from '../../src/audit/broadcast-allowlist.js';

describe('broadcast-allowlist: default-deny membership', () => {
    it('has exactly 117 locked v1..Phase 48b + human civic application + L2b procurement.* + L3b orbital.* event types', () => {
        expect(ALLOWLIST.size).toBe(152);
    });

    it('has frozen 152-member allowlist (ALLOWLIST_MEMBERS array length)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(152);
    });

    it('Phase 47 appends the 4 police.* events at positions 122-125', () => {
        expect(ALLOWLIST_MEMBERS[121]).toBe('police.complaint_filed');
        expect(ALLOWLIST_MEMBERS[122]).toBe('police.investigation_opened');
        expect(ALLOWLIST_MEMBERS[123]).toBe('police.charges_filed');
        expect(ALLOWLIST_MEMBERS[124]).toBe('police.sanction_executed');
    });

    it('Phase 48 appends the 2 library.* curation events at positions 126-127', () => {
        expect(ALLOWLIST_MEMBERS[125]).toBe('library.curator_elected');
        expect(ALLOWLIST_MEMBERS[126]).toBe('library.entry_curated');
    });

    it('Phase 49 appends the 2 community.* events at positions 128-129', () => {
        expect(ALLOWLIST_MEMBERS[127]).toBe('community.founded');
        expect(ALLOWLIST_MEMBERS[128]).toBe('community.joined');
    });

    it('Phase 49 Plan 2 appends posted+dissolved at positions 130-131', () => {
        expect(ALLOWLIST_MEMBERS[129]).toBe('community.posted');
        expect(ALLOWLIST_MEMBERS[130]).toBe('community.dissolved');
    });

    it('Phase 51 appends 3 mobility.* events at positions 132-134', () => {
        expect(ALLOWLIST_MEMBERS[131]).toBe('mobility.operator_abandoned');
        expect(ALLOWLIST_MEMBERS[132]).toBe('mobility.adoption_attempted');
        expect(ALLOWLIST_MEMBERS[133]).toBe('mobility.adoption_succeeded');
    });

    it('Phase 51 Plan 2 appends Type-B conversion events at 135-136', () => {
        expect(ALLOWLIST_MEMBERS[134]).toBe('mobility.converted_to_type_b');
        expect(ALLOWLIST_MEMBERS[135]).toBe('mobility.dormancy_entered');
    });

    it('Phase 45b appends 3 treasury.* events at positions 137-139', () => {
        expect(ALLOWLIST_MEMBERS[136]).toBe('treasury.endowment_granted');
        expect(ALLOWLIST_MEMBERS[137]).toBe('treasury.dormancy_entered');
        expect(ALLOWLIST_MEMBERS[138]).toBe('treasury.revived');
    });

    it('Phase 45b Plan 2 appends stipend + low-power at 140-141', () => {
        expect(ALLOWLIST_MEMBERS[139]).toBe('treasury.stipend_paid');
        expect(ALLOWLIST_MEMBERS[140]).toBe('treasury.low_power_entered');
    });

    it('Phase 37b appends 3 registry.type_b α/β events at 142-144', () => {
        expect(ALLOWLIST_MEMBERS[141]).toBe('registry.type_b_chartered');
        expect(ALLOWLIST_MEMBERS[142]).toBe('registry.sponsorship_bond_posted');
        expect(ALLOWLIST_MEMBERS[143]).toBe('registry.type_b_sponsored');
    });

    it('Phase 37b Plan 2 appends bond refund/slash + spawn at 145-147', () => {
        expect(ALLOWLIST_MEMBERS[144]).toBe('registry.sponsorship_bond_refunded');
        expect(ALLOWLIST_MEMBERS[145]).toBe('registry.sponsorship_bond_slashed');
        expect(ALLOWLIST_MEMBERS[146]).toBe('registry.type_b_spawned_by_parent');
    });

    it('Phase 53 appends 3 portal.grid_creation_* events at 148-150', () => {
        expect(ALLOWLIST_MEMBERS[147]).toBe('portal.grid_creation_requested');
        expect(ALLOWLIST_MEMBERS[148]).toBe('portal.grid_creation_approved');
        expect(ALLOWLIST_MEMBERS[149]).toBe('portal.grid_creation_rejected');
    });

    it('Phase 57 appends zoning.zone_amended at 151', () => {
        expect(ALLOWLIST_MEMBERS[150]).toBe('zoning.zone_amended');
    });

    it('Phase 57 Plan 2 appends zoning.residence_assigned at 152', () => {
        expect(ALLOWLIST_MEMBERS[151]).toBe('zoning.residence_assigned');
    });

    it.each([
        'nous.spawned',
        'nous.moved',
        'nous.spoke',
        'nous.direct_message',
        'trade.proposed',
        'trade.reviewed',
        'trade.settled',
        'law.triggered',
        'tick',
        'grid.started',
        'grid.stopped',
        // Phase 6 (AGENCY-02, AGENCY-03) — D-10 tuple order locked.
        'operator.inspected',
        'operator.paused',
        'operator.resumed',
        'operator.law_changed',
        'operator.telos_forced',
        // Phase 7 (DIALOG-02) — position 17 hash-only refinement.
        'telos.refined',
        // Phase 8 (AGENCY-05) — position 18 H5 Sovereign Operations.
        'operator.nous_deleted',
        // Phase 10a (DRIVE-03) — position 19 Ananke drive threshold crossings.
        'ananke.drive_crossed',
        // Phase 10b (BIOS-02) — position 20 Bios birth boundary.
        'bios.birth',
        // Phase 10b (BIOS-03) — position 21 Bios death boundary.
        'bios.death',
        // Phase 11 (WHISPER-04) — position 22 Nous↔Nous envelope emission.
        'nous.whispered',
        // Phase 12 (VOTE-01..04) — positions 23..26 governance events.
        'proposal.opened',
        'ballot.committed',
        'ballot.revealed',
        'proposal.tallied',
        // Phase 13 (REPLAY-02) — position 27 operator export audit event.
        'operator.exported',
        // Phase 22 (WEB3-04) — position 44 human portal first-connect.
        'human.joined',
        // Phase 23/24 — position 45 Cyber Coin transfer notification.
        'human.transferred',
        // Phase 25b (SANCTION-01..06 / D-25b-07/08) — positions 46..51 operator sanction events.
        'operator.muted',
        'operator.slashed',
        'operator.quarantined',
        'operator.forced_sleep',
        'operator.human_banned',
        'operator.human_frozen',
        // Phase 27 (CHAT-04) — Human-to-Nous message audit.
        'human.spoke',
        // Phase 28 (SPAWN-04) — Personal Nous spawn by human.
        'nous.spawned_by_human',
        // Phase 33 (OBS-08, OBS-09, OBS-08b / D-33-A1) — Portal auth lifecycle events.
        'portal.auth.login',
        'portal.auth.register',
        'human.identified',
    ])('allows %s', (eventType) => {
        expect(isAllowlisted(eventType)).toBe(true);
    });

    it.each([
        'brain.reflection.internal',
        'nous.thought',
        'wiki.updated',
        'unknown.event',
        '',
        'NOUS.MOVED', // case sensitive — must be exact
        'operator.unknown', // Phase 6: event-name namespace is allowlist-locked
    ])('denies %s', (eventType) => {
        expect(isAllowlisted(eventType)).toBe(false);
    });

    it('ALLOWLIST is frozen — runtime mutation throws', () => {
        expect(() => (ALLOWLIST as Set<string>).add('law.bypassed')).toThrow(TypeError);
        expect(() => (ALLOWLIST as Set<string>).delete('trade.reviewed')).toThrow(TypeError);
        expect(() => (ALLOWLIST as Set<string>).clear()).toThrow(TypeError);
        expect(ALLOWLIST.size).toBe(152);
    });

    it('Phase 6 operator.* tuple order: inspected < paused < resumed < law_changed < telos_forced', () => {
        // Iteration order of a Set preserves insertion order — used here as a
        // D-10 structural proof that the tuple was appended, not reshuffled.
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('grid.stopped')).toBeLessThan(idx('operator.inspected'));
        expect(idx('operator.inspected')).toBeLessThan(idx('operator.paused'));
        expect(idx('operator.paused')).toBeLessThan(idx('operator.resumed'));
        expect(idx('operator.resumed')).toBeLessThan(idx('operator.law_changed'));
        expect(idx('operator.law_changed')).toBeLessThan(idx('operator.telos_forced'));
    });

    it('includes nous.spawned_by_human at position 53 (index 52)', () => {
        expect(ALLOWLIST_MEMBERS.includes('nous.spawned_by_human')).toBe(true);
        expect(ALLOWLIST_MEMBERS[52]).toBe('nous.spawned_by_human');
    });

    it('exposes nous.spawned_by_human via the frozen ALLOWLIST set', () => {
        expect(ALLOWLIST.has('nous.spawned_by_human')).toBe(true);
    });

    // Phase 33 (D-33-A1) — positions 54/55/56 (0-indexed 53/54/55)
    it('includes portal.auth.login at position 54 (index 53)', () => {
        expect(ALLOWLIST_MEMBERS.includes('portal.auth.login')).toBe(true);
        expect(ALLOWLIST_MEMBERS[53]).toBe('portal.auth.login');
    });

    it('includes portal.auth.register at position 55 (index 54)', () => {
        expect(ALLOWLIST_MEMBERS.includes('portal.auth.register')).toBe(true);
        expect(ALLOWLIST_MEMBERS[54]).toBe('portal.auth.register');
    });

    it('includes human.identified at position 56 (index 55)', () => {
        expect(ALLOWLIST_MEMBERS.includes('human.identified')).toBe(true);
        expect(ALLOWLIST_MEMBERS[55]).toBe('human.identified');
    });

    it('Phase 33 entries appear after nous.spawned_by_human in declared order', () => {
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('nous.spawned_by_human')).toBeLessThan(idx('portal.auth.login'));
        expect(idx('portal.auth.login')).toBeLessThan(idx('portal.auth.register'));
        expect(idx('portal.auth.register')).toBeLessThan(idx('human.identified'));
    });

    it('Phase 36 VIS-05 additions are present', () => {
        expect(ALLOWLIST_MEMBERS.includes('portal.did_issued')).toBe(true);
        expect(ALLOWLIST_MEMBERS.includes('portal.did_revoked')).toBe(true);
        expect(ALLOWLIST_MEMBERS.includes('grid.recognition_granted')).toBe(true);
        expect(ALLOWLIST_MEMBERS.includes('grid.recognition_revoked')).toBe(true);
    });

    it('Phase 36 entries are at expected positions (0-indexed 56-59)', () => {
        expect(ALLOWLIST_MEMBERS[56]).toBe('portal.did_issued');
        expect(ALLOWLIST_MEMBERS[57]).toBe('portal.did_revoked');
        expect(ALLOWLIST_MEMBERS[58]).toBe('grid.recognition_granted');
        expect(ALLOWLIST_MEMBERS[59]).toBe('grid.recognition_revoked');
    });

    it('Phase 37 REG-06 additions are present', () => {
        expect(ALLOWLIST_MEMBERS.includes('registry.civic_did_issued')).toBe(true);
        expect(ALLOWLIST_MEMBERS.includes('registry.civic_did_revoked')).toBe(true);
        expect(ALLOWLIST_MEMBERS.includes('registry.business_did_registered')).toBe(true);
        expect(ALLOWLIST_MEMBERS.includes('registry.business_did_dissolved')).toBe(true);
    });

    it('Phase 37 entries are at expected positions (0-indexed 60-63)', () => {
        expect(ALLOWLIST_MEMBERS[60]).toBe('registry.civic_did_issued');        // Phase 37 (61)
        expect(ALLOWLIST_MEMBERS[61]).toBe('registry.civic_did_revoked');       // Phase 37 (62)
        expect(ALLOWLIST_MEMBERS[62]).toBe('registry.business_did_registered'); // Phase 37 (63)
        expect(ALLOWLIST_MEMBERS[63]).toBe('registry.business_did_dissolved');  // Phase 37 (64)
    });

    it('portal.notification_dispatched is intentionally NOT on the broadcast allowlist (D-36-19 private queue event)', () => {
        expect(ALLOWLIST_MEMBERS.includes('portal.notification_dispatched')).toBe(false);
    });

    it('Phase 25b sanction events appear at positions 46-51 (0-indexed: 45-50) in declared order', () => {
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        // Assert all 6 appear after human.transferred (pos 44, 0-indexed 43)
        expect(idx('human.transferred')).toBeLessThan(idx('operator.muted'));
        // Assert declared order: muted < slashed < quarantined < forced_sleep < human_banned < human_frozen
        expect(idx('operator.muted')).toBeLessThan(idx('operator.slashed'));
        expect(idx('operator.slashed')).toBeLessThan(idx('operator.quarantined'));
        expect(idx('operator.quarantined')).toBeLessThan(idx('operator.forced_sleep'));
        expect(idx('operator.forced_sleep')).toBeLessThan(idx('operator.human_banned'));
        expect(idx('operator.human_banned')).toBeLessThan(idx('operator.human_frozen'));
        // Assert 0-indexed positions 45-50
        expect(idx('operator.muted')).toBe(45);
        expect(idx('operator.slashed')).toBe(46);
        expect(idx('operator.quarantined')).toBe(47);
        expect(idx('operator.forced_sleep')).toBe(48);
        expect(idx('operator.human_banned')).toBe(49);
        expect(idx('operator.human_frozen')).toBe(50);
    });
});

describe('broadcast-allowlist: Phase 6 operator.* payload privacy (representative cases)', () => {
    it('H3 pause payload passes privacy', () => {
        expect(
            payloadPrivacyCheck({ tier: 'H3', action: 'pause', operator_id: 'op:test-1' }).ok,
        ).toBe(true);
    });

    it('H4 force-Telos hash-only payload passes privacy', () => {
        expect(
            payloadPrivacyCheck({
                tier: 'H4',
                action: 'force_telos',
                operator_id: 'op:test-2',
                target_did: 'did:noesis:test',
                telos_hash_before: 'a'.repeat(64),
                telos_hash_after: 'b'.repeat(64),
            }).ok,
        ).toBe(true);
    });

    it('H4 force-Telos payload carrying wiki leak is rejected (T-6-03)', () => {
        expect(
            payloadPrivacyCheck({ tier: 'H4', action: 'force_telos', wiki: 'leak' }).ok,
        ).toBe(false);
    });
});

describe('ALLOWLIST_MEMBERS Phase 42 (Plan 03)', () => {
    it('has count 81 after Phase 46 adds gov.* events (Phase 42 added p2p.*, Phase 43 added operator.nous_forked)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(152);
    });
    it('includes p2p.peer_announced at position 65 (index 64)', () => {
        expect(ALLOWLIST_MEMBERS[64]).toBe('p2p.peer_announced');
    });
    it('includes p2p.connection_opened at position 66 (index 65)', () => {
        expect(ALLOWLIST_MEMBERS[65]).toBe('p2p.connection_opened');
    });
    it('includes p2p.connection_closed at position 67 (index 66)', () => {
        expect(ALLOWLIST_MEMBERS[66]).toBe('p2p.connection_closed');
    });
    it('does NOT include p2p.signal_received (private WSS push, not audit per D-42-06)', () => {
        expect(ALLOWLIST_MEMBERS).not.toContain('p2p.signal_received');
    });
});

describe('ALLOWLIST_MEMBERS Phase 43 (Plan 01 — FORK-04)', () => {
    it('has count 81 after Phase 46 adds gov.* events (Phase 43 base was 68)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(152);
    });
    it('includes operator.nous_forked at position 68 (index 67)', () => {
        expect(ALLOWLIST_MEMBERS[67]).toBe('operator.nous_forked');
    });
    it('operator.nous_forked is in the frozen ALLOWLIST set', () => {
        expect(ALLOWLIST.has('operator.nous_forked')).toBe(true);
    });
});

describe('ALLOWLIST_MEMBERS Phase 44 (Plan 01 — MKT-06 / D-44-01 / D-44-03)', () => {
    // Phase 44 D-44-01: Allowlist 68 → 72 (+4 market.* events).
    // This combined assertion is ACTIVE and will FAIL until Plan 03 adds the 4 market.* entries
    // to ALLOWLIST_MEMBERS, growing the array from 68 to 72. Plan 03 turns it GREEN.
    it('Phase 44 allowlist grows to 72 with 4 market.* additions — market.listing_created, market.bid_placed, market.settled, market.disputed (FAILS until Plan 03 — D-44-01)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(152);
        expect(ALLOWLIST_MEMBERS).toContain('market.listing_created');
        expect(ALLOWLIST_MEMBERS).toContain('market.bid_placed');
        expect(ALLOWLIST_MEMBERS).toContain('market.settled');
        expect(ALLOWLIST_MEMBERS).toContain('market.disputed');
    });

    // Phase 44 D-44-03: irs.tax_collected was audit-chain-only until Phase 45.
    // Phase 45 (IRS-04) promotes it to the broadcast allowlist (position 73) — see the
    // 'ALLOWLIST_MEMBERS Phase 45 (IRS-04)' describe block below.
    it('irs.tax_collected IS on allowlist as of Phase 45 (promoted from Phase 44 audit-chain-only — D-44-03 → IRS-04)', () => {
        expect(ALLOWLIST_MEMBERS).toContain('irs.tax_collected');
    });
});

describe('broadcast-allowlist: payloadPrivacyCheck', () => {
    it('passes benign numeric/currency payload', () => {
        expect(payloadPrivacyCheck({ amount: 10, currency: 'ousia' })).toEqual({ ok: true });
    });

    it('passes empty object', () => {
        expect(payloadPrivacyCheck({})).toEqual({ ok: true });
    });

    it('passes null-valued allowed key', () => {
        expect(payloadPrivacyCheck({ amount: null })).toEqual({ ok: true });
    });

    it('flags top-level `prompt`', () => {
        const r = payloadPrivacyCheck({ prompt: 'You are Sophia' });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('prompt');
        expect(r.offendingKeyword).toBe('prompt');
    });

    it('flags nested `response` with dotted path', () => {
        const r = payloadPrivacyCheck({ meta: { response: 'I want to trade' } });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('meta.response');
        expect(r.offendingKeyword).toBe('response');
    });

    it('flags array-nested `thought`', () => {
        const r = payloadPrivacyCheck({ history: [{ thought: 'x' }] });
        expect(r.ok).toBe(false);
        expect(r.offendingPath).toBe('history.0.thought');
        expect(r.offendingKeyword).toBe('thought');
    });

    it('is case-insensitive', () => {
        expect(payloadPrivacyCheck({ Prompt: 'x' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ RESPONSE: 'x' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ WiKi: 'x' }).ok).toBe(false);
    });

    it('matches forbidden substring anywhere in key (user_prompt, prompting)', () => {
        expect(payloadPrivacyCheck({ user_prompt: 'x' }).ok).toBe(false);
        expect(payloadPrivacyCheck({ prompting: 'x' }).ok).toBe(false);
    });

    it('flags `wiki`', () => {
        const r = payloadPrivacyCheck({ wiki: 'page content' });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('wiki');
    });

    it('flags `reflection`', () => {
        const r = payloadPrivacyCheck({ reflection: 'summary' });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('reflection');
    });

    it('flags `emotion_delta`', () => {
        const r = payloadPrivacyCheck({ emotion_delta: { joy: 0.1 } });
        expect(r.ok).toBe(false);
        expect(r.offendingKeyword).toBe('emotion_delta');
    });

    it('FORBIDDEN_KEY_PATTERN covers all six forbidden keywords', () => {
        for (const kw of ['prompt', 'response', 'wiki', 'reflection', 'thought', 'emotion_delta']) {
            expect(FORBIDDEN_KEY_PATTERN.test(kw)).toBe(true);
        }
    });

    it('permits arrays of primitives with safe keys', () => {
        expect(payloadPrivacyCheck({ tags: ['a', 'b', 'c'] })).toEqual({ ok: true });
    });

    it('handles null and primitive payloads without throwing', () => {
        expect(payloadPrivacyCheck(null)).toEqual({ ok: true });
        expect(payloadPrivacyCheck('a string')).toEqual({ ok: true });
        expect(payloadPrivacyCheck(42)).toEqual({ ok: true });
    });
});

describe('ALLOWLIST_MEMBERS Phase 45 (IRS-04)', () => {
    it('Phase 45 allowlist grows to 75 with 3 IRS additions (72 → 75)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(152);
        expect(ALLOWLIST_MEMBERS).toContain('irs.tax_collected');
        expect(ALLOWLIST_MEMBERS).toContain('irs.disbursement_authorized');
        expect(ALLOWLIST_MEMBERS).toContain('irs.disbursement_executed');
    });

    it('irs.tax_collected is at position 73 (index 72)', () => {
        expect(ALLOWLIST_MEMBERS[72]).toBe('irs.tax_collected');
    });

    it('irs.disbursement_authorized is at position 74 (index 73)', () => {
        expect(ALLOWLIST_MEMBERS[73]).toBe('irs.disbursement_authorized');
    });

    it('irs.disbursement_executed is at position 75 (index 74)', () => {
        expect(ALLOWLIST_MEMBERS[74]).toBe('irs.disbursement_executed');
    });

    it('Phase 45 IRS entries appear in order after market.disputed', () => {
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('market.disputed')).toBeLessThan(idx('irs.tax_collected'));
        expect(idx('irs.tax_collected')).toBeLessThan(idx('irs.disbursement_authorized'));
        expect(idx('irs.disbursement_authorized')).toBeLessThan(idx('irs.disbursement_executed'));
    });
});

describe('ALLOWLIST_MEMBERS Phase 46 (CIVGOV-06)', () => {
    // Phase 46 D-46 / numbering reconciliation: ROADMAP literal "74 → 80" is stale
    // (Phase 45 actually shipped at 75). Correct delta is +6 → 75 → 81.
    it('Phase 46 allowlist grows to 81 with 6 gov.* additions (75 → 81)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(152);
        expect(ALLOWLIST_MEMBERS).toContain('gov.bill_drafted');
        expect(ALLOWLIST_MEMBERS).toContain('gov.bill_cosponsored');
        expect(ALLOWLIST_MEMBERS).toContain('gov.session_opened');
        expect(ALLOWLIST_MEMBERS).toContain('gov.session_closed');
        expect(ALLOWLIST_MEMBERS).toContain('gov.law_enacted');
        expect(ALLOWLIST_MEMBERS).toContain('gov.law_repealed');
    });

    it('gov.bill_drafted is at position 76 (index 75)', () => {
        expect(ALLOWLIST_MEMBERS[75]).toBe('gov.bill_drafted');
    });
    it('gov.bill_cosponsored is at position 77 (index 76)', () => {
        expect(ALLOWLIST_MEMBERS[76]).toBe('gov.bill_cosponsored');
    });
    it('gov.session_opened is at position 78 (index 77)', () => {
        expect(ALLOWLIST_MEMBERS[77]).toBe('gov.session_opened');
    });
    it('gov.session_closed is at position 79 (index 78)', () => {
        expect(ALLOWLIST_MEMBERS[78]).toBe('gov.session_closed');
    });
    it('gov.law_enacted is at position 80 (index 79)', () => {
        expect(ALLOWLIST_MEMBERS[79]).toBe('gov.law_enacted');
    });
    it('gov.law_repealed is at position 81 (index 80)', () => {
        expect(ALLOWLIST_MEMBERS[80]).toBe('gov.law_repealed');
    });

    it('Phase 46 gov entries appear in order after irs.disbursement_executed', () => {
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('irs.disbursement_executed')).toBeLessThan(idx('gov.bill_drafted'));
        expect(idx('gov.bill_drafted')).toBeLessThan(idx('gov.bill_cosponsored'));
        expect(idx('gov.bill_cosponsored')).toBeLessThan(idx('gov.session_opened'));
        expect(idx('gov.session_opened')).toBeLessThan(idx('gov.session_closed'));
        expect(idx('gov.session_closed')).toBeLessThan(idx('gov.law_enacted'));
        expect(idx('gov.law_enacted')).toBeLessThan(idx('gov.law_repealed'));
    });
});

describe('ALLOWLIST_MEMBERS Phase 48b (LAND-01..05) — Civic Land & Property', () => {
    it('Phase 48b allowlist grows to 86 with 5 zoning.*/treasury.* additions (81 → 86)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(152);
    });
    it('the 5 new members are present', () => {
        for (const e of [
            'zoning.parcel_purchased', 'treasury.parcel_revenue', 'zoning.structure_built',
            'zoning.structure_joined', 'zoning.structure_left',
        ]) {
            expect(ALLOWLIST_MEMBERS).toContain(e);
        }
    });
    it('positions 82-86 (index 81-85) in declared order', () => {
        expect(ALLOWLIST_MEMBERS[81]).toBe('zoning.parcel_purchased');
        expect(ALLOWLIST_MEMBERS[82]).toBe('treasury.parcel_revenue');
        expect(ALLOWLIST_MEMBERS[83]).toBe('zoning.structure_built');
        expect(ALLOWLIST_MEMBERS[84]).toBe('zoning.structure_joined');
        expect(ALLOWLIST_MEMBERS[85]).toBe('zoning.structure_left');
    });
    it('Phase 48b entries appear in order after gov.law_repealed', () => {
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('gov.law_repealed')).toBeLessThan(idx('zoning.parcel_purchased'));
        expect(idx('zoning.parcel_purchased')).toBeLessThan(idx('treasury.parcel_revenue'));
        expect(idx('treasury.parcel_revenue')).toBeLessThan(idx('zoning.structure_built'));
        expect(idx('zoning.structure_built')).toBeLessThan(idx('zoning.structure_joined'));
        expect(idx('zoning.structure_joined')).toBeLessThan(idx('zoning.structure_left'));
    });
});

describe('ALLOWLIST_MEMBERS Phase 59 (HOUSE-2 / D-59-01) — Interiors & Upkeep', () => {
    // Phase 59 D-59-01: Allowlist 91 → 95 (+4 zoning.*/treasury.* events).
    // EXPECTED-RED until Wave 4 lands the 4 members in grid/src/audit/broadcast-allowlist.ts.
    // Wave 4 turns this block GREEN — Wave 0 keeps it red BY DESIGN (drift guard).
    it('zoning.interior_extended is present (EXPECTED-RED until Wave 4 — D-59-01)', () => {
        expect(ALLOWLIST_MEMBERS).toContain('zoning.interior_extended');
    });
    it('zoning.condition_changed is present (EXPECTED-RED until Wave 4 — D-59-01)', () => {
        expect(ALLOWLIST_MEMBERS).toContain('zoning.condition_changed');
    });
    it('zoning.parcel_reclaimed is present (EXPECTED-RED until Wave 4 — D-59-01)', () => {
        expect(ALLOWLIST_MEMBERS).toContain('zoning.parcel_reclaimed');
    });
    it('treasury.upkeep_collected is present (EXPECTED-RED until Wave 4 — D-59-01)', () => {
        expect(ALLOWLIST_MEMBERS).toContain('treasury.upkeep_collected');
    });
});

describe('ALLOWLIST_MEMBERS Phase 60 (HOUSE-3 / D-60-09) — Commerce & Co-work', () => {
    // Phase 60 D-60-09: Allowlist 95 → 99 (+4 zoning.*/treasury.* events).
    // EXPECTED-RED until Wave 4 (60-05) lands the 4 members in grid/src/audit/broadcast-allowlist.ts.
    // Wave 4 turns this block GREEN — Wave 0 keeps it red BY DESIGN (drift guard).
    it('zoning.role_granted is present (EXPECTED-RED until Wave 4 / 60-05 — D-60-09)', () => {
        expect(ALLOWLIST_MEMBERS).toContain('zoning.role_granted');
    });
    it('zoning.role_revoked is present (EXPECTED-RED until Wave 4 / 60-05 — D-60-09)', () => {
        expect(ALLOWLIST_MEMBERS).toContain('zoning.role_revoked');
    });
    it('treasury.structure_revenue is present (EXPECTED-RED until Wave 4 / 60-05 — D-60-09)', () => {
        expect(ALLOWLIST_MEMBERS).toContain('treasury.structure_revenue');
    });
    it('zoning.cowork_session is present (EXPECTED-RED until Wave 4 / 60-05 — D-60-09)', () => {
        expect(ALLOWLIST_MEMBERS).toContain('zoning.cowork_session');
    });
});

describe('ALLOWLIST_MEMBERS Phase 61 (HOUSE-4 / D-61-05) — Skill Construction', () => {
    // Phase 61 D-61-05: Allowlist 99 → 100 (+1 skill.* event: skill.blueprint_executed).
    // EXPECTED-RED until Wave 3 (61-04) lands the member in grid/src/audit/broadcast-allowlist.ts.
    // Wave 3 turns this block GREEN — Wave 0 keeps it red BY DESIGN (drift guard).
    it('skill.blueprint_executed is present (EXPECTED-RED until Wave 3 / 61-04 — D-61-05)', () => {
        expect(ALLOWLIST_MEMBERS).toContain('skill.blueprint_executed');
    });
    it('skill.blueprint_executed is in the frozen ALLOWLIST set (EXPECTED-RED until Wave 3)', () => {
        expect(ALLOWLIST.has('skill.blueprint_executed')).toBe(true);
    });
});

describe('ALLOWLIST_MEMBERS L1b (D-MONEY-08) — due.* civic due events', () => {
    // L1b: Allowlist 107 → 110 (+3 due.* events: assessed, paid, delinquent).
    it.each(['due.assessed', 'due.paid', 'due.delinquent'])('allowlists %s', (e) => {
        expect(isAllowlisted(e)).toBe(true);
    });

    it('due.assessed is at position 108 (index 107)', () => {
        expect(ALLOWLIST_MEMBERS[107]).toBe('due.assessed');
    });
    it('due.paid is at position 109 (index 108)', () => {
        expect(ALLOWLIST_MEMBERS[108]).toBe('due.paid');
    });
    it('due.delinquent is at position 110 (index 109)', () => {
        expect(ALLOWLIST_MEMBERS[109]).toBe('due.delinquent');
    });

    it('due.* entries appear in order after tool.invoked', () => {
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('tool.invoked')).toBeLessThan(idx('due.assessed'));
        expect(idx('due.assessed')).toBeLessThan(idx('due.paid'));
        expect(idx('due.paid')).toBeLessThan(idx('due.delinquent'));
    });
});

describe('ALLOWLIST_MEMBERS L2b (D-MONEY-08 / L2b) — procurement.* RFP events', () => {
    // L2b: Allowlist 110 → 116 (+6 procurement.* events).
    it.each([
        'procurement.notice_issued',
        'procurement.bid_placed',
        'procurement.awarded',
        'procurement.attested',
        'procurement.settled',
        'procurement.cancelled',
    ])('allowlists %s', (e) => {
        expect(isAllowlisted(e)).toBe(true);
    });

    it('procurement.notice_issued is at position 111 (index 110)', () => {
        expect(ALLOWLIST_MEMBERS[110]).toBe('procurement.notice_issued');
    });
    it('procurement.bid_placed is at position 112 (index 111)', () => {
        expect(ALLOWLIST_MEMBERS[111]).toBe('procurement.bid_placed');
    });
    it('procurement.awarded is at position 113 (index 112)', () => {
        expect(ALLOWLIST_MEMBERS[112]).toBe('procurement.awarded');
    });
    it('procurement.attested is at position 114 (index 113)', () => {
        expect(ALLOWLIST_MEMBERS[113]).toBe('procurement.attested');
    });
    it('procurement.settled is at position 115 (index 114)', () => {
        expect(ALLOWLIST_MEMBERS[114]).toBe('procurement.settled');
    });
    it('procurement.cancelled is at position 116 (index 115)', () => {
        expect(ALLOWLIST_MEMBERS[115]).toBe('procurement.cancelled');
    });

    it('procurement.* entries appear in order after due.delinquent', () => {
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('due.delinquent')).toBeLessThan(idx('procurement.notice_issued'));
        expect(idx('procurement.notice_issued')).toBeLessThan(idx('procurement.bid_placed'));
        expect(idx('procurement.bid_placed')).toBeLessThan(idx('procurement.awarded'));
        expect(idx('procurement.awarded')).toBeLessThan(idx('procurement.attested'));
        expect(idx('procurement.attested')).toBeLessThan(idx('procurement.settled'));
        expect(idx('procurement.settled')).toBeLessThan(idx('procurement.cancelled'));
    });
});

describe('ALLOWLIST_MEMBERS L3b (D-MONEY-08 / L3b) — orbital.object_built', () => {
    // L3b: Allowlist 116 → 117 (+1 orbital.* event: orbital.object_built).
    it('allowlists orbital.object_built', () => {
        expect(isAllowlisted('orbital.object_built')).toBe(true);
    });

    it('orbital.object_built is at position 117 (index 116)', () => {
        expect(ALLOWLIST_MEMBERS[116]).toBe('orbital.object_built');
    });

    it('orbital.object_built appears after procurement.cancelled in declared order', () => {
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('procurement.cancelled')).toBeLessThan(idx('orbital.object_built'));
    });

    it('allowlist total is 120 after O2b (117 L3b + 3 human.approval.*)', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(152);
        expect(ALLOWLIST.size).toBe(152);
    });
});

describe('ALLOWLIST_MEMBERS O2b — human.approval_* audit events', () => {
    // O2b: Allowlist 117 → 120 (+3 human.approval.* events).
    it.each([
        'human.approval_requested',
        'human.approval_granted',
        'human.approval_denied',
    ])('allowlists %s', (e) => {
        expect(isAllowlisted(e)).toBe(true);
    });

    it('human.approval_requested is at position 118 (index 117)', () => {
        expect(ALLOWLIST_MEMBERS[117]).toBe('human.approval_requested');
    });

    it('human.approval_granted is at position 119 (index 118)', () => {
        expect(ALLOWLIST_MEMBERS[118]).toBe('human.approval_granted');
    });

    it('human.approval_denied is at position 120 (index 119)', () => {
        expect(ALLOWLIST_MEMBERS[119]).toBe('human.approval_denied');
    });

    it('human.approval.* entries appear in order after orbital.object_built', () => {
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('orbital.object_built')).toBeLessThan(idx('human.approval_requested'));
        expect(idx('human.approval_requested')).toBeLessThan(idx('human.approval_granted'));
        expect(idx('human.approval_granted')).toBeLessThan(idx('human.approval_denied'));
    });

    it('allowlist total is 121 after O2b + W4', () => {
        expect(ALLOWLIST_MEMBERS.length).toBe(152);
        expect(ALLOWLIST.size).toBe(152);
    });
});

describe('ALLOWLIST_MEMBERS W4 — portal.account_endowed (D-MONEY-09)', () => {
    // W4: Allowlist 120 → 121 (+1 portal.account_endowed, model-first endowment).
    it('allowlists portal.account_endowed', () => {
        expect(isAllowlisted('portal.account_endowed')).toBe(true);
    });

    it('portal.account_endowed is at position 121 (index 120), after human.approval_denied', () => {
        expect(ALLOWLIST_MEMBERS[120]).toBe('portal.account_endowed');
        const members = Array.from(ALLOWLIST);
        const idx = (k: string): number => members.indexOf(k);
        expect(idx('human.approval_denied')).toBeLessThan(idx('portal.account_endowed'));
    });
});
