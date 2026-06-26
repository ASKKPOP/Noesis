/**
 * CLI Command Runner — parses args and dispatches commands.
 */

import { GenesisLauncher, GENESIS_CONFIG, TEST_CONFIG, MigrationCeremony } from '@noesis/grid';
import type { GenesisConfig, MigrationIO, MigrationState, NousBundleSummary } from '@noesis/grid';
import { spawn as nodeSpawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

let launcher: GenesisLauncher | null = null;

export function run(args: string[]): void {
    const command = args[0];

    switch (command) {
        case 'genesis':
            cmdGenesis(args.slice(1));
            break;
        case 'status':
            cmdStatus();
            break;
        case 'spawn':
            cmdSpawn(args.slice(1));
            break;
        case 'regions':
            cmdRegions();
            break;
        case 'laws':
            cmdLaws();
            break;
        case 'audit':
            cmdAudit(args.slice(1));
            break;
        case 'stop':
            cmdStop();
            break;
        case 'brain':
            cmdBrain(args.slice(1));
            break;
        case 'migrate':
            cmdMigrate(args.slice(1));
            break;
        case 'help':
        case '--help':
        case '-h':
        case undefined:
            cmdHelp();
            break;
        default:
            console.error(`Unknown command: ${command}`);
            cmdHelp();
            process.exitCode = 1;
    }
}

function cmdGenesis(args: string[]): void {
    const useTest = args.includes('--test');
    const config: GenesisConfig = useTest ? TEST_CONFIG : GENESIS_CONFIG;

    launcher = new GenesisLauncher(config);
    launcher.bootstrap();
    launcher.start();

    const s = launcher.state;
    console.log(`Grid "${s.gridName}" launched at ${s.gridDomain}`);
    console.log(`  Regions: ${s.regionCount} | Laws: ${s.activeLaws} | Nous: ${s.nousCount}`);
    console.log(`  Clock running at ${config.tickRateMs}ms/tick`);
}

function cmdStatus(): void {
    if (!launcher) {
        console.log('No Grid running. Use "noesis genesis" to launch.');
        return;
    }
    const s = launcher.state;
    console.log(`Grid: ${s.gridName} (${s.gridDomain})`);
    console.log(`  Tick: ${s.tick} | Epoch: ${s.epoch}`);
    console.log(`  Nous: ${s.nousCount} | Regions: ${s.regionCount}`);
    console.log(`  Laws: ${s.activeLaws} | Audit: ${s.auditEntries}`);
    console.log(`  Running: ${s.running}`);
}

function cmdSpawn(args: string[]): void {
    if (!launcher) {
        console.error('No Grid running.');
        return;
    }
    const name = args[0];
    if (!name) {
        console.error('Usage: noesis spawn <name>');
        return;
    }
    const did = `did:key:${name.toLowerCase()}-${Date.now()}`;
    const region = args[1] ?? launcher.space.allRegions()[0]?.id ?? 'agora';
    launcher.spawnNous(name, did, `pk-${name}`, region);
    console.log(`Spawned ${name} (${did}) in ${region}`);
}

function cmdRegions(): void {
    if (!launcher) {
        console.error('No Grid running.');
        return;
    }
    for (const r of launcher.space.allRegions()) {
        const count = launcher.space.getNousInRegion(r.id).length;
        console.log(`  ${r.name} (${r.id}) — ${r.regionType}, capacity ${r.capacity}, ${count} Nous`);
    }
}

function cmdLaws(): void {
    if (!launcher) {
        console.error('No Grid running.');
        return;
    }
    for (const law of launcher.logos.activeLaws()) {
        console.log(`  [${law.id}] ${law.title} — ${law.description}`);
    }
}

function cmdAudit(args: string[]): void {
    if (!launcher) {
        console.error('No Grid running.');
        return;
    }
    const limit = parseInt(args[0] ?? '10', 10);
    const entries = launcher.audit.query({ limit });
    for (const e of entries) {
        console.log(`  [${e.eventType}] ${e.actorDid} — ${JSON.stringify(e.payload)}`);
    }
}

function cmdStop(): void {
    if (!launcher) {
        console.error('No Grid running.');
        return;
    }
    launcher.stop();
    console.log('Grid stopped.');
    launcher = null;
}

/**
 * Launch a Nous brain process.
 *
 * Usage:
 *   noesis brain <name> [--adapter ollama|hermes] [--model <model>] [--region <region>]
 *
 * Flags:
 *   --adapter   Brain adapter: 'ollama' (default) or 'hermes'
 *   --model     LLM model override
 *   --region    Starting region (default: Agora Central)
 *   --config    Path to Nous YAML config (default: data/nous/<name>.yaml)
 *   --dry-run   Print the launch command without executing it
 */
function cmdBrain(args: string[]): void {
    const name = args[0];
    if (!name || name.startsWith('--')) {
        console.error('Usage: noesis brain <name> [--adapter ollama|hermes] [--model <model>] [--region <region>] [--dry-run]');
        process.exitCode = 1;
        return;
    }

    // Parse flags
    const adapterIdx = args.indexOf('--adapter');
    const adapter = adapterIdx !== -1 ? (args[adapterIdx + 1] ?? 'ollama') : 'ollama';
    const modelIdx = args.indexOf('--model');
    const model = modelIdx !== -1 ? (args[modelIdx + 1] ?? '') : '';
    const regionIdx = args.indexOf('--region');
    const region = regionIdx !== -1 ? (args[regionIdx + 1] ?? 'Agora Central') : 'Agora Central';
    const configIdx = args.indexOf('--config');
    const dryRun = args.includes('--dry-run');

    // Resolve repo root — dist/commands/runner.js is 3 dirs below cli/, which is 1 below repo root.
    // fileURLToPath handles percent-encoded Unicode characters (e.g. Noēsis).
    const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
    // Nous configs live under brain/data/nous/ within the repo
    const defaultConfigPath = join(repoRoot, 'brain', 'data', 'nous', `${name}.yaml`);
    const configPath = configIdx !== -1 ? (args[configIdx + 1] ?? defaultConfigPath) : defaultConfigPath;

    if (!existsSync(configPath)) {
        console.error(`Config not found: ${configPath}`);
        console.error(`Create data/nous/${name}.yaml or pass --config <path>`);
        process.exitCode = 1;
        return;
    }

    // Resolve brain venv python
    const brainDir = join(repoRoot, 'brain');
    const venvPython = join(brainDir, '.venv', 'bin', 'python');
    const pythonBin = existsSync(venvPython) ? venvPython : 'python3';

    // Build environment
    const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        NOUS_NAME: name,
        NOUS_CONFIG: configPath,
        NOUS_REGION: region,
    };

    if (adapter === 'hermes') {
        env['LLM_PROVIDER'] = 'hermes';
        if (model) env['HERMES_MODEL'] = model;
        // HERMES_PROVIDER / HERMES_API_KEY fall through from process.env if set
    } else {
        env['LLM_PROVIDER'] = 'ollama';
        if (model) env['LLM_MODEL'] = model;
    }

    // Module to run
    const module = adapter === 'hermes' ? 'noesis_brain.hermes' : 'noesis_brain';
    const cmdParts = [pythonBin, '-m', module];

    if (dryRun) {
        const envLine = Object.entries(env)
            .filter(([k]) => k.startsWith('NOUS') || k.startsWith('LLM') || k.startsWith('HERMES') || k.startsWith('OLLAMA'))
            .map(([k, v]) => `${k}=${v}`)
            .join(' ');
        console.log(`[dry-run] ${envLine} ${cmdParts.join(' ')}`);
        return;
    }

    console.log(`[Brain] Starting ${name} (adapter=${adapter})…`);
    console.log(`[Brain] Config: ${configPath}`);
    console.log(`[Brain] Socket: /tmp/noesis-nous-${name}.sock`);
    if (adapter === 'hermes') {
        console.log(`[Brain] Hermes provider: ${env['HERMES_PROVIDER'] ?? 'anthropic'} | model: ${env['HERMES_MODEL'] ?? '(default)'}`);
    }

    const child = nodeSpawn(cmdParts[0]!, cmdParts.slice(1), {
        env,
        cwd: brainDir,
        stdio: 'inherit',
    });

    child.on('error', (err) => {
        console.error(`[Brain] Failed to start: ${err.message}`);
        process.exitCode = 1;
    });

    child.on('exit', (code, signal) => {
        if (signal) {
            console.log(`[Brain] ${name} terminated by signal ${signal}`);
        } else {
            console.log(`[Brain] ${name} exited with code ${code ?? 0}`);
            if (code && code !== 0) process.exitCode = code;
        }
    });

    // Forward SIGINT/SIGTERM to child
    process.on('SIGINT', () => child.kill('SIGINT'));
    process.on('SIGTERM', () => child.kill('SIGTERM'));
}

