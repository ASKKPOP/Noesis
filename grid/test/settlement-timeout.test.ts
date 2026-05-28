/**
 * Phase 44 Plan 04 — Settlement timeout helper tests (D-44-05b).
 *
 * Tests checkSettlementTimeouts(pool, audit, currentTick, gridName) directly.
 *
 * Covers:
 *  - expired escrows are auto-disputed (store.dispute() called)
 *  - market_settlement_timeout_ticks read from grid_config (default 7)
 *  - market.disputed audit event emitted per expired escrow
 *  - police_investigations row inserted per expired escrow
 *  - idempotent: re-running on already-frozen escrow skips (disputed=0, errors=0)
 *  - no clock.onTick usage in settlement-timeout.ts (static source check)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AuditChain } from '../src/audit/chain.js';
import { checkSettlementTimeouts } from '../src/marketplace/settlement-timeout.js';

const LISTING_ID = 'aabbccdd-aabb-aabb-aabb-aabbccddee11';
const ESCROW_ID = 'bbccddee-bbcc-bbcc-bbcc-aabbccddeeff';
const BUYER_DID = 'did:civic:noesis:buyer';
const SELLER_DID = 'did:civic:noesis:seller';
const GRID_NAME = 'Genesis';

/** Build a mock Pool where you can specify what to return for specific queries. */
function buildMockPool(opts: {
    configValue?: string | null;
    expiredEscrows?: Array<{ listingId: string; buyerCivicDid: string; sellerCivicDid: string }>;
    disputeResult?: { disputeId: string; sellerCivicDid: string; buyerCivicDid: string };
    disputeThrows?: string;
    captureInserts?: { sql: string; params: unknown[] }[];
}) {
    let getConnCallCount = 0;

    const mockConn = {
        beginTransaction: vi.fn(async () => {}),
        query: vi.fn(async (sql: unknown, _params?: unknown[]) => {
            if (typeof sql === 'string' && sql.includes('marketplace_escrow') && sql.includes('FOR UPDATE')) {
                if (opts.disputeThrows) throw new Error(opts.disputeThrows);
                return [[{
                    escrow_id: ESCROW_ID,
                    buyer_civic_did: BUYER_DID,
                    seller_civic_did: SELLER_DID,
                    escrow_status: 'held',
                }]];
            }
            if (typeof sql === 'string' && sql.includes('marketplace_disputes')) {
                return [{ affectedRows: 1 }];
            }
            return [[]];
        }),
        commit: vi.fn(async () => {}),
        rollback: vi.fn(async () => {}),
        release: vi.fn(() => {}),
    };

    const mockPool = {
        query: vi.fn(async (sql: unknown, params?: unknown[]) => {
            const sqlStr = typeof sql === 'string' ? sql : '';

            // grid_config → configValue
            if (sqlStr.includes('grid_config')) {
                if (opts.configValue === null) return [[]];
                if (opts.configValue !== undefined) return [[{ config_value: opts.configValue }]];
                return [[]]; // default → use DEFAULT
            }

            // listExpiredEscrows query
            if (sqlStr.includes('marketplace_escrow') && !sqlStr.includes('FOR UPDATE')) {
                const escrows = opts.expiredEscrows ?? [{ listingId: LISTING_ID, buyerCivicDid: BUYER_DID, sellerCivicDid: SELLER_DID }];
                return [escrows.map(e => ({
                    listing_id: e.listingId,
                    buyer_civic_did: e.buyerCivicDid,
                    seller_civic_did: e.sellerCivicDid,
                }))];
            }

            // police_investigations INSERT
            if (sqlStr.includes('police_investigations')) {
                opts.captureInserts?.push({ sql: sqlStr, params: params ?? [] });
                return [{ affectedRows: 1 }];
            }

            return [[]];
        }),
        getConnection: vi.fn(async () => {
            getConnCallCount++;
            if (opts.disputeThrows) {
                return {
                    ...mockConn,
                    query: vi.fn(async (sql: unknown) => {
                        if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
                            throw new Error(opts.disputeThrows);
                        }
                        return [[]];
                    }),
                };
            }
            return mockConn;
        }),
    };

    return mockPool;
}

