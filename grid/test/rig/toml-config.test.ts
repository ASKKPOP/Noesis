import { describe, it, expect } from 'vitest';
import { parse } from 'smol-toml';
// FUTURE IMPORT (Wave 2 creates this loader):
// import { loadRigConfigFromToml } from '../../../scripts/rig-config-loader.mjs';

const SAMPLE_INLINE = `
seed = "d4e5f6a7b8c9d0e1"
config_name = "small-10"
tick_budget = 1000
tick_rate_ms = 0
operator_tier_cap = "H3"
permissive = false

[[nous_manifest]]
name = "alice"
did = "did:noesis:1"
public_key = "key1"
region = "agora"
`;

describe('RigConfig TOML loader (RIG-01, D-14-03)', () => {
    it('FAILS UNTIL Wave 2: parses inline manifest into RigConfig', async () => {
        const raw = parse(SAMPLE_INLINE);
        expect(raw.seed).toBe('d4e5f6a7b8c9d0e1');
        expect(raw.tick_rate_ms).toBe(0);          // D-14-07 default
        expect(Array.isArray(raw.nous_manifest)).toBe(true);
        // Wave 2: const cfg = await loadRigConfigFromToml('/path/sample.toml');
        // expect(cfg.nousManifest).toHaveLength(1);
        // expect(cfg.nousManifestPath).toBeUndefined();
        expect.fail('Wave 2 must implement loadRigConfigFromToml in scripts/rig-config-loader.mjs');
    });

    it('FAILS UNTIL Wave 2: rejects when both nous_manifest AND nous_manifest_path are set (D-14-03)', () => {
        // const dual = `seed="x"\nconfig_name="x"\ntick_budget=1\noperator_tier_cap="H3"\npermissive=false\nnous_manifest_path="x.jsonl"\n[[nous_manifest]]\nname="a"\ndid="d"\npublic_key="k"\nregion="agora"`;
        // expect(() => loadRigConfigFromToml(dual)).toThrow(/mutually exclusive/);
        expect.fail('Wave 2 must enforce mutually-exclusive manifest source');
    });

    it('FAILS UNTIL Wave 2: external manifest path resolved relative to TOML file dir', () => {
        expect.fail('Wave 2 must resolve nous_manifest_path relative to TOML file dir');
    });
});
