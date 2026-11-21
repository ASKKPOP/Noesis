/**
 * After a Grid restart the coordinator's Civic-DID index is empty, so a Brain's
 * actions would be refused until its Nous was issued a new Civic-DID. The index is
 * rebuilt at start from the registry.
 */
import { describe, expect, it } from 'vitest';
import { GridCoordinator } from '../../src/integration/grid-coordinator.js';
import type { NousRunner } from '../../src/integration/nous-runner.js';
import type { GenesisLauncher } from '../../src/genesis/launcher.js';

const runner = (nousDid: string): NousRunner => ({ nousDid, nousName: nousDid, onSpeak() {} }) as unknown as NousRunner;

function coordinatorWith(...dids: string[]): GridCoordinator {
    const c = new GridCoordinator({} as GenesisLauncher);
    for (const did of dids) c.addRunner(runner(did));
    return c;
}

describe('GridCoordinator.restoreCivicDids', () => {
    it('binds each runner to the Civic-DID its Nous already holds', async () => {
        const c = coordinatorWith('did:noesis:sophia', 'did:noesis:hermes');
        const held: Record<string, string> = { 'did:noesis:sophia': 'did:civic:genesis:aaa' };

        const bound = await c.restoreCivicDids(async (did) => held[did] ?? null);

        expect(bound).toBe(1);
        expect(c.getRunnerByCivicDid('did:civic:genesis:aaa')?.nousDid).toBe('did:noesis:sophia');
    });

    it('leaves a Nous with no Civic-DID unbound', async () => {
        const c = coordinatorWith('did:noesis:themis');
        expect(await c.restoreCivicDids(async () => null)).toBe(0);
        expect(c.getRunnerByCivicDid('did:civic:genesis:bbb')).toBeUndefined();
    });
});
