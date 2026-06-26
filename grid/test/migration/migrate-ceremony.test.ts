/**
 * Phase 50 (MIG-01/02/04) — MigrationCeremony state machine: export → commit → revert,
 * reversible until the first civic action.
 */
import { describe, it, expect, vi } from 'vitest';
import { MigrationCeremony, revertHttpStatus, type MigrationIO, type MigrationState, type NousBundleSummary } from '../../src/migration/migrate-ceremony.js';

const BUNDLES: NousBundleSummary[] = [
    { nousName: 'Sophia', rowCount: 1200, memoryHash: 'a'.repeat(64), migrationTick: 100 },
    { nousName: 'Hermes', rowCount: 800, memoryHash: 'b'.repeat(64), migrationTick: 100 },
];

function mockIO(opts: { civicCommitted?: boolean; nowTick?: number } = {}): { io: MigrationIO; state: () => MigrationState | null; deleted: () => boolean } {
    let state: MigrationState | null = null;
    let deleted = false;
    const io: MigrationIO = {
        readState: () => state,
        writeState: (s) => { state = s; },
        exportV26Memory: vi.fn(() => BUNDLES),
        deleteBundle: () => { deleted = true; },
        hasCivicActionSince: () => opts.civicCommitted ?? false,
        now: () => opts.nowTick ?? 500,
    };
    return { io, state: () => state, deleted: () => deleted };
}

describe('MigrationCeremony.exportBundle', () => {
    it('exports v2.6 memory + records state exported', () => {
        const m = mockIO();
        const bundles = new MigrationCeremony(m.io).exportBundle();
        expect(bundles).toEqual(BUNDLES);
        expect(m.state()?.phase).toBe('exported');
        expect(m.state()?.bundles).toHaveLength(2);
    });
});

describe('MigrationCeremony.commit', () => {
    it('commits after an export', () => {
        const m = mockIO({ nowTick: 777 });
        const c = new MigrationCeremony(m.io);
        c.exportBundle();
        expect(c.commit()).toEqual({ ok: true, committedTick: 777 });
        expect(m.state()?.phase).toBe('committed');
    });
    it('refuses to commit without an export (not_exported)', () => {
        expect(new MigrationCeremony(mockIO().io).commit()).toEqual({ ok: false, code: 'not_exported' });
    });
});

describe('MigrationCeremony.revert', () => {
    it('reverts after export (no commit yet)', () => {
        const m = mockIO();
        const c = new MigrationCeremony(m.io);
        c.exportBundle();
        expect(c.revert()).toEqual({ ok: true });
        expect(m.state()?.phase).toBe('reverted');
        expect(m.deleted()).toBe(true);
    });
    it('reverts after commit when NO civic action has committed', () => {
        const m = mockIO({ civicCommitted: false });
        const c = new MigrationCeremony(m.io);
        c.exportBundle(); c.commit();
        expect(c.revert()).toEqual({ ok: true });
    });
    it('🔒 blocks revert once a civic action has committed (migration_committed → 409)', () => {
        const m = mockIO({ civicCommitted: true });
        const c = new MigrationCeremony(m.io);
        c.exportBundle(); c.commit();
        const r = c.revert();
        expect(r).toEqual({ ok: false, code: 'migration_committed' });
        expect(revertHttpStatus(r)).toBe(409);
        expect(m.deleted()).toBe(false);
    });
    it('nothing_to_revert when no migration exists', () => {
        const r = new MigrationCeremony(mockIO().io).revert();
        expect(r).toEqual({ ok: false, code: 'nothing_to_revert' });
        expect(revertHttpStatus(r)).toBe(404);
    });
});
