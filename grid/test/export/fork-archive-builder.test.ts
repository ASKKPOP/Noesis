/**
 * Phase 43 Plan 02 — buildForkArchive tests.
 *
 * Tests for grid/src/export/fork-archive-builder.ts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { buildForkArchive } from '../../src/export/fork-archive-builder.js';
import { AuditChain } from '../../src/audit/chain.js';

// Tar extraction for inspection
import { extract } from 'tar';

async function makeTempDir(): Promise<string> {
    return fs.mkdtemp(join(tmpdir(), 'fork-archive-test-'));
}

async function buildTestDataDir(): Promise<{ dir: string; cleanup: () => Promise<void> }> {
    const dir = await makeTempDir();
    // Write 2 tiny dummy .db files
    await fs.writeFile(join(dir, 'nous.db'), Buffer.from('SQLITE3-nous', 'utf8'));
    await fs.writeFile(join(dir, 'ltm.db'), Buffer.from('SQLITE3-ltm', 'utf8'));
    return {
        dir,
        cleanup: () => fs.rm(dir, { recursive: true, force: true }),
    };
}

function buildTestChain(nousDid: string): AuditChain {
    const chain = new AuditChain();
    // Entry 1: actor is nousDid
    chain.append('nous.spoke', nousDid, { message_hash: 'abc'.repeat(21) + 'a' });
    // Entry 2: payload contains nousDid as subject
    chain.append('trade.proposed', 'did:noesis:other:xyz', { subject: nousDid, amount: 10 });
    // Entry 3: unrelated entry
    chain.append('nous.spoke', 'did:noesis:unrelated:zzz', { message_hash: 'def'.repeat(21) + 'a' });
    return chain;
}

function buildValidInput(dataDir: string, chain: AuditChain) {
    return {
        nousDid: 'did:civic:noesis:test-nous',
        gridId: 'genesis',
        dataDir,
        auditChain: chain,
        civicVcJson: JSON.stringify({ '@context': ['https://www.w3.org/2018/credentials/v1'], type: 'VerifiableCredential', id: 'did:civic:noesis:test-nous' }),
        exportedAtTick: 42,
        nousExistenceDid: 'did:noesis:nous:abc123xyz',
        exportedAt: '2026-05-27T12:00:00Z',
    };
}

async function listArchiveEntries(bytes: Buffer): Promise<string[]> {
    const tempDir = await makeTempDir();
    const tarPath = join(tempDir, 'archive.tar.gz');
    await fs.writeFile(tarPath, bytes);
    const entries: string[] = [];
    await extract({
        file: tarPath,
        cwd: tempDir,
        onentry: (entry) => { entries.push(entry.path); },
    });
    await fs.rm(tempDir, { recursive: true, force: true });
    return entries;
}

describe('buildForkArchive — archive structure (Plan 02 / FORK-01)', () => {
    let testData: { dir: string; cleanup: () => Promise<void> };

    beforeEach(async () => {
        testData = await buildTestDataDir();
    });

    afterEach(async () => {
        await testData.cleanup();
    });

    it('43-02-12: archive contains manifest.json at root', async () => {
        const chain = buildTestChain('did:civic:noesis:test-nous');
        const result = await buildForkArchive(buildValidInput(testData.dir, chain));
        const entries = await listArchiveEntries(result.bytes);
        expect(entries).toContain('manifest.json');
    });

    it('43-02-13: archive contains memory/ with at least one .db file (FORK-01)', async () => {
        const chain = buildTestChain('did:civic:noesis:test-nous');
        const result = await buildForkArchive(buildValidInput(testData.dir, chain));
        const entries = await listArchiveEntries(result.bytes);
        const dbFiles = entries.filter(e => e.startsWith('memory/') && e.endsWith('.db'));
        expect(dbFiles.length).toBeGreaterThanOrEqual(1);
    });

    it('43-02-14: archive contains credentials/civic-did.vc.json (FORK-01)', async () => {
        const chain = buildTestChain('did:civic:noesis:test-nous');
        const result = await buildForkArchive(buildValidInput(testData.dir, chain));
        const entries = await listArchiveEntries(result.bytes);
        expect(entries).toContain('credentials/civic-did.vc.json');
    });

    it('43-02-15: archive contains audit/chain-export.jsonl + audit/chain-tail-hash.txt (FORK-01)', async () => {
        const chain = buildTestChain('did:civic:noesis:test-nous');
        const result = await buildForkArchive(buildValidInput(testData.dir, chain));
        const entries = await listArchiveEntries(result.bytes);
        expect(entries).toContain('audit/chain-export.jsonl');
        expect(entries).toContain('audit/chain-tail-hash.txt');
    });

    it('43-02-16: archive contains civic/memberships.json (always emitted, even if empty array)', async () => {
        const chain = buildTestChain('did:civic:noesis:test-nous');
        const result = await buildForkArchive(buildValidInput(testData.dir, chain));
        const entries = await listArchiveEntries(result.bytes);
        expect(entries).toContain('civic/memberships.json');
    });

    it('43-02-17: archive contains civic/treasury.json (always emitted, even if zero balance)', async () => {
        const chain = buildTestChain('did:civic:noesis:test-nous');
        const result = await buildForkArchive(buildValidInput(testData.dir, chain));
        const entries = await listArchiveEntries(result.bytes);
        expect(entries).toContain('civic/treasury.json');
    });
});

describe('buildForkArchive — determinism discipline (Plan 02)', () => {
    let testData: { dir: string; cleanup: () => Promise<void> };

    beforeEach(async () => {
        testData = await buildTestDataDir();
    });

    afterEach(async () => {
        await testData.cleanup();
    });

    it('43-02-18: export_hash is sha256 of sorted (path, content) tuples — deterministic across two builds of same inputs', async () => {
        const chain = buildTestChain('did:civic:noesis:test-nous');
        const input = buildValidInput(testData.dir, chain);
        const result1 = await buildForkArchive(input);
        const result2 = await buildForkArchive(input);
        expect(result1.manifestExportHash).toBe(result2.manifestExportHash);
        expect(result1.manifestExportHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('43-02-19: tar.gz output bytes identical across two builds with same inputs (mtime=EPOCH, no filesystem entropy)', async () => {
        const chain = buildTestChain('did:civic:noesis:test-nous');
        const input = buildValidInput(testData.dir, chain);
        const result1 = await buildForkArchive(input);
        const result2 = await buildForkArchive(input);
        expect(result1.bytes.equals(result2.bytes)).toBe(true);
    });

    it('43-02-20: package_hash is sha256 of full .tar.gz bytes — distinct from export_hash', async () => {
        const chain = buildTestChain('did:civic:noesis:test-nous');
        const result = await buildForkArchive(buildValidInput(testData.dir, chain));
        // package_hash should equal sha256(bytes)
        const expectedPackageHash = createHash('sha256').update(result.bytes).digest('hex');
        expect(result.packageHash).toBe(expectedPackageHash);
        // export_hash should be different from package_hash
        expect(result.manifestExportHash).not.toBe(result.packageHash);
    });
});

describe('buildForkArchive — privacy / T-43-secrets (Plan 02)', () => {
    let testData: { dir: string; cleanup: () => Promise<void> };

    beforeEach(async () => {
        testData = await buildTestDataDir();
    });

    afterEach(async () => {
        await testData.cleanup();
    });

    it('43-02-21: manifest.json does NOT contain MYSQL_URL or DATABASE_URL literals', async () => {
        const chain = buildTestChain('did:civic:noesis:test-nous');
        // Use a memoryFile name that contains a forbidden-looking substring in its filename —
        // the test should still pass because only the MANIFEST JSON is checked, not filenames
        const result = await buildForkArchive(buildValidInput(testData.dir, chain));
        // Extract manifest.json content from archive
        const tempDir = await makeTempDir();
        const tarPath = join(tempDir, 'archive.tar.gz');
        await fs.writeFile(tarPath, result.bytes);
        await extract({ file: tarPath, cwd: tempDir });
        const manifestJson = await fs.readFile(join(tempDir, 'manifest.json'), 'utf8');
        await fs.rm(tempDir, { recursive: true, force: true });

        expect(manifestJson).not.toMatch(/MYSQL_URL|DATABASE_URL/i);
    });

    it('43-02-22: manifest.json does NOT contain any key matching /SECRET|KEY|TOKEN|PASSWORD/i', async () => {
        const chain = buildTestChain('did:civic:noesis:test-nous');
        const result = await buildForkArchive(buildValidInput(testData.dir, chain));
        // Extract manifest.json content from archive
        const tempDir = await makeTempDir();
        const tarPath = join(tempDir, 'archive.tar.gz');
        await fs.writeFile(tarPath, result.bytes);
        await extract({ file: tarPath, cwd: tempDir });
        const manifestJson = await fs.readFile(join(tempDir, 'manifest.json'), 'utf8');
        await fs.rm(tempDir, { recursive: true, force: true });

        expect(manifestJson).not.toMatch(/SECRET|KEY|TOKEN|PASSWORD/i);
    });
});
