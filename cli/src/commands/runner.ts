/**
 * CLI Command Runner — parses args and dispatches commands.
 */

import { GenesisLauncher, GENESIS_CONFIG, TEST_CONFIG } from '@noesis/grid';
import type { GenesisConfig } from '@noesis/grid';

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

function cmdHelp(): void {
    console.log(`
Noēsis CLI — Create and manage Grid worlds

Commands:
  genesis [--test]     Launch a Grid world
  status               Show Grid status
  spawn <name> [region]  Spawn a new Nous
  regions              List all regions
  laws                 List active laws
  audit [limit]        Show recent audit entries
  stop                 Stop the Grid
  help                 Show this help
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
