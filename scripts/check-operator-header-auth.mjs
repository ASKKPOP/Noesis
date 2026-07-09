// CI gate (SECURITY 2026-07-09): no route under grid/src/api/operator/ or
// grid/src/api/admin/ may read x-operator-tier / x-operator-id from request
// headers as an auth source. Operator tier + identity are server-trusted —
// resolved from the Portal-session DID against the GRID_OPERATOR_DIDS allowlist
// (req.didContext.operatorTier / operatorId), never from a client header.
//
// Run: node scripts/check-operator-header-auth.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['grid/src/api/operator', 'grid/src/api/admin'];
// Matches an actual header read of x-operator-tier / x-operator-id, e.g.
//   req.headers['x-operator-tier']   headers["x-operator-id"]
const FORBIDDEN = /headers\s*\[\s*['"]x-operator-(tier|id)['"]\s*\]/;

function walk(dir) {
    const out = [];
    let entries;
    try {
        entries = readdirSync(dir);
    } catch {
        return out; // root missing — nothing to scan
    }
    for (const name of entries) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) out.push(...walk(p));
        else if (p.endsWith('.ts')) out.push(p);
    }
    return out;
}

const offenders = [];
for (const root of ROOTS) {
    for (const file of walk(root)) {
        const src = readFileSync(file, 'utf8');
        src.split(/\r?\n/).forEach((line, i) => {
            if (FORBIDDEN.test(line)) offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
}

if (offenders.length > 0) {
    console.error('❌ operator/admin routes must NOT read x-operator-tier/-id from headers:');
    for (const o of offenders) console.error('   ' + o);
    console.error('\nUse the server-trusted operator context (req.didContext.operatorTier / operatorId).');
    process.exit(1);
}
console.log('✅ check-operator-header-auth: no header-trust auth in operator/admin routes');
