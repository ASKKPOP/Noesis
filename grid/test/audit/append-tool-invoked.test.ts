/**
 * Phase 72b — appendToolInvoked emitter + sole-producer boundary for tool.invoked.
 * Tool activity is mirrored to the audit chain as DIGESTS only (no raw input/output).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { AuditChain } from '../../src/audit/chain.js';
import { appendToolInvoked } from '../../src/audit/append-tool-invoked.js';
import { ALLOWLIST_MEMBERS } from '../../src/audit/broadcast-allowlist.js';

const DID = 'did:noesis:sophia';
const HASH = 'a'.repeat(64);

function validPayload() {
    return { did: DID, tool_name: 'web_search', output_sha256: HASH, is_error: false };
}

describe('appendToolInvoked — emitter', () => {
    it('emits tool.invoked with a closed digest-only payload', () => {
        const chain = new AuditChain();
        const entry = appendToolInvoked(chain, DID, validPayload());
        expect(entry.eventType).toBe('tool.invoked');
        expect(entry.actorDid).toBe(DID);
        expect(entry.payload).toEqual({ did: DID, tool_name: 'web_search', output_sha256: HASH, is_error: false });
    });

    it('tool.invoked is in the frozen allowlist', () => {
        expect((ALLOWLIST_MEMBERS as readonly string[]).includes('tool.invoked')).toBe(true);
    });

    it('rejects a non-hex output_sha256', () => {
        const chain = new AuditChain();
        expect(() => appendToolInvoked(chain, DID, { ...validPayload(), output_sha256: 'nope' }))
            .toThrow(TypeError);
    });

    it('rejects a malformed tool_name (no raw/free-text names)', () => {
        const chain = new AuditChain();
        expect(() => appendToolInvoked(chain, DID, { ...validPayload(), tool_name: 'DROP TABLE' }))
            .toThrow(TypeError);
    });

    it('enforces the self-report invariant (payload.did must equal actorDid)', () => {
        const chain = new AuditChain();
        expect(() => appendToolInvoked(chain, DID, { ...validPayload(), did: 'did:noesis:hermes' }))
            .toThrow(TypeError);
    });

    it('refuses an extra key (closed-tuple)', () => {
        const chain = new AuditChain();
        // @ts-expect-error — intentional extra key
        expect(() => appendToolInvoked(chain, DID, { ...validPayload(), output: 'leak' }))
            .toThrow(TypeError);
    });

    it('requires is_error to be a boolean', () => {
        const chain = new AuditChain();
        // @ts-expect-error — wrong type
        expect(() => appendToolInvoked(chain, DID, { ...validPayload(), is_error: 'no' }))
            .toThrow(TypeError);
    });
});

// ── sole-producer boundary (mirrors telos-refined-producer-boundary) ──
const GRID_SRC = join(__dirname, '..', '..', 'src');
const SOLE_PRODUCER_FILE = 'audit/append-tool-invoked.ts';

function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...walk(full));
        else if (full.endsWith('.ts')) out.push(full);
    }
    return out;
}

describe('tool.invoked — sole producer boundary', () => {
    it('only append-tool-invoked.ts directly emits tool.invoked', () => {
        const offenders: string[] = [];
        for (const file of walk(GRID_SRC)) {
            const rel = relative(GRID_SRC, file).replace(/\\/g, '/');
            if (rel === SOLE_PRODUCER_FILE) continue;
            const src = readFileSync(file, 'utf8');
            const pattern = /\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]tool\.invoked['"]/s;
            if (pattern.test(src)) offenders.push(rel);
        }
        expect(offenders).toEqual([]);
    });
});