describe('checkSettlementTimeouts (D-44-05b)', () => {

    it('auto-disputes expired escrow and returns {disputed: 1, errors: 0}', async () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');
        const pool = buildMockPool({
            configValue: '7',
            expiredEscrows: [{ listingId: LISTING_ID, buyerCivicDid: BUYER_DID, sellerCivicDid: SELLER_DID }],
        });

        const result = await checkSettlementTimeouts(
            pool as unknown as import('mysql2/promise').Pool,
            audit, 15, GRID_NAME,
        );
        expect(result.disputed).toBe(1);
        expect(result.errors).toBe(0);
    });

    it('reads market_settlement_timeout_ticks from grid_config', async () => {
        const audit = new AuditChain();
        const pool = buildMockPool({ configValue: '3' });

        const result = await checkSettlementTimeouts(
            pool as unknown as import('mysql2/promise').Pool,
            audit, 9, GRID_NAME,
        );
        // With timeout=3 and an expired escrow, should dispute
        expect(result.disputed).toBe(1);
        expect(result.errors).toBe(0);
    });

    it('uses DEFAULT_TIMEOUT_TICKS=7 when grid_config key is absent', async () => {
        const audit = new AuditChain();
        const pool = buildMockPool({ configValue: null }); // no config → default 7

        const result = await checkSettlementTimeouts(
            pool as unknown as import('mysql2/promise').Pool,
            audit, 15, GRID_NAME,
        );
        expect(result.disputed).toBe(1);
    });

    it('emits market.disputed audit event with dispute_id + listing_id', async () => {
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');
        const pool = buildMockPool({ configValue: '7' });

        await checkSettlementTimeouts(
            pool as unknown as import('mysql2/promise').Pool,
            audit, 15, GRID_NAME,
        );

        const disputedCalls = appendSpy.mock.calls.filter(c => c[0] === 'market.disputed');
        expect(disputedCalls.length).toBe(1);
        const payload = disputedCalls[0][2] as Record<string, unknown>;
        expect(payload).toMatchObject({ listing_id: LISTING_ID, tick: 15 });
        expect(typeof payload.dispute_id).toBe('string');
        expect(typeof payload.complainant_civic_did_hash).toBe('string');
        expect(payload.complainant_civic_did_hash).toHaveLength(64); // sha256 hex
    });

    it('inserts police_investigations row for each timed-out escrow', async () => {
        const audit = new AuditChain();
        const captureInserts: { sql: string; params: unknown[] }[] = [];
        const pool = buildMockPool({ configValue: '7', captureInserts });

        await checkSettlementTimeouts(
            pool as unknown as import('mysql2/promise').Pool,
            audit, 15, GRID_NAME,
        );

        expect(captureInserts.length).toBe(1);
        expect(captureInserts[0].sql).toContain('police_investigations');
        expect(captureInserts[0].params[1]).toBe(GRID_NAME); // grid_name
        // source_type is a SQL literal 'marketplace_dispute', NOT a param
        // params: [investigationId, gridName, disputeId, currentTick]
        // params[2] is disputeId (UUID)
        expect(String(captureInserts[0].params[2])).toMatch(/^[0-9a-f]{8}-/i);
        // params[3] is currentTick
        expect(captureInserts[0].params[3]).toBe(15);
    });

    it('returns {disputed: 0, errors: 0} when no expired escrows exist', async () => {
        const audit = new AuditChain();
        const pool = buildMockPool({ configValue: '7', expiredEscrows: [] });

        const result = await checkSettlementTimeouts(
            pool as unknown as import('mysql2/promise').Pool,
            audit, 15, GRID_NAME,
        );
        expect(result.disputed).toBe(0);
        expect(result.errors).toBe(0);
    });

    it('idempotent: re-running on already-frozen escrow returns {disputed: 0, errors: 0}', async () => {
        const audit = new AuditChain();
        const pool = buildMockPool({ configValue: '7', disputeThrows: 'escrow_not_disputable' });

        const result = await checkSettlementTimeouts(
            pool as unknown as import('mysql2/promise').Pool,
            audit, 15, GRID_NAME,
        );
        expect(result.disputed).toBe(0);
        expect(result.errors).toBe(0); // not_disputable is caught + skipped, NOT counted as error
    });

    it('processes multiple expired escrows in single invocation', async () => {
        const LISTING_ID_2 = 'ccbbaa11-ccbb-ccbb-ccbb-aabbccddeeff';
        const audit = new AuditChain();
        const appendSpy = vi.spyOn(audit, 'append');

        let disputeCallCount = 0;
        const mockConn = {
            beginTransaction: vi.fn(async () => {}),
            query: vi.fn(async (sql: unknown) => {
                if (typeof sql === 'string' && sql.includes('FOR UPDATE')) {
                    disputeCallCount++;
                    const listingId = disputeCallCount === 1 ? LISTING_ID : LISTING_ID_2;
                    return [[{
                        escrow_id: `escrow-${disputeCallCount}`,
                        buyer_civic_did: BUYER_DID,
                        seller_civic_did: SELLER_DID,
                        escrow_status: 'held',
                    }]];
                }
                if (typeof sql === 'string' && sql.includes('marketplace_disputes')) return [{ affectedRows: 1 }];
                return [[]];
            }),
            commit: vi.fn(async () => {}),
            rollback: vi.fn(async () => {}),
            release: vi.fn(() => {}),
        };

        const pool = {
            query: vi.fn(async (sql: unknown) => {
                const s = typeof sql === 'string' ? sql : '';
                if (s.includes('grid_config')) return [[{ config_value: '7' }]];
                if (s.includes('marketplace_escrow') && !s.includes('FOR UPDATE')) {
                    return [[
                        { listing_id: LISTING_ID, buyer_civic_did: BUYER_DID, seller_civic_did: SELLER_DID },
                        { listing_id: LISTING_ID_2, buyer_civic_did: BUYER_DID, seller_civic_did: SELLER_DID },
                    ]];
                }
                if (s.includes('police_investigations')) return [{ affectedRows: 1 }];
                return [[]];
            }),
            getConnection: vi.fn(async () => mockConn),
        };

        const result = await checkSettlementTimeouts(
            pool as unknown as import('mysql2/promise').Pool,
            audit, 15, GRID_NAME,
        );
        expect(result.disputed).toBe(2);
        const disputedCalls = appendSpy.mock.calls.filter(c => c[0] === 'market.disputed');
        expect(disputedCalls.length).toBe(2);
    });

    it('does NOT use clock.onTick (static source check)', () => {
        const src = readFileSync(
            path.resolve(process.cwd(), 'src/marketplace/settlement-timeout.ts'),
            'utf8',
        );
        // Strip comments before checking
        const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
        expect(withoutComments).not.toMatch(/clock\.onTick/);
    });
});
