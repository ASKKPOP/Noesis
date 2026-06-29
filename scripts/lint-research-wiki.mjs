#!/usr/bin/env node
/**
 * scripts/lint-research-wiki.mjs
 *
 * Health check for the LLM-wiki vault under .planning/research/
 * (Karpathy LLM-wiki pattern; conventions in .planning/research/SCHEMA.md).
 *
 * Reports:
 *   1. Orphans   — .md pages not linked from index.md.
 *   2. Broken    — [[wikilinks]] whose target resolves to no file.
 *   3. Missing   — files referenced in index.md that don't exist.
 *
 * Advisory by default (exit 0). Run: node scripts/lint-research-wiki.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const ROOT = '.planning/research';
const IGNORE = new Set(['.obsidian']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const pages = walk(ROOT);
const relPages = pages.map((p) => relative(ROOT, p)); // e.g. v2.4/ARCHITECTURE.md

// basename (no .md) -> [relPath...]
const byBase = new Map();
for (const rp of relPages) {
  const b = basename(rp, '.md');
  if (!byBase.has(b)) byBase.set(b, []);
  byBase.get(b).push(rp);
}

function resolve(target) {
  // strip alias and heading: [[path|alias]] / [[name#h]]
  let t = target.split('|')[0].split('#')[0].trim();
  if (!t) return null;
  if (t.includes('/')) {
    const want = t.endsWith('.md') ? t : `${t}.md`;
    return relPages.includes(want) ? [want] : null;
  }
  return byBase.get(t) || null;
}

const WIKILINK = /\[\[([^\]]+)\]\]/g;

// Strip fenced + inline code so syntax examples like `[[wikilinks]]` aren't
// counted as real links.
const stripCode = (s) =>
  s.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');

const broken = [];
const linked = new Set();
for (const p of pages) {
  const text = stripCode(readFileSync(p, 'utf8'));
  let m;
  while ((m = WIKILINK.exec(text)) !== null) {
    const hit = resolve(m[1]);
    if (!hit) broken.push({ from: relative(ROOT, p), link: m[1] });
    else hit.forEach((h) => linked.add(h));
  }
}

// Orphans: referenced from index.md is the catalog contract.
const indexText = stripCode(readFileSync(join(ROOT, 'index.md'), 'utf8'));
const indexed = new Set();
let im;
while ((im = WIKILINK.exec(indexText)) !== null) {
  const hit = resolve(im[1]);
  if (hit) hit.forEach((h) => indexed.add(h));
}
const META = new Set(['index.md', 'log.md', 'SCHEMA.md']);
const orphans = relPages.filter((rp) => !META.has(rp) && !indexed.has(rp));

console.log(`Research wiki lint — ${relPages.length} pages under ${ROOT}/\n`);
console.log(`Orphans (not in index.md): ${orphans.length}`);
orphans.forEach((o) => console.log(`  • ${o}`));
console.log(`\nBroken wikilinks: ${broken.length}`);
broken.forEach((b) => console.log(`  • ${b.from} → [[${b.link}]]`));

const ok = orphans.length === 0 && broken.length === 0;
console.log(`\n${ok ? '✓ clean' : '⚠ advisory — see above'}`);
process.exit(0);
