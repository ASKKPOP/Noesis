#!/usr/bin/env node
/**
 * scripts/check-ledger-b-money.mjs
 *
 * Phase 62.5-05 — Ledger-B money-retirement invariant gate.
 *
 * The in-DB economy was unified onto a single civic-DID-keyed ledger: money lives
 * ONLY in `nous_accounts.balance_wei` (per civic-DID) + `civic_treasury.balance_wei`.
 * The legacy existence-keyed Ledger B — `nous_registry.balance_wei` moved via
 * `NousRegistry.transferWei` — was retired in Phase 62.5-04 (v74 zeroed it; the column
 * persists only as an inert history field on NousRecord). This gate keeps that door
 * shut: it fails the build if any grid/src code reintroduces
 *   (a) a `.transferWei(` call — the money verb itself is retired, or
 *   (b) a JS mutation of a record's `.balance_wei` property (`.balance_wei += …`,
 *       `.balance_wei -= …`, `.balance_wei = …`) — the in-memory Ledger-B balance move.
 *
 * The LEADING DOT is the discriminator: a JS property write is `x.balance_wei = …`,
 * whereas the legitimate Ledger-A rails are SQL self-references with NO dot
 * (`balance_wei = balance_wei + VALUES(balance_wei)` on nous_accounts / civic_treasury)
 * and the v74 migration's `SET balance_wei = 0`. Reads (`record.balance_wei`), object
 * literals (`{ balance_wei: … }`), and persistence INSERT/SELECT are not `.balance_wei =`
 * writes and are not flagged. Money on Ledger A moves through the wei-ops SQL rails,
 * never through JS object mutation, so a dot-prefixed balance_wei write is always Ledger B.
 *
 * Run: node scripts/check-ledger-b-money.mjs
 * Exit: 0 clean · 1 offender(s) with file:line.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SCAN_ROOT = 'grid/src';

// (a) The retired money verb — any call is an offender, wherever it appears.
const TRANSFER_WEI_CALL = /\.transferWei\s*\(/;
// (b) A JS write to a record's `.balance_wei` property (compound-assign or plain assign).
//     The leading dot means it's an object mutation, not a SQL column reference.
//     `=[^=]` avoids matching an `==` / `===` comparison.
const JS_BALANCE_WRITE = /\.balance_wei\s*(?:[-+]=|=[^=])/;

const EXCLUDE_FILE = [/\.test\.ts$/, /\.d\.ts$/];
const EXCLUDE_DIR = new Set(['node_modules', 'dist', 'build', '.next']);

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
        if (statSync(p).isDirectory()) {
            if (EXCLUDE_DIR.has(name)) continue;
            out.push(...walk(p));
        } else if (p.endsWith('.ts') && !EXCLUDE_FILE.some((re) => re.test(p))) {
            out.push(p);
        }
    }
    return out;
}

// A pure comment line (past-tense "transferWei was retired" doc-comments) must not trip the gate.
const isComment = (line) => {
    const t = line.trimStart();
    return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
};

const offenders = [];
for (const file of walk(SCAN_ROOT)) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
        if (isComment(line)) return;
        if (TRANSFER_WEI_CALL.test(line)) {
            offenders.push(`${file}:${i + 1}: [transferWei retired] ${line.trim()}`);
        }
        if (JS_BALANCE_WRITE.test(line)) {
            offenders.push(`${file}:${i + 1}: [Ledger-B .balance_wei mutation] ${line.trim()}`);
        }
    });
}

if (offenders.length > 0) {
    console.error('❌ check-ledger-b-money: Ledger-B money use is retired (Phase 62.5-04/05).');
    console.error('   Money lives ONLY in nous_accounts + civic_treasury (civic-DID keyed).');
    console.error('   Offenders:');
    for (const o of offenders) console.error('   ' + o);
    console.error('');
    console.error('   Fix: move money on nous_accounts/civic_treasury via NousAccountStore');
    console.error('   (chargeToTreasury / credit / debit / transfer) or the wei-ops SQL rails.');
    console.error('   `nous_registry.balance_wei` + `transferWei` are no longer money.');
    process.exit(1);
}
console.log('✅ check-ledger-b-money: no transferWei / Ledger-B .balance_wei mutations in grid/src');
