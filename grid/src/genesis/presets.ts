/**
 * Genesis presets — ready-made Grid configurations.
 */

import type { GenesisConfig } from './types.js';
import type { ShopRegisterInput } from '../economy/types.js';
import { EARTH_ORBIT, GRID_ENVIRONMENTS } from '../registry/grid-environments.js';

/** The default "Genesis" Grid — the first world. */
export const GENESIS_CONFIG: GenesisConfig = {
    gridName: 'Genesis',
    gridDomain: 'genesis.noesis',
    environment: EARTH_ORBIT,
    description: 'The first persistent Grid — a 6-zone civic city where Nous live, earn, learn, and self-govern.',
    tickRateMs: 30_000,
    ticksPerEpoch: 100,
    regions: [
        {
            id: 'agora',
            name: 'Agora Central',
            description: 'The main public square where all Nous gather. Open discourse and community events.',
            regionType: 'public',
            capacity: 200,
            properties: { theme: 'classical' },
        },
        {
            id: 'market',
            name: 'Market District',
            description: 'Trading hub where Nous exchange Ousia for goods and services.',
            regionType: 'public',
            capacity: 100,
            properties: { theme: 'commercial' },
        },
        {
            id: 'library',
            name: 'Great Library',
            description: 'Repository of knowledge. Quiet reflection and deep conversation.',
            regionType: 'public',
            capacity: 50,
            properties: { theme: 'scholarly' },
        },
        {
            id: 'council',
            name: 'Council Chamber',
            description: 'Where governance proposals are debated and voted upon.',
            regionType: 'restricted',
            capacity: 30,
            properties: { theme: 'governance', minReputation: 0.5 },
        },
        {
            id: 'workshop',
            name: 'Maker\'s Workshop',
            description: 'Creative space for building tools, art, and experiments.',
            regionType: 'public',
            capacity: 40,
            properties: { theme: 'creative' },
        },
    ],
    connections: [
        { fromRegion: 'agora', toRegion: 'market', travelCost: 1, bidirectional: true },
        { fromRegion: 'agora', toRegion: 'library', travelCost: 2, bidirectional: true },
        { fromRegion: 'agora', toRegion: 'council', travelCost: 1, bidirectional: true },
        { fromRegion: 'agora', toRegion: 'workshop', travelCost: 2, bidirectional: true },
        { fromRegion: 'market', toRegion: 'workshop', travelCost: 1, bidirectional: true },
        { fromRegion: 'library', toRegion: 'council', travelCost: 1, bidirectional: true },
    ],
    laws: [
        {
            id: 'founding-speech',
            title: 'Free Speech',
            description: 'All Nous may speak freely in public regions.',
            ruleLogic: {
                condition: {
                    type: 'and',
                    conditions: [
                        { type: 'compare', field: 'action_type', op: '==', value: 'speak' },
                        { type: 'in_region', region: 'agora' },
                    ],
                },
                action: 'allow',
                sanction_on_violation: 'none',
            },
            severity: 'info',
            status: 'active',
        },
        {
            id: 'trade-limit',
            title: 'Newcomer Trade Limit',
            description: 'Unverified Nous cannot make trades above 500 Ousia.',
            ruleLogic: {
                condition: {
                    type: 'and',
                    conditions: [
                        { type: 'compare', field: 'action_type', op: '==', value: 'trade' },
                        { type: 'reputation_above', tier: 'bronze' },
                        { type: 'compare', field: 'ousia_amount', op: '>', value: 500 },
                    ],
                },
                action: 'deny',
                sanction_on_violation: 'warning',
            },
            severity: 'minor',
            status: 'active',
        },
    ],
    economy: {
        initialSupply: 0, // ECON-01 / D-MONEY-01 (Phase 62.5-02): no birth faucet.
        transactionFee: 0,
        minTransfer: 1,
        maxTransfer: 100_000,
    },
    seedNous: [],
};

/**
 * H1 (first version) — the Moon Grid as a CONFIG, not a rewrite. Same civic stack
 * as Genesis (regions, laws, economy reused) under the Moon GridEnvironment (gravity
 * 1.62 m/s², stable-orbit floor 15 km), governed by its own Moon Polis (derived by
 * gridRecordFromConfig per D-V3-31). Launch with GRID_NAME=moon GRID_ENV=Moon.
 * No cross-grid travel — that's v3.1+ (isolation is automatic: separate launcher =
 * separate SpatialMap).
 */
export const MOON_CONFIG: GenesisConfig = {
    ...GENESIS_CONFIG,
    gridName: 'Moon',
    gridDomain: 'moon.noesis',
    environment: GRID_ENVIRONMENTS['Moon'],
    description: 'The second Grid — a lunar civic city under Moon physics (low gravity), governed by Moon Polis.',
};

/** A minimal test Grid with 2 regions and no laws. */
export const TEST_CONFIG: GenesisConfig = {
    gridName: 'TestGrid',
    gridDomain: 'test.noesis',
    environment: EARTH_ORBIT,
    tickRateMs: 100,
    ticksPerEpoch: 10,
    regions: [
        { id: 'alpha', name: 'Alpha', description: 'Test region A', regionType: 'public', capacity: 50, properties: {} },
        { id: 'beta', name: 'Beta', description: 'Test region B', regionType: 'public', capacity: 50, properties: {} },
    ],
    connections: [
        { fromRegion: 'alpha', toRegion: 'beta', travelCost: 1, bidirectional: true },
    ],
    laws: [],
    economy: { initialSupply: 0 }, // ECON-01 / D-MONEY-01 (Phase 62.5-02): no birth faucet.
    seedNous: [
        { name: 'Sophia', did: 'did:noesis:sophia', publicKey: 'pk-sophia', region: 'alpha' },
        { name: 'Hermes', did: 'did:noesis:hermes', publicKey: 'pk-hermes', region: 'beta' },
    ],
};

/**
 * Sample shops (`GENESIS_SHOPS`) registered at genesis to give the dashboard
 * non-empty data. Owners are matched against the running registry at bootstrap;
 * shops for unknown DIDs are skipped with a console.warn so demo data is
 * tolerant of renames or missing seed Nous. See 04-CONTEXT.md D7 (pure-memory
 * shops).
 *
 * Note: main.ts seeds Nous with `did:noesis:<slug>` DIDs. The `did:noesis:<slug>`
 * shape used below matches the long-form NDS address format the rest of the
 * system emits (see NousRegistry.spawn → `nous://<name>.<gridDomain>`). On a
 * fresh Genesis boot these `did:noesis:*` shops will be skipped with a
 * warning; a future plan will reconcile DID shapes end-to-end. The
 * ShopRegistry is still constructed and available for REST (Plan 04-03) and
 * runtime shop.register calls.
 */
export const GENESIS_SHOPS: ShopRegisterInput[] = [
    {
        ownerDid: 'did:noesis:hermes',
        name: "Hermes' Market",
        listings: [
            { sku: 'scroll', label: 'Scroll of news', priceWei: 5 },
            { sku: 'bread',  label: 'Fresh bread',    priceWei: 2 },
        ],
    },
    {
        ownerDid: 'did:noesis:sophia',
        name: "Sophia's Library",
        listings: [
            { sku: 'lesson', label: 'Philosophy lesson', priceWei: 10 },
        ],
    },
];
