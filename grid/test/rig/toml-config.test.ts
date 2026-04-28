import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadRigConfigFromToml } from '../../../scripts/rig-config-loader.mjs';

/**
 * RigConfig TOML loader tests (RIG-01, D-14-03).
 * Tests turn GREEN in Wave 2 — scripts/rig-config-loader.mjs now exists.
 */
describe('RigConfig TOML loader (RIG-01, D-14-03)', () => {
    it('parses external manifest path into RigConfig', async () => {
        // Use the real small-10.toml example from the repo
        const tomlPath = resolve('..', 'config', 'rigs', 'small-10.toml');
        const cfg = await loadRigConfigFromToml(tomlPath);

        expect(cfg.seed).toBe('d4e5f6a7b8c9d0e1');
        expect(cfg.configName).toBe('small-10');
        expect(cfg.tickBudget).toBe(1000);
        expect(cfg.tickRateMs).toBe(0);           // D-14-07 default
        expect(cfg.operatorTierCap).toBe('H3');
        expect(cfg.permissive).toBe(false);
        expect(Array.isArray(cfg.nousManifest)).toBe(true);
        expect(cfg.nousManifest).toHaveLength(10);
        expect(cfg.nousManifestPath).toBeDefined();   // external path preserved
    });

    it('rejects when both nous_manifest AND nous_manifest_path are set (D-14-03)', async () => {
        const dir = join(tmpdir(), `rig-test-${Date.now()}`);
        mkdirSync(dir, { recursive: true });

        // Create a manifest JSONL file
        const manifestPath = join(dir, 'test.jsonl');
        writeFileSync(manifestPath, '{"name":"a","did":"did:test:a","public_key":"k1","region":"agora"}\n');

        // Create TOML with BOTH inline and external — must be rejected
        const dual = [
            'seed = "d4e5f6a7b8c9d0e1"',
            'config_name = "test"',
            'tick_budget = 10',
            'operator_tier_cap = "H3"',
            'permissive = false',
            `nous_manifest_path = "test.jsonl"`,
            '[[nous_manifest]]',
            'name = "alice"',
            'did = "did:noesis:alice"',
            'public_key = "key1"',
            'region = "agora"',
        ].join('\n');

        const tomlPath = join(dir, 'dual.toml');
        writeFileSync(tomlPath, dual);

        await expect(loadRigConfigFromToml(tomlPath)).rejects.toThrow(/mutually exclusive/i);

        rmSync(dir, { recursive: true });
    });

    it('resolves external manifest path relative to TOML file dir', async () => {
        const dir = join(tmpdir(), `rig-test-${Date.now()}`);
        mkdirSync(join(dir, 'manifests'), { recursive: true });

        // Create JSONL manifest
        const manifestDir = join(dir, 'manifests');
        writeFileSync(
            join(manifestDir, 'agents.jsonl'),
            '{"name":"alpha","did":"did:test:alpha","public_key":"pub-alpha","region":"agora"}\n' +
            '{"name":"beta","did":"did:test:beta","public_key":"pub-beta","region":"library"}\n',
        );

        // TOML config with relative manifest path
        const tomlContent = [
            'seed = "abcdef0102030405"',
            'config_name = "rel-test"',
            'tick_budget = 50',
            'tick_rate_ms = 0',
            'operator_tier_cap = "H2"',
            'permissive = false',
            'nous_manifest_path = "manifests/agents.jsonl"',
        ].join('\n');

        const tomlPath = join(dir, 'rel-test.toml');
        writeFileSync(tomlPath, tomlContent);

        const cfg = await loadRigConfigFromToml(tomlPath);
        expect(cfg.nousManifest).toHaveLength(2);
        expect(cfg.nousManifest[0].name).toBe('alpha');
        expect(cfg.nousManifest[0].publicKey).toBe('pub-alpha'); // snake_case → camelCase
        expect(cfg.nousManifest[1].name).toBe('beta');

        rmSync(dir, { recursive: true });
    });
});
