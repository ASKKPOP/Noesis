/**
 * Phase 61 HOUSE-4 · Wave 0 — SKIP-STUB for the skill.blueprint_executed sole producer
 * (D-61-05 / R-61-07/08). Allowlist position 100 — the ONE new HOUSE-4 event.
 *
 * describe.skip: grid/src/audit/append-skill-blueprint-executed.ts lands in Wave 3 (clones the
 * append-treasury-parcel-revenue / appendSkillTaught triad). Deferred dynamic import
 * (Phase 58/59/60 Wave-0 pattern) defers module resolution until the suite is un-skipped.
 *
 * Closed 4-tuple {blueprint_hash, builder_civic_did_hash, parcel_id, tick}:
 *   - blueprint_hash HEX64 (the skill hash); builder_civic_did_hash HEX64;
 *   - parcel_id PARCEL_ID_RE; tick non-negative int;
 *   - actorDid = builder_civic_did_hash;
 *   - a 5th key throws (closed tuple); no FORBIDDEN_KEY_PATTERN key;
 *   - no recipe body, no sub-task content, no raw DID.
 */
import { describe, it, expect } from 'vitest';

const loadProducer = () => import('../../src/audit/append-skill-blueprint-executed.js');
const loadChain = () => import('../../src/audit/chain.js');

const PARCEL = 'genesis:residential:0001';
const BLUEPRINT_HASH = 'a'.repeat(64);
const BUILDER_HASH = 'c'.repeat(64);
const valid = {
    blueprint_hash: BLUEPRINT_HASH,
    builder_civic_did_hash: BUILDER_HASH,
    parcel_id: PARCEL,
    tick: 7,
};

describe.skip('Phase 61 — appendSkillBlueprintExecuted sole producer [Wave 3 un-skips]', () => {
    it('lands a valid event with the builder_civic_did_hash as actorDid', async () => {
        const { appendSkillBlueprintExecuted } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendSkillBlueprintExecuted(new AuditChain(), valid);
        expect(entry.eventType).toBe('skill.blueprint_executed');
        expect(entry.actorDid).toBe(BUILDER_HASH);
        expect(entry.payload).toEqual(valid);
    });

    it('keys are exactly the closed 4-tuple {blueprint_hash, builder_civic_did_hash, parcel_id, tick}', async () => {
        const { appendSkillBlueprintExecuted } = await loadProducer();
        const { AuditChain } = await loadChain();
        const entry = appendSkillBlueprintExecuted(new AuditChain(), valid);
        expect(Object.keys(entry.payload as object).sort())
            .toEqual(['blueprint_hash', 'builder_civic_did_hash', 'parcel_id', 'tick']);
    });

    it('rejects a non-HEX64 blueprint_hash', async () => {
        const { appendSkillBlueprintExecuted } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendSkillBlueprintExecuted(new AuditChain(), { ...valid, blueprint_hash: 'nope' }))
            .toThrow(/blueprint_hash|HEX64/);
    });

    it('rejects a non-HEX64 builder_civic_did_hash (the builder DID must be hashed)', async () => {
        const { appendSkillBlueprintExecuted } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendSkillBlueprintExecuted(new AuditChain(), { ...valid, builder_civic_did_hash: 'did:civic:noesis:alice' }))
            .toThrow(/builder_civic_did_hash|HEX64/);
    });

    it('rejects a malformed parcel_id (PARCEL_ID_RE)', async () => {
        const { appendSkillBlueprintExecuted } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendSkillBlueprintExecuted(new AuditChain(), { ...valid, parcel_id: 'bad-id' }))
            .toThrow(/parcel_id|PARCEL_ID/);
    });

    it('rejects a negative tick (non-negative int required)', async () => {
        const { appendSkillBlueprintExecuted } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendSkillBlueprintExecuted(new AuditChain(), { ...valid, tick: -1 }))
            .toThrow(/tick/);
    });

    it('rejects a 5th key (closed tuple)', async () => {
        const { appendSkillBlueprintExecuted } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendSkillBlueprintExecuted(new AuditChain(), { ...valid, recipe: 'leak' } as never))
            .toThrow();
    });

    it('rejects a FORBIDDEN_KEY_PATTERN key (no recipe/content/body crosses)', async () => {
        const { appendSkillBlueprintExecuted } = await loadProducer();
        const { AuditChain } = await loadChain();
        expect(() => appendSkillBlueprintExecuted(new AuditChain(), { ...valid, content: 'leak' } as never))
            .toThrow();
    });
});
