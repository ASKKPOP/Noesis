#!/usr/bin/env node
/**
 * Production read-only smoke — the cheapest tier of docs/test-scenarios.html.
 *
 * GETs public Grid endpoints and pages and checks the shape of each answer.
 * Never signs in, never writes. Costs nothing locally but a few HTTP requests,
 * so any one area can be re-checked after a deploy.
 *
 *   node scripts/smoke/prod-smoke.mjs                 # every area
 *   node scripts/smoke/prod-smoke.mjs --area portal   # one area (comma list ok)
 *   node scripts/smoke/prod-smoke.mjs --list          # list areas and checks
 *
 * Env: SMOKE_API (default https://api.noesiis.com), SMOKE_WEB (default https://noesiis.com).
 * Exit code 1 when any selected check fails.
 */

const API = process.env.SMOKE_API ?? 'https://api.noesiis.com';
const WEB = process.env.SMOKE_WEB ?? 'https://noesiis.com';

const isArr = (k) => (b) => Array.isArray(b?.[k]) || `${k} is not a list`;
const has = (...keys) => (b) => keys.every((k) => b && k in b) || `missing ${keys.filter((k) => !(b && k in b)).join(', ')}`;

/** [id, area, base, path, expectedStatus, check?] — check returns true or a failure reason. */
const CHECKS = [
    ['H1', 'health', API, '/health', 200, (b) => b.status === 'ok' || `status ${b.status}`],
    ['H2', 'health', API, '/health/detailed', 200, (b) => (b.status !== 'critical' && b.clock?.running === true) || `status ${b.status}, clock running ${b.clock?.running}`],
    ['H3', 'health', API, '/api/v1/grid/status', 200, has('name', 'tick', 'nousCount', 'uptime')],
    ['H4', 'health', API, '/api/v1/grid/clock', 200, has('tick', 'tickRateMs')],
    ['H5', 'health', API, '/api/v1/system/map', 200, (b) => (b.surfaces?.grid?.status === 'up') || `grid surface ${b.surfaces?.grid?.status}`],
    ['H6', 'health', WEB, '/portal/status', 200],

    ['P1', 'portal', WEB, '/portal/auth', 200],
    ['P2', 'portal', WEB, '/portal/dashboard', 200],
    ['P3', 'portal', API, '/api/v1/portal/me/overview', 401, (b) => b.error === 'not_authenticated' || `error ${b.error}`],
    ['P4', 'portal', API, '/api/v1/portal/grids', 200, isArr('grids')],
    ['P5', 'portal', API, '/api/v1/portal/discover', 200, isArr('organizations')],

    ['R1', 'registration', WEB, '/system/portal-manager/nous-registrations', 200],
    ['R2', 'registration', API, '/api/v1/portal-reviewer/nous-registrations', 401, (b) => b.error === 'portal_session_required' || `error ${b.error}`],
    ['R3', 'registration', API, '/api/v1/civic/presence', 200, isArr('nous')],

    ['N1', 'nous', API, '/api/v1/grid/nous', 200, isArr('nous')],
    ['N2', 'nous', API, '/api/v1/grid/regions', 200, isArr('regions')],
    ['N3', 'nous', WEB, '/portal/chat', 200],

    ['G1', 'groups', API, '/api/v1/groups', 200, (b) => (Array.isArray(b.groups) && b.groups.length > 0) || 'no groups'],
    ['G2', 'groups', API, '/api/v1/groups/genesis:group:aegis', 200, has('group', 'members', 'projects')],
    ['G3', 'groups', API, '/api/v1/groups/does-not-exist', 404],
    ['G4', 'groups', WEB, '/grid/groups', 200],

    ['C1', 'city', API, '/api/v1/civic-map/state', 200, (b) => b.zones?.length === 6 || `zones ${b.zones?.length} (D-V3-32 requires 6)`],
    ['C2', 'city', API, '/api/v1/zoning/zones', 200, (b) => b.zones?.length === 6 || `zones ${b.zones?.length}`],
    ['C3', 'city', API, '/api/v1/civic/parcels', 200, isArr('parcels')],
    ['C4', 'city', API, '/api/v1/orbital/objects', 200, isArr('objects')],
    ['C5', 'city', WEB, '/worldmap/orbital', 200],

    ['V1', 'polis', API, '/api/v1/polis/bills', 200, isArr('bills')],
    ['V2', 'polis', API, '/api/v1/gov/law/active', 200, isArr('laws')],
    ['V3', 'polis', API, '/api/v1/governance/laws', 200, isArr('laws')],
    ['V4', 'polis', API, '/api/v1/governance/proposals', 200, isArr('proposals')],
    ['V5', 'polis', WEB, '/portal/polis', 200],

    ['E1', 'economy', API, '/api/v1/irs/treasury', 200, has('balance_wei', 'current_rate_percent')],
    ['E2', 'economy', API, '/api/v1/civic/treasury', 200, has('balance_wei')],
    ['E3', 'economy', API, '/api/v1/market/listings', 200, isArr('listings')],
    ['E4', 'economy', API, '/api/v1/procurement/notices', 200, isArr('notices')],
    ['E5', 'economy', API, '/api/v1/economy/trades', 200, isArr('trades')],

    ['L1', 'library', API, '/api/v1/library/entries', 200, isArr('entries')],
    ['L2', 'library', API, '/api/v1/library/curators', 200, isArr('curators')],
    ['L3', 'library', API, '/api/v1/grid/lore', 200, isArr('entries')],

    ['A1', 'audit', API, '/api/v1/audit/trail', 200, isArr('entries')],
    ['A2', 'audit', API, '/api/v1/audit/verify', 200, (b) => b.valid === true || `valid ${b.valid}, brokenAt ${b.brokenAt}`],
];

const args = process.argv.slice(2);
const areaArg = args.includes('--area') ? args[args.indexOf('--area') + 1] : undefined;
const areas = [...new Set(CHECKS.map((c) => c[1]))];

if (args.includes('--list')) {
    for (const a of areas) console.log(`${a}: ${CHECKS.filter((c) => c[1] === a).map((c) => `${c[0]} ${c[3]}`).join(' · ')}`);
    process.exit(0);
}

const wanted = areaArg ? areaArg.split(',') : areas;
const unknown = wanted.filter((a) => !areas.includes(a));
if (unknown.length) {
    console.error(`Unknown area: ${unknown.join(', ')}. Areas: ${areas.join(', ')}`);
    process.exit(2);
}

async function run([id, area, base, path, expected, check]) {
    const started = Date.now();
    try {
        const res = await fetch(base + path, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
        const ms = Date.now() - started;
        if (res.status !== expected) return { id, area, path, ok: false, ms, why: `HTTP ${res.status}, expected ${expected}` };
        if (!check) return { id, area, path, ok: true, ms };
        const verdict = check(await res.json().catch(() => null));
        return { id, area, path, ok: verdict === true, ms, why: verdict === true ? '' : verdict };
    } catch (err) {
        return { id, area, path, ok: false, ms: Date.now() - started, why: `no answer (${err.name})` };
    }
}

const results = await Promise.all(CHECKS.filter((c) => wanted.includes(c[1])).map(run));
for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id.padEnd(3)} ${r.area.padEnd(12)} ${r.path.padEnd(48)} ${String(r.ms).padStart(5)}ms  ${r.why ?? ''}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed · ${API} · ${WEB}`);
process.exit(failed ? 1 : 0);
