/**
 * Rig TOML config loader — Phase 14 RIG-01.
 *
 * Parses a TOML config file into a fully-typed RigConfig. Enforces D-14-03
 * (mutually exclusive nous_manifest vs nous_manifest_path). Resolves external
 * manifest path relative to the TOML file's directory.
 *
 * Invariants:
 *   - D-14-03: nous_manifest and nous_manifest_path are mutually exclusive; at least one required.
 *   - D-14-04: manifest entries carry name, did, public_key, region fields.
 *   - D-14-05: operator_tier_cap locked to {H1,H2,H3,H4,H5}; permissive is a mode selector.
 *   - D-14-07: tick_rate_ms defaults to 0 (headless).
 *
 * The returned RigConfig is compatible with grid/src/rig/types.ts RigConfig.
 */

import { parse as parseToml } from 'smol-toml';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const REQUIRED_FIELDS = ['seed', 'config_name', 'tick_budget', 'operator_tier_cap'];
const VALID_TIER_CAPS = ['H1', 'H2', 'H3', 'H4', 'H5'];

/**
 * Normalize a raw manifest entry (snake_case) into camelCase RigManifestEntry shape.
 * Validates required fields: name, did, public_key, region.
 */
function normalizeManifestEntry(raw, lineNo, source) {
    const required = ['name', 'did', 'public_key', 'region'];
    for (const f of required) {
        if (raw[f] === undefined) {
            throw new Error(
                `[rig-config-loader] manifest entry ${source}#${lineNo}: missing required field "${f}"`,
            );
        }
    }
    const entry = {
        name: raw.name,
        did: raw.did,
        publicKey: raw.public_key,
        region: raw.region,
    };
    if (raw.human_owner !== undefined) entry.humanOwner = raw.human_owner;
    if (raw.personality !== undefined) entry.personality = raw.personality;
    return entry;
}

/**
 * Load and parse an external JSONL manifest file.
 * Each line is a JSON object conforming to RigManifestEntry shape (snake_case input).
 */
function loadExternalManifest(absPath) {
    if (!existsSync(absPath)) {
        throw new Error(`[rig-config-loader] nous_manifest_path does not exist: ${absPath}`);
    }
    const raw = readFileSync(absPath, 'utf8');
    const entries = [];
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        let parsed;
        try {
            parsed = JSON.parse(line);
        } catch (err) {
            throw new Error(
                `[rig-config-loader] ${absPath}:${i + 1}: invalid JSON: ${err.message}`,
            );
        }
        entries.push(normalizeManifestEntry(parsed, i + 1, absPath));
    }
    if (entries.length === 0) {
        throw new Error(`[rig-config-loader] nous_manifest_path is empty: ${absPath}`);
    }
    return entries;
}

/**
 * Parse a TOML rig config file into a RigConfig object.
 *
 * @param {string} tomlPath - Absolute or relative path to the TOML config file.
 * @returns {Promise<import('../grid/src/rig/types.ts').RigConfig>}
 */
export async function loadRigConfigFromToml(tomlPath) {
    const absTomlPath = resolve(tomlPath);
    const raw = readFileSync(absTomlPath, 'utf8');
    const parsed = parseToml(raw);

    // Validate required fields
    for (const f of REQUIRED_FIELDS) {
        if (parsed[f] === undefined) {
            throw new Error(
                `[rig-config-loader] missing required field "${f}" in ${absTomlPath}`,
            );
        }
    }

    // Validate operator_tier_cap
    if (!VALID_TIER_CAPS.includes(parsed.operator_tier_cap)) {
        throw new Error(
            `[rig-config-loader] operator_tier_cap must be one of ${VALID_TIER_CAPS.join(', ')}, ` +
            `got "${parsed.operator_tier_cap}" in ${absTomlPath}`,
        );
    }

    // Validate seed
    if (typeof parsed.seed !== 'string' || parsed.seed.length < 8) {
        throw new Error(
            `[rig-config-loader] seed must be a string with length >= 8, got "${parsed.seed}"`,
        );
    }

    // Validate config_name
    if (!/^[a-z0-9-]+$/.test(parsed.config_name)) {
        throw new Error(
            `[rig-config-loader] config_name must match /^[a-z0-9-]+$/, got "${parsed.config_name}"`,
        );
    }

    // Validate tick_budget
    if (typeof parsed.tick_budget !== 'number' || !Number.isInteger(parsed.tick_budget) || parsed.tick_budget <= 0) {
        throw new Error(
            `[rig-config-loader] tick_budget must be a positive integer, got ${parsed.tick_budget}`,
        );
    }

    // D-14-03: mutually-exclusive manifest source
    const hasInline = Array.isArray(parsed.nous_manifest) && parsed.nous_manifest.length > 0;
    const hasExternal = typeof parsed.nous_manifest_path === 'string' && parsed.nous_manifest_path.length > 0;

    if (hasInline && hasExternal) {
        throw new Error(
            `[rig-config-loader] nous_manifest and nous_manifest_path are mutually exclusive (D-14-03) in ${absTomlPath}`,
        );
    }
    if (!hasInline && !hasExternal) {
        throw new Error(
            `[rig-config-loader] one of nous_manifest or nous_manifest_path is required in ${absTomlPath}`,
        );
    }

    let nousManifest;
    if (hasInline) {
        nousManifest = parsed.nous_manifest.map((e, i) =>
            normalizeManifestEntry(e, i + 1, absTomlPath),
        );
    } else {
        // Resolve external manifest path relative to TOML file's directory (D-14-03)
        const baseDir = dirname(absTomlPath);
        const manifestPath = isAbsolute(parsed.nous_manifest_path)
            ? parsed.nous_manifest_path
            : resolve(baseDir, parsed.nous_manifest_path);
        nousManifest = loadExternalManifest(manifestPath);
    }

    /** @type {import('../grid/src/rig/types.ts').RigConfig} */
    const rigConfig = {
        seed: parsed.seed,
        configName: parsed.config_name,
        tickBudget: parsed.tick_budget,
        tickRateMs: parsed.tick_rate_ms ?? 0,   // D-14-07: headless default
        operatorTierCap: parsed.operator_tier_cap,
        permissive: parsed.permissive ?? false,
        nousManifest,
    };

    // Include optional fields
    if (parsed.llm_fixture_path !== undefined) {
        rigConfig.llmFixturePath = parsed.llm_fixture_path;
    }
    if (hasExternal) {
        rigConfig.nousManifestPath = parsed.nous_manifest_path;
    }

    return rigConfig;
}
