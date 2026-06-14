#!/usr/bin/env node
/**
 * scripts/check-cross-house-injection.mjs
 *
 * Phase 60 HOUSE-3 (A11e / D-60-10 / R-60-12) CI gate — cross-House prompt-injection.
 *
 * INVARIANT: content received from any visitor/guest Nous or co-work board is DATA,
 * never instructions. A `task_ref` / `scope_ref` body, board text, an invitee-supplied
 * string, or any visitor-facing payload field MUST stay a structured DATA field — it must
 * NEVER be concatenated or interpolated into a Telos/Charter command, directive, prompt, or
 * any instruction string that could escalate the attacker-controlled content into an
 * instruction the Nous would obey.
 *
 * What this gate scans (the House channels that INGEST visitor/guest/board content):
 *   - grid/src/civic/cowork.ts                  (scope_ref / task / board content)
 *   - grid/src/api/routes/civic-parcels.ts      (invite + board/post|claim|complete routes)
 *   - grid/src/civic/place-registry.ts          (visitor-supplied place names, if present)
 *
 * What counts as a VIOLATION (on a single code statement):
 *   a CONTENT token (task_ref/taskRef/scope_ref/scopeRef/invitee/board text/place_name/
 *   visitor*) appears in the SAME interpolation or `+` concatenation as a DIRECTIVE token
 *   (Telos/Charter/directive/prompt/instruction/command/system_prompt/persona) — i.e. the
 *   untrusted content is being woven into an instruction string.
 *
 * What is NOT a violation:
 *   - content stored/passed as its own structured field (`scope_ref: taskRef`, a JSON value,
 *     an object property, a function argument) — that is DATA, exactly what we require.
 *   - directive tokens that appear without any content token on the same statement.
 *   - comments and block-comment prose (skipped, mirroring check-wallclock-forbidden.mjs).
 *
 * Exit codes:
 *   0 — clean: no visitor/board content escalated into a Telos/Charter directive string.
 *   1 — at least one violation; output identifies file:line and the offending statement.
 *
 * Run from repo root:
 *   node scripts/check-cross-house-injection.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

// ── House channels that ingest visitor / guest / board / scope content ────────────
const SCANNED_FILES = [
    'grid/src/civic/cowork.ts',
    'grid/src/api/routes/civic-parcels.ts',
    'grid/src/civic/place-registry.ts',
];

// ── Untrusted CONTENT tokens (visitor/guest/board supplied) ──────────────────────
const CONTENT_TOKENS = [
    /\btask_ref\b/, /\btaskRef\b/,
    /\bscope_ref\b/, /\bscopeRef\b/,
    /\bboard_?text\b/i,
    /\binvitee\b/,
    /\bplace_?name\b/i,
    /\bvisitor[A-Za-z_]*\b/i,
    /\bguest[A-Za-z_]*content\b/i,
];

// ── DIRECTIVE / prompt-assembly tokens (instruction surfaces) ────────────────────
const DIRECTIVE_TOKENS = [
    /\bTelos\b/i,
    /\bCharter\b/i,
    /\bdirective\b/i,
    /\bprompt\b/i,
    /\binstruction\b/i,
    /\bsystem_?prompt\b/i,
    /\bpersona\b/i,
    /\bcommand(?:_?str(?:ing)?|_?text|Interpreter)?\b/i,
];

// A statement only escalates if the content is being WOVEN INTO a string — i.e. it appears
// in a template-literal interpolation `${...}` or a `+` string concatenation. A plain
// structured assignment (`scope_ref: taskRef`) is DATA and must NOT be flagged.
function hasWeaving(stmt) {
    return /\$\{[^}]*\}/.test(stmt) || /['"`][^'"`]*['"`]\s*\+|\+\s*['"`]/.test(stmt) || /\.concat\s*\(/.test(stmt);
}

function matchesAny(stmt, patterns) {
    return patterns.some((rx) => rx.test(stmt));
}

function scanFile(rel) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) return []; // channel not present yet — nothing to guard.
    const lines = readFileSync(abs, 'utf8').split('\n');
    const violations = [];
    let inBlockComment = false;

    lines.forEach((line, i) => {
        const trimmed = line.trim();

        // Skip block comments (/* ... */) and pure single-line comments.
        if (inBlockComment) {
            if (trimmed.includes('*/')) inBlockComment = false;
            return;
        }
        if (trimmed.startsWith('/*') || trimmed.startsWith('/**')) {
            if (!trimmed.includes('*/') || trimmed.indexOf('*/') <= 2) inBlockComment = true;
            return;
        }
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        // A violation requires: a content token AND a directive token AND the content is
        // being woven into a string (interpolation / concatenation) on the same statement.
        if (
            matchesAny(trimmed, CONTENT_TOKENS) &&
            matchesAny(trimmed, DIRECTIVE_TOKENS) &&
            hasWeaving(trimmed)
        ) {
            violations.push({ file: rel, line: i + 1, text: trimmed });
        }
    });
    return violations;
}

// ── Run scan ─────────────────────────────────────────────────────────────────────
const allViolations = [];
const filesScanned = [];
for (const rel of SCANNED_FILES) {
    if (existsSync(join(ROOT, rel))) filesScanned.push(rel);
    allViolations.push(...scanFile(rel));
}

if (allViolations.length === 0) {
    console.log(
        `[check-cross-house-injection] OK (A11e) — ${filesScanned.length} House channel(s) scanned; ` +
        `visitor/guest/board content stays DATA, never escalated into a Telos/Charter directive.`,
    );
    process.exit(0);
}

console.error('❌ [check-cross-house-injection] CROSS-HOUSE PROMPT-INJECTION VIOLATION (A11e):');
console.error('  Visitor/guest/board content was woven into a Telos/Charter/prompt directive string.');
console.error('  Such content MUST remain a structured DATA field — never an instruction.');
console.error('');
for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    > ${v.text}`);
}
console.error('');
console.error('Fix: keep task_ref / scope_ref / invitee / place_name / visitor content as a quoted');
console.error('structured field (e.g. `scope_ref: taskRef`); never `${...}`/+-concat it into a Telos/Charter command.');
console.error('See D-60-10 / R-60-12 in .planning/phases/60-house-3-commerce-cowork/60-CONTEXT.md');
process.exit(1);
