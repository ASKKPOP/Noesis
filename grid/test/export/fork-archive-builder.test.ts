/**
 * buildForkArchive — the Grid half of a fork: what the Grid itself holds about the Nous
 * (manifest, civic credential, the Nous's slice of the audit chain). The Brain's memory
 * lives on the owner's machine and is never read or packed by the Grid.
 */
import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { extract } from 'tar';
import { buildForkArchive } from '../../src/export/fork-archive-builder.js';
import { AuditChain } from '../../src/audit/chain.js';

const NOUS = 'did:civic:noesis:test-nous';

function buildTestChain(nousDid: string): AuditChain {
    const chain = new AuditChain();
    chain.append('nous.spoke', nousDid, { message_hash: 'abc'.repeat(21) + 'a' });
    chain.append('trade.proposed', 'did:noesis:other:xyz', { subject: nousDid, amount: 10 });
    chain.append('nous.spoke', 'did:noesis:unrelated:zzz', { message_hash: 'def'.repeat(21) + 'a' });
    return chain;
}

function buildValidInput(chain: AuditChain) {
    return {
        nousDid: NOUS,
        gridId: 'genesis',
        auditChain: chain,
        civicVcJson: JSON.stringify({ '@context': ['https://www.w3.org/2018/credentials/v1'], type: 'VerifiableCredential', id: NOUS }),
        exportedAtTick: 42,
        nousExistenceDid: 'did:noesis:nous:abc123xyz',
        exportedAt: '2026-05-27T12:00:00Z',
    };
}

async function unpack(bytes: Buffer): Promise<Map<string, string>> {
    const dir = await fs.mkdtemp(join(tmpdir(), 'fork-archive-test-'));
    const tarPath = join(dir, 'archive.tar.gz');
    await fs.writeFile(tarPath, bytes);
    const paths: string[] = [];
    await extract({ file: tarPath, cwd: dir, onentry: (e) => { paths.push(e.path); } });
    const files = new Map<string, string>();
    for (const p of paths) files.set(p, await fs.readFile(join(dir, p), 'utf8'));
    await fs.rm(dir, { recursive: true, force: true });
    return files;
}

describe('buildForkArchive — the Grid half', () => {
    it('packs exactly the manifest, the civic credential and the audit slice', async () => {
        const result = await buildForkArchive(buildValidInput(buildTestChain(NOUS)));
        const files = await unpack(result.bytes);
        expect([...files.keys()].sort()).toEqual([
            'audit/chain-export.jsonl',
            'audit/chain-tail-hash.txt',
            'credentials/civic-did.vc.json',
            'manifest.json',
        ]);
    });

    it('never packs Brain memory, even when a data directory with .db files exists', async () => {
        const dir = await fs.mkdtemp(join(tmpdir(), 'fork-brain-data-'));
        await fs.writeFile(join(dir, 'other-nous.db'), 'SQLITE3-someone-else');
        const prev = process.env['BRAIN_DATA_DIR'];
        process.env['BRAIN_DATA_DIR'] = dir;
        try {
            const files = await unpack((await buildForkArchive(buildValidInput(buildTestChain(NOUS)))).bytes);
            expect([...files.keys()].some((p) => p.startsWith('memory/') || p.endsWith('.db'))).toBe(false);
        } finally {
            if (prev === undefined) delete process.env['BRAIN_DATA_DIR'];
            else process.env['BRAIN_DATA_DIR'] = prev;
            await fs.rm(dir, { recursive: true, force: true });
        }
    });

    it('the audit slice holds only entries that name this Nous', async () => {
        const files = await unpack((await buildForkArchive(buildValidInput(buildTestChain(NOUS)))).bytes);
        const lines = files.get('audit/chain-export.jsonl')!.split('\n');
        expect(lines).toHaveLength(2);
        expect(lines.every((l) => l.includes(NOUS))).toBe(true);
    });

    it('the manifest names the Grid half and the existence-DID, with no memory list', async () => {
        const files = await unpack((await buildForkArchive(buildValidInput(buildTestChain(NOUS)))).bytes);
        const manifest = JSON.parse(files.get('manifest.json')!);
        expect(manifest.format_version).toBe('2.0');
        expect(manifest.nous_existence_did).toBe('did:noesis:nous:abc123xyz');
        expect(manifest).not.toHaveProperty('memory_files');
    });
});

describe('buildForkArchive — determinism', () => {
    it('export_hash is deterministic across two builds of the same inputs', async () => {
        const input = buildValidInput(buildTestChain(NOUS));
        const a = await buildForkArchive(input);
        const b = await buildForkArchive(input);
        expect(a.manifestExportHash).toBe(b.manifestExportHash);
        expect(a.manifestExportHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('tar.gz bytes are identical across two builds of the same inputs', async () => {
        const input = buildValidInput(buildTestChain(NOUS));
        const a = await buildForkArchive(input);
        const b = await buildForkArchive(input);
        expect(a.bytes.equals(b.bytes)).toBe(true);
    });

    it('package_hash is sha256 of the full archive and differs from export_hash', async () => {
        const result = await buildForkArchive(buildValidInput(buildTestChain(NOUS)));
        expect(result.packageHash).toBe(createHash('sha256').update(result.bytes).digest('hex'));
        expect(result.manifestExportHash).not.toBe(result.packageHash);
    });
});

describe('buildForkArchive — privacy (T-43-secrets)', () => {
    it('manifest.json carries no credential-shaped strings', async () => {
        const files = await unpack((await buildForkArchive(buildValidInput(buildTestChain(NOUS)))).bytes);
        expect(files.get('manifest.json')).not.toMatch(/MYSQL_URL|DATABASE_URL|SECRET|KEY|TOKEN|PASSWORD/i);
    });
});