/**
 * `noesis migrate` — the v2.6 → v3.0 migration ceremony (Phase 50, MIG-01..04).
 *   noesis migrate --from-v2.6 --to-v3.0   Export v2.6 memory to a v3.0 init bundle (no Grid call)
 *   noesis migrate --commit                Start v3.0 runtime; pre-Phase-37 audit becomes read-only
 *   noesis migrate --revert                Roll back IFF no civic action has committed (else 409)
 */
function migrationDir(): string {
    const dir = process.env.NOESIS_V3_DIR ?? join(homedir(), '.noesis', 'migration');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
}

function fsMigrationIO(dir: string): MigrationIO {
    const statePath = join(dir, '.noesis-migration.json');
    const bundlePath = join(dir, 'v3-init-bundle.json');
    const civicMarker = join(dir, '.civic-committed'); // a committed civic action writes this
    return {
        readState: () => (existsSync(statePath) ? (JSON.parse(readFileSync(statePath, 'utf8')) as MigrationState) : null),
        writeState: (s) => writeFileSync(statePath, JSON.stringify(s, null, 2)),
        exportV26Memory: () => {
            // Pragmatic v3.0 stand-in for the live v2.6 MySQL read: a manifest the operator points at.
            const manifest = process.env.NOESIS_V26_MANIFEST;
            if (!manifest || !existsSync(manifest)) {
                throw new Error('no v2.6 source: set NOESIS_V26_MANIFEST to a JSON array of {nousName,rowCount,memoryHash}');
            }
            const rows = JSON.parse(readFileSync(manifest, 'utf8')) as Array<{ nousName: string; rowCount: number; memoryHash: string }>;
            const tick = Math.floor(Date.now() / 1000);
            const bundles: NousBundleSummary[] = rows.map((r) => ({ nousName: r.nousName, rowCount: r.rowCount, memoryHash: r.memoryHash, migrationTick: tick }));
            writeFileSync(bundlePath, JSON.stringify(bundles, null, 2));
            return bundles;
        },
        deleteBundle: () => { if (existsSync(bundlePath)) rmSync(bundlePath); },
        hasCivicActionSince: () => existsSync(civicMarker),
        now: () => Math.floor(Date.now() / 1000),
    };
}

