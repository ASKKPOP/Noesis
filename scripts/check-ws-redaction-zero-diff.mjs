#!/usr/bin/env node
/**
 * scripts/check-ws-redaction-zero-diff.mjs
 *
 * Phase 36 OBS-36-03 (R-31-01) CI gate.
 *
 * Regression guard: verifies that the firehose fan-out path preserves the
 * R-31-01 zero-diff invariant — no per-entry mutation, no redaction logic,
 * no audit chain calls inside onAuditEvent.
 *
 * Checks performed:
 *
 * File 1: grid/src/audit/firehose-hub.ts — onAuditEvent method body
 *   1. Body includes literal comment "R-31-01 zero-diff: do NOT redact here"
 *   2. Body does NOT include "audit.append("  — audit calls forbidden in fan-out path
 *   3. Body does NOT include "chain.append("  — same
 *   4. Body does NOT include "serializeVisitorFrame(" — serialization belongs in trySend
 *   5. Body does NOT include "entry.payload ="  — entry mutation forbidden
 *   6. Body does NOT include "entry.actor_did =" — entry mutation forbidden
 *
 * File 2: grid/src/audit/firehose-redaction.ts — pure function contract
 *   7. File does NOT include "audit.append("  — redaction file must be side-effect free
 *   8. File does NOT include "chain.append("  — same
 *
 * Method body extraction: find onAuditEvent, balance braces to find body.
 *
 * Exit 0: all assertions pass.
 * Exit 1: at least one violation (listed to stderr).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const FIREHOSE_HUB = join(ROOT, 'grid', 'src', 'audit', 'firehose-hub.ts');
const FIREHOSE_REDACTION = join(ROOT, 'grid', 'src', 'audit', 'firehose-redaction.ts');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strip all // single-line comments from a text block.
 * Used to check for patterns as actual code, not documentation.
 */
function stripLineComments(text) {
    return text.split('\n').map((line) => {
        const commentIdx = line.indexOf('//');
        if (commentIdx < 0) return line;
        return line.slice(0, commentIdx);
    }).join('\n');
}

// ── Body extractor ────────────────────────────────────────────────────────────

/**
 * Find the method `onAuditEvent` and extract its body by brace-balancing.
 * Matches only method declarations (private/protected/public ... methodName),
 * not call sites like `this.onAuditEvent(entry)`.
 * Returns the body string, or null if not found.
 */
function extractMethodBody(text, methodName) {
    // Match method declaration: optional access modifier, then method name
    // Requires word boundary before methodName to avoid matching call sites
    const declRe = new RegExp(
        `(?:(?:private|protected|public)\\s+)?(?:async\\s+)?${methodName}\\s*\\(`,
        'g',
    );

    // Find all match positions
    let startIdx = -1;
    let m;
    while ((m = declRe.exec(text)) !== null) {
        // Exclude call sites: must NOT be preceded by '.' (method call) or word chars (this.xxx)
        const before = m.index > 0 ? text[m.index - 1] : '';
        if (before === '.' || /\w/.test(before)) continue;
        startIdx = m.index;
        break;
    }

    if (startIdx < 0) return null;

    // Scan forward from startIdx to find the opening brace of the method body
    let braceDepth = 0;
    let bodyOpenIdx = -1;

    for (let i = startIdx; i < text.length; i++) {
        const ch = text[i];
        if (ch === '{') {
            if (bodyOpenIdx < 0) {
                bodyOpenIdx = i;
            }
            braceDepth++;
        } else if (ch === '}') {
            braceDepth--;
            if (braceDepth === 0 && bodyOpenIdx >= 0) {
                // Found closing brace
                return text.slice(bodyOpenIdx + 1, i);
            }
        }
    }

    return null; // Unbalanced braces
}

// ── Main ──────────────────────────────────────────────────────────────────────

const violations = [];

// ── Check firehose-hub.ts ─────────────────────────────────────────────────────

let hubText;
try {
    hubText = readFileSync(FIREHOSE_HUB, 'utf8');
} catch (err) {
    violations.push(`Cannot read firehose-hub.ts: ${err.message}`);
    hubText = null;
}

