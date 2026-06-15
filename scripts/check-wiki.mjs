#!/usr/bin/env node
/**
 * scripts/check-wiki.mjs
 *
 * Noēsis Wiki integrity gate (D-WIKI-04 / D-WIKI-05).
 *
 * Enforces the single-source-of-truth + every-page-is-visual invariants for
 * the in-repo MkDocs wiki under wiki/. See docs/plans/2026-06-14-wiki-system-design.md
 * and wiki/PROTOCOL.md.
 *
 * Rules:
 *   1. Every wiki/**.md page has YAML front-matter with `status`.
 *   2. Every `status: live|draft` page contains a Mermaid diagram
 *      (```mermaid fence) — the mandatory `## At a glance` visualization.
 *   3. At most one `canonical: true` page per `topic` (front-matter key).
 *   4. A `status: superseded` page is a stub: it must carry a `supersedes`/
 *      `moved_to` pointer and hold no substantive body (< 400 non-link chars).
 *
 * ENFORCED is false until Step 6 of the migration (gate stays advisory while
 * docs are being moved in). Flip ENFORCED = true to make violations fail CI.
 *
 * Exit codes:
 *   0 — clean (or ENFORCED=false: warnings only).
 *   1 — violations found and ENFORCED=true.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ENFORCED = false; // ← flip to true at migration Step 6

const ROOT = process.cwd();
const WIKI = join(ROOT, 'wiki');

function walk(dir) {
    const out = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) out.push(...walk(p));
        else if (e.name.endsWith('.md')) out.push(p);
    }
    return out;
}

function parseFrontMatter(src) {
    if (!src.startsWith('---')) return { fm: null, body: src };
    const end = src.indexOf('\n---', 3);
    if (end === -1) return { fm: null, body: src };
    const raw = src.slice(3, end).trim();
    const body = src.slice(end + 4);
    const fm = {};
    for (const line of raw.split('\n')) {
        const m = line.match(/^([a-z_]+):\s*(.*)$/i);
        if (m) fm[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
    return { fm, body };
}

if (!existsSync(WIKI)) {
    console.log('check-wiki: wiki/ does not exist yet — nothing to check.');
    process.exit(0);
}

const files = walk(WIKI);
const violations = [];
const canonicalByTopic = new Map();

for (const file of files) {
    const rel = relative(ROOT, file);
    const src = readFileSync(file, 'utf8');
    const { fm, body } = parseFrontMatter(src);

    if (!fm || !fm.status) {
        violations.push(`${rel}: missing front-matter \`status:\``);
        continue;
    }

    const hasDiagram = /```mermaid/.test(body) || /<svg|!\[[^\]]*\]\([^)]+\.(svg|png)/i.test(body);
    if ((fm.status === 'live' || fm.status === 'draft') && !hasDiagram) {
        violations.push(`${rel}: status=${fm.status} but no diagram/visualization (need a \`\`\`mermaid block — D-WIKI-05)`);
    }

    if (fm.canonical === 'true') {
        const topic = fm.topic || rel;
        if (canonicalByTopic.has(topic)) {
            violations.push(`${rel}: second canonical doc for topic "${topic}" (also ${canonicalByTopic.get(topic)}) — D-WIKI-04`);
        } else {
            canonicalByTopic.set(topic, rel);
        }
    }

    if (fm.status === 'superseded') {
        const pointer = fm.supersedes || fm.moved_to;
        const substantive = body.replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/\s+/g, '').length;
        if (!pointer) violations.push(`${rel}: superseded but no \`moved_to:\`/\`supersedes:\` pointer`);
        if (substantive > 400) violations.push(`${rel}: superseded stub still holds ${substantive} chars of body`);
    }
}

console.log(`check-wiki: scanned ${files.length} wiki page(s), ${canonicalByTopic.size} canonical topic(s).`);

if (violations.length) {
    console.log(`\n${violations.length} issue(s):`);
    for (const v of violations) console.log(`  • ${v}`);
    if (ENFORCED) {
        console.error('\n❌ check-wiki: FAIL (gate enforced).');
        process.exit(1);
    }
    console.log('\n⚠️  check-wiki: advisory only (ENFORCED=false). Fix before Step 6.');
    process.exit(0);
}

console.log('✅ check-wiki: clean.');
process.exit(0);