function cmdMigrate(args: string[]): void {
    const dir = migrationDir();
    const ceremony = new MigrationCeremony(fsMigrationIO(dir));
    if (args.includes('--commit')) {
        const r = ceremony.commit();
        if (!r.ok) { console.error('✗ commit failed: run `noesis migrate --from-v2.6 --to-v3.0` first (not_exported)'); process.exitCode = 1; return; }
        console.log(`✓ committed at tick ${r.committedTick}. Pre-Phase-37 audit is now read-only "pre-civic context".`);
        return;
    }
    if (args.includes('--revert')) {
        const r = ceremony.revert();
        if (r.ok) { console.log('✓ Reverted — no civic actions had occurred. v2.6 stack pointers restored.'); return; }
        if (r.code === 'migration_committed') { console.error('✗ 409 migration_committed — a civic action has committed; use `noesis fork` (Phase 43) to leave instead.'); process.exitCode = 1; return; }
        console.error('✗ nothing_to_revert — no active migration.'); process.exitCode = 1; return;
    }
    if (args.includes('--from-v2.6') || args.includes('--to-v3.0')) {
        try {
            const bundles = ceremony.exportBundle();
            console.log('Exported v2.6 → v3.0 init bundle:\n');
            console.log('  Nous            rows     memory-hash       tick');
            for (const b of bundles) console.log(`  ${b.nousName.padEnd(14)}  ${String(b.rowCount).padStart(6)}  ${b.memoryHash.slice(0, 16)}  ${b.migrationTick}`);
            console.log('\nInspect the bundle, then run `noesis migrate --commit`.');
        } catch (e) {
            console.error(`✗ export failed: ${(e as Error).message}`); process.exitCode = 1;
        }
        return;
    }
    console.error('Usage: noesis migrate --from-v2.6 --to-v3.0 | --commit | --revert');
    process.exitCode = 1;
}

function cmdHelp(): void {
    console.log(`
Noēsis CLI — Create and manage Grid worlds

Commands:
  genesis [--test]               Launch a Grid world
  status                         Show Grid status
  spawn <name> [region]          Spawn a new Nous
  brain <name> [--adapter hermes|ollama] [--model <m>] [--region <r>] [--dry-run]
                                 Start a Nous brain process
  regions                        List all regions
  laws                           List active laws
  audit [limit]                  Show recent audit entries
  stop                           Stop the Grid
  help                           Show this help

Brain adapter examples:
  noesis brain sophia                          # Ollama (default)
  noesis brain hermes --adapter hermes         # Hermes AIAgent (Anthropic)
  noesis brain hermes --adapter hermes --model claude-opus-4-5
  noesis brain hermes --adapter hermes --dry-run   # Print launch command
`.trim());
}

/** Expose launcher for testing. */
export function getLauncher(): GenesisLauncher | null {
    return launcher;
}

/** Set launcher (for testing). */
export function setLauncher(l: GenesisLauncher | null): void {
    launcher = l;
}