if (hubText !== null) {
    const body = extractMethodBody(hubText, 'onAuditEvent');

    if (body === null) {
        violations.push('firehose-hub.ts: onAuditEvent method not found (R-31-01 zero-diff guard requires this method to exist)');
    } else {
        // 1. Must contain the R-31-01 comment
        if (!body.includes('R-31-01 zero-diff: do NOT redact here')) {
            violations.push(
                'firehose-hub.ts onAuditEvent body: missing "R-31-01 zero-diff: do NOT redact here" comment — ' +
                'this comment is required to document the zero-diff invariant (Plan 03 contract)',
            );
        }

        // 2. Must NOT contain audit.append(
        if (body.includes('audit.append(')) {
            violations.push(
                'firehose-hub.ts onAuditEvent body: contains "audit.append(" — ' +
                'audit chain calls are forbidden in the fan-out path (R-31-01 zero-diff)',
            );
        }

        // 3. Must NOT contain chain.append(
        if (body.includes('chain.append(')) {
            violations.push(
                'firehose-hub.ts onAuditEvent body: contains "chain.append(" — ' +
                'audit chain calls are forbidden in the fan-out path (R-31-01 zero-diff)',
            );
        }

        // For checks 4-6: use comment-stripped body to avoid flagging documentation comments
        // that mention forbidden patterns (e.g., the R-31-01 comment explaining WHERE
        // serializeVisitorFrame IS supposed to live).
        const bodyCode = stripLineComments(body);

        // 4. Must NOT contain serializeVisitorFrame( as actual code (not in comments)
        if (bodyCode.includes('serializeVisitorFrame(')) {
            violations.push(
                'firehose-hub.ts onAuditEvent body: contains "serializeVisitorFrame(" call — ' +
                'per-subscriber serialization/redaction must remain in ClientConnection.trySend(), not in the fan-out loop',
            );
        }

        // 5. Must NOT contain entry.payload = (entry mutation) as actual code
        if (/entry\.payload\s*=/.test(bodyCode)) {
            violations.push(
                'firehose-hub.ts onAuditEvent body: contains "entry.payload =" — ' +
                'mutating the entry before fan-out breaks the chain-head-hash invariant (R-31-01)',
            );
        }

        // 6. Must NOT contain entry.actor_did = (entry mutation) as actual code
        if (/entry\.actor_did\s*=/.test(bodyCode)) {
            violations.push(
                'firehose-hub.ts onAuditEvent body: contains "entry.actor_did =" — ' +
                'mutating the entry before fan-out breaks the chain-head-hash invariant (R-31-01)',
            );
        }
    }
}

// ── Check firehose-redaction.ts ───────────────────────────────────────────────

let redactionText;
try {
    redactionText = readFileSync(FIREHOSE_REDACTION, 'utf8');
} catch (err) {
    violations.push(`Cannot read firehose-redaction.ts: ${err.message}`);
    redactionText = null;
}

if (redactionText !== null) {
    // 7. Redaction file must NOT contain audit.append(
    if (redactionText.includes('audit.append(')) {
        violations.push(
            'firehose-redaction.ts: contains "audit.append(" — ' +
            'this file must be a pure function (no audit chain side effects; Plan 03 contract)',
        );
    }

    // 8. Redaction file must NOT contain chain.append(
    if (redactionText.includes('chain.append(')) {
        violations.push(
            'firehose-redaction.ts: contains "chain.append(" — ' +
            'this file must be a pure function (no audit chain side effects; Plan 03 contract)',
        );
    }
}

// ── Report ────────────────────────────────────────────────────────────────────

if (violations.length === 0) {
    console.log(
        '[check-ws-redaction-zero-diff] OK — R-31-01 zero-diff invariant intact: ' +
        'onAuditEvent body is mutation-free, no audit.append/chain.append in fan-out path, ' +
        'firehose-redaction.ts is pure.',
    );
    process.exit(0);
}

console.error('[check-ws-redaction-zero-diff] VIOLATIONS FOUND:');
for (const v of violations) {
    console.error('  -', v);
}
console.error('');
console.error('Phase 36 R-31-01: the firehose fan-out path (onAuditEvent) must never mutate');
console.error('the AuditEntry or write to the audit chain. Redaction must happen in');
console.error('ClientConnection.trySend() via serializeVisitorFrame() only.');
console.error('See CONTEXT.md and grid/src/audit/firehose-hub.ts for design rationale.');
process.exit(1);
