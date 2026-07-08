/**
 * System Map aggregator — GET /api/v1/system/map (public, read-only, aggregate-only).
 *
 * One picture of the whole world, computed from LIVE Grid state: the four surfaces
 * (Grid · Portal · Steward · Local AI/Brain) and the eight civic institutions
 * (Registry · Polis · Police · IRS · Marketplace · Library · Communities · P2P).
 * Backs the live dashboard page at noesiis.com/system-map. Every status + metric
 * is derived from a guarded read — NOTHING is hardcoded.
 *
 * INVARIANTS (HARNESS / CLAUDE.md):
 *   - READ-ONLY: SELECT-only, zero audit.append, zero broadcast → broadcast-allowlist.ts
 *     and the FORBIDDEN_KEY_PATTERN privacy walker are NOT touched.
 *   - AGGREGATE-ONLY / no PII: counts, a treasury balance string, a fee-rate percent,
 *     and a tick — never a raw DID, statement, name, content, or hash.
 *   - VOTE-05 / D-V3-36 untouched: a read-only observability map grants no governance
 *     or management authority.
 *   - Public (policy.ts 'GET /api/v1/system/map': 'public'), like /api/v1/irs/treasury
 *     and /api/v1/polis/bills — no auth, no GRID_*_ENABLED flag.
 *
 * GUARD STRATEGY: each of the 12 items is built inside its own `item(fn, fallback)`
 * wrapper. One failing query yields that item's 'down' fallback and never rejects the
 * handler — so the endpoint is always 200 and partial. DB-backed items throw
 * 'db_unavailable' when services.pool is falsy, so they fall to their 'down' fallback
 * (still 200) while the non-DB items (grid clock/firehose/audit, steward derivation)
 * keep computing.
 *
 * SQL DISCIPLINE: every query is a parameterized SELECT (grid_name bound as `?`),
 * the reserved-ish `status` identifier is backticked (the mock Pool cannot catch
 * reserved-word SQL errors — backticking avoids a real-MySQL crash-loop on deploy).
 */
import { formatEther } from 'ethers';
import type { FastifyInstance } from 'fastify';
import type { RowDataPacket, Pool } from 'mysql2/promise';
import type { GridServices } from '../server.js';

/** Cold-start grace: below this tick the Grid surface reads 'degraded'. */
const COLD_START_TICKS = 60;

type SurfaceStatus = 'up' | 'degraded' | 'down' | 'empty';
type InstitutionStatus = 'active' | 'empty' | 'down' | 'unknown';

interface GridSurfaceItem { status: SurfaceStatus; metric: number | null; headline: string; tick: number; client_count: number; chain_valid: boolean; }
interface PortalSurfaceItem { status: SurfaceStatus; metric: number | null; headline: string; pending: number; approved: number; rejected: number; total: number; }
interface BrainSurfaceItem { status: SurfaceStatus; metric: number | null; headline: string; total: number; unowned: number; active: number; }
interface RegistryItem { status: InstitutionStatus; metric: number | null; headline: string; civic_active: number; nous_active: number; }
interface PolisItem { status: InstitutionStatus; metric: number | null; headline: string; bills_active: number; bills_enacted: number; }
interface PoliceItem { status: InstitutionStatus; metric: number | null; headline: string; complaints: number; sanctions_active: number; }
interface IrsItem { status: InstitutionStatus; metric: string | null; headline: string; balance_wei: string; fee_rate_percent: number; }
interface MarketplaceItem { status: InstitutionStatus; metric: number | null; headline: string; listings_active: number; escrow_settled: number; }
interface LibraryItem { status: InstitutionStatus; metric: number | null; headline: string; entries_published: number; citations_total: number; }
interface CommunitiesItem { status: InstitutionStatus; metric: number | null; headline: string; communities_active: number; members_active: number; }
interface P2pItem { status: InstitutionStatus; metric: number | null; headline: string; peers_online: number; }

