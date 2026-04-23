import { describe, it, expect, afterEach } from 'vitest';
import { GenesisLauncher } from '../src/genesis/launcher.js';
import { TEST_CONFIG, GENESIS_CONFIG } from '../src/genesis/presets.js';

describe('GenesisLauncher', () => {
    let launcher: GenesisLauncher;

    afterEach(() => {
        launcher?.stop();
    });

    describe('bootstrap', () => {
        it('seeds regions from config', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            expect(launcher.space.allRegions()).toHaveLength(2);
            expect(launcher.space.getRegion('alpha')).toBeDefined();
            expect(launcher.space.getRegion('beta')).toBeDefined();
        });

        it('seeds connections', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            expect(launcher.space.getTravelCost('alpha', 'beta')).toBe(1);
        });

        it('spawns seed Nous', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            expect(launcher.registry.count).toBe(2);
            expect(launcher.registry.get('did:noesis:sophia')).toBeDefined();
            expect(launcher.registry.get('did:noesis:hermes')).toBeDefined();
        });

        it('places seed Nous in spatial map', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            expect(launcher.space.getPosition('did:noesis:sophia')?.regionId).toBe('alpha');
            expect(launcher.space.getPosition('did:noesis:hermes')?.regionId).toBe('beta');
        });

        it('assigns NDS addresses', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            const sophia = launcher.registry.get('did:noesis:sophia')!;
            expect(sophia.ndsAddress).toBe('nous://sophia.test.noesis');
        });

        it('grants initial Ousia', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            expect(launcher.registry.get('did:noesis:sophia')!.ousia).toBe(500);
        });

        it('records audit events', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            // 2 nous.spawned + 1 grid.genesis = 3 entries
            expect(launcher.audit.length).toBe(3);
            expect(launcher.audit.verify().valid).toBe(true);
        });
    });

    describe('start / stop', () => {
        it('starts the clock', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            launcher.start();
            expect(launcher.clock.running).toBe(true);
            expect(launcher.state.running).toBe(true);
        });

        it('stops the clock', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            launcher.start();
            launcher.stop();
            expect(launcher.clock.running).toBe(false);
        });

        it('start/stop adds audit entries', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            const before = launcher.audit.length;
            launcher.start();
            launcher.stop();
            expect(launcher.audit.length).toBe(before + 2); // grid.started + grid.stopped
        });
    });

    describe('state', () => {
        it('returns full grid state', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            const s = launcher.state;
            expect(s.gridName).toBe('TestGrid');
            expect(s.gridDomain).toBe('test.noesis');
            expect(s.nousCount).toBe(2);
            expect(s.regionCount).toBe(2);
        });
    });

    describe('spawnNous (runtime)', () => {
        it('spawns a new Nous into running Grid', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            launcher.spawnNous('Atlas', 'did:noesis:atlas', 'pk-atlas', 'alpha');
            expect(launcher.registry.count).toBe(3);
            expect(launcher.space.getPosition('did:noesis:atlas')?.regionId).toBe('alpha');
            expect(launcher.registry.get('did:noesis:atlas')!.ousia).toBe(500);
        });
    });

    describe('clock tick wiring', () => {
        it('updates lastActiveTick on tick', () => {
            launcher = new GenesisLauncher(TEST_CONFIG);
            launcher.bootstrap();
            launcher.clock.advance(); // tick 1
            expect(launcher.registry.get('did:noesis:sophia')!.lastActiveTick).toBe(1);
        });
    });

    describe('GENESIS_CONFIG preset', () => {
        it('has 5 regions', () => {
            launcher = new GenesisLauncher(GENESIS_CONFIG);
            launcher.bootstrap();
            expect(launcher.space.allRegions()).toHaveLength(5);
        });

        it('has founding laws', () => {
            launcher = new GenesisLauncher(GENESIS_CONFIG);
            launcher.bootstrap();
            expect(launcher.logos.activeLaws().length).toBeGreaterThan(0);
        });

        it('audit chain is valid after bootstrap', () => {
            launcher = new GenesisLauncher(GENESIS_CONFIG);
            launcher.bootstrap();
            expect(launcher.audit.verify().valid).toBe(true);
        });
    });
});