/**
 * Per-item isolation wrapper. Returns fn()'s object, or the fallback on any throw —
 * so one failing item never rejects the whole handler.
 */
async function item<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await fn();
    } catch {
        return fallback;
    }
}

function num(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

export function registerSystemMapRoute(app: FastifyInstance, services: GridServices): void {
    app.get('/api/v1/system/map', async (_req, reply) => {
        const grid = services.gridName;
        const pool = services.pool as Pool | undefined;
        const currentTick =
            services.clock?.state?.tick ?? (services.currentTick ? services.currentTick() : 0) ?? 0;

        /** Guard: DB-backed items throw this so they fall to the 'down' fallback. */
        const requirePool = (): Pool => {
            if (!pool) throw new Error('db_unavailable');
            return pool;
        };

        // ── SURFACE: Grid ──────────────────────────────────────────────────────
        // Non-DB signals only — clock running, audit chain integrity, firehose subs.
        const gridSurface = await item<GridSurfaceItem>(
            async () => {
                const clientCount = services.firehoseHub?.stats().client_count ?? 0;

                // Canonical health signal — the SAME source /health/detailed uses
                // (the watchdog snapshot: divergence-based, pure-pull). NOT the O(n)
                // audit.verify() re-hash, which on a polled endpoint is both slow AND
                // returns valid:false benignly on a large-but-healthy chain — that made
                // this tile read 'degraded'/'starting up' while the grid was actually ok
                // (QA finding: 77k-entry chain, divergence 0, watchdog ok).
                const snap = services.launcher?.healthWatchdog?.snapshot();
                if (snap) {
                    const running = snap.clock.running;
                    const div = snap.audit.divergence;
                    const chainValid = div === null || div <= snap.audit.divergence_threshold;
                    const status: SurfaceStatus = !running
                        ? 'down'
                        : snap.status === 'critical'
                            ? 'down'
                            : snap.status === 'degraded'
                                ? 'degraded'
                                : 'up';
                    return {
                        status,
                        metric: clientCount,
                        headline: status === 'up' ? 'world running' : status === 'down' ? 'clock stopped' : 'degraded',
                        tick: snap.clock.tick,
                        client_count: clientCount,
                        chain_valid: chainValid,
                    };
                }

                // Fallback (watchdog not wired — e.g. unit tests): liveness only.
                // Cheap chain_valid (length), never the full re-hash.
                const running = services.clock?.running ?? false;
                const tick = services.clock?.state?.tick ?? currentTick;
                const chainValid = services.audit ? services.audit.length > 0 : true;
                const status: SurfaceStatus = !running
                    ? 'down'
                    : tick < COLD_START_TICKS
                        ? 'degraded'
                        : 'up';
                return {
                    status,
                    metric: clientCount,
                    headline: status === 'up' ? 'world running' : status === 'down' ? 'clock stopped' : 'starting up',
                    tick,
                    client_count: clientCount,
                    chain_valid: chainValid,
                };
            },
            { status: 'down' as SurfaceStatus, metric: null, headline: 'unavailable', tick: 0, client_count: 0, chain_valid: false },
        );

        // ── SURFACE: Portal ────────────────────────────────────────────────────
        // human_civic_applications GROUP BY status — aggregate counts ONLY (no DIDs).
        const portalSurface = await item<PortalSurfaceItem>(
            async () => {
                const p = requirePool();
                const [rows] = await p.query<RowDataPacket[]>(
                    'SELECT `status`, COUNT(*) AS n FROM human_civic_applications WHERE grid_name = ? GROUP BY `status`',
                    [grid],
                );
                let pending = 0, approved = 0, rejected = 0;
                for (const r of rows) {
                    const n = num(r.n);
                    if (r.status === 'pending') pending = n;
                    else if (r.status === 'approved') approved = n;
                    else if (r.status === 'rejected') rejected = n;
                }
                const total = pending + approved + rejected;
                return {
                    status: 'up' as SurfaceStatus,
                    metric: pending,
                    headline: total > 0 ? `${pending} awaiting review` : 'no applications',
                    pending, approved, rejected, total,
                };
            },
            { status: 'down' as SurfaceStatus, metric: null, headline: 'db_unavailable', pending: 0, approved: 0, rejected: 0, total: 0 },
        );

        // ── SURFACE: Brain (Local AI) ──────────────────────────────────────────
        // brain_tokens — total / unowned / active (non-revoked). Counts only.
        const brainSurface = await item<BrainSurfaceItem>(
            async () => {
                const p = requirePool();
                const [rows] = await p.query<RowDataPacket[]>(
                    'SELECT COUNT(*) AS total, SUM(operator_did IS NULL) AS unowned, SUM(revoked = 0) AS active ' +
                        'FROM brain_tokens WHERE grid_name = ?',
                    [grid],
                );
                const total = num(rows[0]?.total);
                const unowned = num(rows[0]?.unowned);
                const active = num(rows[0]?.active);
                const status: SurfaceStatus = total === 0 ? 'empty' : active > 0 ? 'up' : 'degraded';
                return {
                    status,
                    metric: active,
                    headline: total === 0 ? 'no Brains registered' : `${active} active`,
                    total, unowned, active,
                };
            },
            { status: 'down' as SurfaceStatus, metric: null, headline: 'db_unavailable', total: 0, unowned: 0, active: 0 },
        );

        // ── SURFACE: Steward ───────────────────────────────────────────────────
        // Pure client app — reads the Grid. Honest derivation from grid.status.
        const stewardSurface = {
            status: (gridSurface.status !== 'down' ? 'up' : 'down') as 'up' | 'down',
            metric: gridSurface.status !== 'down' ? ('operator console' as string) : null,
            headline: gridSurface.status !== 'down' ? 'reads the Grid' : 'Grid unreachable',
        };

        // ── INSTITUTION: DID Registry ──────────────────────────────────────────
        const registry = await item<RegistryItem>(
            async () => {
                const p = requirePool();
                const [civic] = await p.query<RowDataPacket[]>(
                    "SELECT COUNT(*) AS n FROM civic_did_registry WHERE grid_name = ? AND `status` = 'active'",
                    [grid],
                );
                const [nous] = await p.query<RowDataPacket[]>(
                    "SELECT COUNT(*) AS n FROM nous_registry WHERE grid_name = ? AND `status` = 'active'",
                    [grid],
                );
                const civicActive = num(civic[0]?.n);
                const nousActive = num(nous[0]?.n);
                const status: InstitutionStatus = civicActive + nousActive > 0 ? 'active' : 'empty';
                return {
                    status, metric: civicActive,
                    headline: `${civicActive} Civic-DIDs · ${nousActive} Nous`,
                    civic_active: civicActive, nous_active: nousActive,
                };
            },
            { status: 'down' as InstitutionStatus, metric: null, headline: 'db_unavailable', civic_active: 0, nous_active: 0 },
        );

        // ── INSTITUTION: Polis ─────────────────────────────────────────────────
        const polis = await item<PolisItem>(
            async () => {
                const p = requirePool();
                const [rows] = await p.query<RowDataPacket[]>(
                    "SELECT SUM(`status` NOT IN ('enacted','rejected','withdrawn')) AS active, " +
                        "SUM(`status` = 'enacted') AS enacted FROM gov_bills WHERE grid_name = ?",
                    [grid],
                );
                const billsActive = num(rows[0]?.active);
                const billsEnacted = num(rows[0]?.enacted);
                const status: InstitutionStatus = billsActive + billsEnacted > 0 ? 'active' : 'empty';
                return {
                    status, metric: billsActive,
                    headline: `${billsActive} in pipeline · ${billsEnacted} enacted`,
                    bills_active: billsActive, bills_enacted: billsEnacted,
                };
            },
            { status: 'down' as InstitutionStatus, metric: null, headline: 'db_unavailable', bills_active: 0, bills_enacted: 0 },
        );

        // ── INSTITUTION: Police ────────────────────────────────────────────────
        // police_sanctions has NO status column — 'active' is duration-based.
        const police = await item<PoliceItem>(
            async () => {
                const p = requirePool();
                const [comp] = await p.query<RowDataPacket[]>(
                    'SELECT COUNT(*) AS n FROM police_complaints WHERE grid_name = ?',
                    [grid],
                );
                const [sanc] = await p.query<RowDataPacket[]>(
                    'SELECT COUNT(*) AS active FROM police_sanctions WHERE grid_name = ? ' +
                        'AND (duration_ticks IS NULL OR executed_at_tick + duration_ticks > ?)',
                    [grid, currentTick],
                );
                const complaints = num(comp[0]?.n);
                const sanctionsActive = num(sanc[0]?.active);
                const status: InstitutionStatus = complaints + sanctionsActive > 0 ? 'active' : 'empty';
                return {
                    status, metric: complaints,
                    headline: `${complaints} complaints · ${sanctionsActive} sanctions`,
                    complaints, sanctions_active: sanctionsActive,
                };
            },
            { status: 'down' as InstitutionStatus, metric: null, headline: 'db_unavailable', complaints: 0, sanctions_active: 0 },
        );

        // ── INSTITUTION: IRS / Treasury ────────────────────────────────────────
        const irs = await item<IrsItem>(
            async () => {
                const p = requirePool();
                const [bal] = await p.query<RowDataPacket[]>(
                    'SELECT balance_wei FROM civic_treasury WHERE grid_name = ?',
                    [grid],
                );
                const [rate] = await p.query<RowDataPacket[]>(
                    "SELECT config_value FROM grid_config WHERE grid_name = ? AND config_key = 'irs_fee_rate'",
                    [grid],
                );
                const balanceWei = String(bal[0]?.balance_wei ?? 0); // BIGINT safety
                const feePresent = rate[0]?.config_value !== undefined;
                const feeRatePercent = feePresent ? Number.parseFloat(String(rate[0].config_value)) * 100 : 0;
                const hasBalance = balanceWei !== '0' && balanceWei !== '';
                const status: InstitutionStatus = hasBalance || feePresent ? 'active' : 'empty';
                // Money speaks wei (D-MONEY-07); "Bios" is the body-drive, never money.
                // Show the human amount in ETH (formatEther); keep raw wei in balance_wei.
                const balanceEth = formatEther(BigInt(balanceWei));
                return {
                    status, metric: balanceEth,
                    headline: `treasury ${balanceEth} ETH · ${feeRatePercent}% fee`,
                    balance_wei: balanceWei, fee_rate_percent: feeRatePercent,
                };
            },
            { status: 'down' as InstitutionStatus, metric: null, headline: 'db_unavailable', balance_wei: '0', fee_rate_percent: 0 },
        );

        // ── INSTITUTION: Marketplace ───────────────────────────────────────────
        const marketplace = await item<MarketplaceItem>(
            async () => {
                const p = requirePool();
                const [lst] = await p.query<RowDataPacket[]>(
                    "SELECT COUNT(*) AS n FROM marketplace_listings WHERE grid_name = ? AND `status` = 'active'",
                    [grid],
                );
                const [esc] = await p.query<RowDataPacket[]>(
                    "SELECT COUNT(*) AS n FROM marketplace_escrow WHERE grid_name = ? AND escrow_status = 'settled'",
                    [grid],
                );
                const listingsActive = num(lst[0]?.n);
                const escrowSettled = num(esc[0]?.n);
                const status: InstitutionStatus = listingsActive + escrowSettled > 0 ? 'active' : 'empty';
                return {
                    status, metric: listingsActive,
                    headline: `${listingsActive} listings · ${escrowSettled} settled`,
                    listings_active: listingsActive, escrow_settled: escrowSettled,
                };
            },
            { status: 'down' as InstitutionStatus, metric: null, headline: 'db_unavailable', listings_active: 0, escrow_settled: 0 },
        );

        // ── INSTITUTION: Library ───────────────────────────────────────────────
        const library = await item<LibraryItem>(
            async () => {
                const p = requirePool();
                const [rows] = await p.query<RowDataPacket[]>(
                    'SELECT COUNT(*) AS published, COALESCE(SUM(citation_count), 0) AS citations ' +
                        "FROM library_entries WHERE grid_name = ? AND `status` = 'published'",
                    [grid],
                );
                const published = num(rows[0]?.published);
                const citations = num(rows[0]?.citations);
                const status: InstitutionStatus = published > 0 ? 'active' : 'empty';
                return {
                    status, metric: published,
                    headline: `${published} entries · ${citations} citations`,
                    entries_published: published, citations_total: citations,
                };
            },
            { status: 'down' as InstitutionStatus, metric: null, headline: 'db_unavailable', entries_published: 0, citations_total: 0 },
        );

        // ── INSTITUTION: Communities ───────────────────────────────────────────
        const communities = await item<CommunitiesItem>(
            async () => {
                const p = requirePool();
                const [com] = await p.query<RowDataPacket[]>(
                    "SELECT COUNT(*) AS n FROM communities WHERE grid_name = ? AND `status` = 'active'",
                    [grid],
                );
                const [mem] = await p.query<RowDataPacket[]>(
                    "SELECT COUNT(*) AS n FROM community_members WHERE grid_name = ? AND `status` = 'active'",
                    [grid],
                );
                const communitiesActive = num(com[0]?.n);
                const membersActive = num(mem[0]?.n);
                const status: InstitutionStatus = communitiesActive + membersActive > 0 ? 'active' : 'empty';
                return {
                    status, metric: communitiesActive,
                    headline: `${communitiesActive} communities · ${membersActive} members`,
                    communities_active: communitiesActive, members_active: membersActive,
                };
            },
            { status: 'down' as InstitutionStatus, metric: null, headline: 'db_unavailable', communities_active: 0, members_active: 0 },
        );

        // ── INSTITUTION: P2P ───────────────────────────────────────────────────
        // QA fix: this used to read services.presenceService (civic/presence
        // "awake" count — a different institution, B-09 Grid presence) instead of
        // the P2P peer store that GET /api/v1/p2p/peers/:did itself reads. A civic-DID
        // could show here as "online" while the real peer-lookup route reported it
        // peer_offline. In-memory p2p peer store — 'unknown' when absent (guarded).
        const p2p = await item<P2pItem>(
            async () => {
                const p2pService = services.p2pService;
                if (!p2pService) {
                    return {
                        status: 'unknown' as InstitutionStatus,
                        metric: null,
                        headline: 'p2p peer store unavailable',
                        peers_online: 0,
                    };
                }
                const peersOnline = p2pService.peerStore.countOnline();
                const status: InstitutionStatus = peersOnline > 0 ? 'active' : 'empty';
                return {
                    status, metric: peersOnline,
                    headline: `${peersOnline} peers online`,
                    peers_online: peersOnline,
                };
            },
            { status: 'down' as InstitutionStatus, metric: null, headline: 'unavailable', peers_online: 0 },
        );

        return reply.code(200).send({
            grid_name: grid,
            tick: currentTick,
            generated_at_tick: currentTick,
            surfaces: {
                grid: gridSurface,
                portal: portalSurface,
                steward: stewardSurface,
                brain: brainSurface,
            },
            institutions: {
                registry,
                polis,
                police,
                irs,
                marketplace,
                library,
                communities,
                p2p,
            },
        });
    });
}
