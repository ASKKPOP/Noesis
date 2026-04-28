#!/usr/bin/env node
/**
 * scripts/rig-bench-runner.mjs — Phase 14 RIG-04/RIG-05 bench wrapper.
 *
 * Spawns `node scripts/rig.mjs <configPath>` as a subprocess (D-14-02: never import in-process).
 * Captures the chronos.rig_closed 5-key tuple from the rig's isolated AuditChain via the
 * final stdout JSON line emitted by rig.mjs (D-14-08: NOT from any broadcast bus).
 * Validates the exact 5-key tuple shape and exit_reason enum.
 * Returns a structured result — used by both Vitest (when NOESIS_RUN_NIGHTLY=1) and
 * the nightly workflow shell step.
 *
 * Invariants (CI-enforced by scripts/check-rig-invariants.mjs):
 *   - No httpServer.listen / wsHub references (T-10-12)
 *   - No --skip-* / --bypass-* / --disable-* / --no-reviewer / --no-tier flags (T-10-13)
 *
 * Usage (programmatic):
 *   import { runRigBench } from './rig-bench-runner.mjs';
 *   const result = await runRigBench('config/rigs/bench-50.toml', { timeoutMs: 90 * 60 * 1000 });
 */

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

/** @typedef {'tick_budget_exhausted' | 'all_nous_dead' | 'operator_h5_terminate'} RigExitReason */

/** Exact 5-key tuple — order used for sort-join comparison (D-14-08). */
const EXPECTED_PAYLOAD_KEYS = 'chain_entry_count,chain_tail_hash,exit_reason,seed,tick';

/** Valid exit reason enum (D-14-08). */
const VALID_EXIT_REASONS = new Set(['tick_budget_exhausted', 'all_nous_dead', 'operator_h5_terminate']);

/**
 * Custom error for closed-tuple violations (T-14-04-01).
 */
class RigClosedTupleViolation extends Error {
    constructor(message) {
        super(message);
        this.name = 'RigClosedTupleViolation';
    }
}

/**
 * Run the rig benchmark as a subprocess and return a structured result.
 *
 * @param {string} configPath — path to the TOML config (relative to repo root or absolute)
 * @param {{ env?: Record<string,string>, timeoutMs?: number, expectExitReason?: RigExitReason }} [opts]
 * @returns {Promise<{
 *   passed: boolean,
 *   exitReason: RigExitReason | null,
 *   wallClockMs: number,
 *   chainEntryCount: number | null,
 *   chainTailHash: string | null,
 *   tarballPath: string | null,
 *   stdout: string,
 *   stderr: string,
 * }>}
 */
export async function runRigBench(configPath, opts = {}) {
    const { env: extraEnv = {}, timeoutMs, expectExitReason } = opts;

    // Resolve config path relative to repo root (cwd) for consistent subprocess invocation.
    const resolvedConfig = resolve(configPath);

    // Inherit NOESIS_FIXTURE_MODE='1' by default; caller can override via opts.env (D-14-06).
    const childEnv = {
        ...process.env,
        NOESIS_FIXTURE_MODE: '1',
        ...extraEnv,
    };

    const startNs = process.hrtime.bigint();

    return new Promise((resolvePromise) => {
        const stdoutChunks = [];
        const stderrChunks = [];
        let timedOut = false;
        let timeoutHandle = null;

        // D-14-02: spawn as subprocess — never import rig.mjs in-process.
        const child = spawn('node', ['scripts/rig.mjs', resolvedConfig], {
            env: childEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
        child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

        if (timeoutMs != null) {
            timeoutHandle = setTimeout(() => {
                timedOut = true;
                // SIGTERM is the operator_h5_terminate path per Plan 03 / D-14-08.
                child.kill('SIGTERM');
            }, timeoutMs);
        }

        child.on('close', (code) => {
            if (timeoutHandle !== null) clearTimeout(timeoutHandle);

            const endNs = process.hrtime.bigint();
            const wallClockMs = Number((endNs - startNs) / 1_000_000n);

            const stdout = Buffer.concat(stdoutChunks).toString('utf8');
            const stderr = Buffer.concat(stderrChunks).toString('utf8');

            // Parse the LAST non-empty stdout line as the rig_closed JSON (T-14-04-01 defense).
            const lastJsonLine = stdout
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
                .at(-1) ?? '';

            let payload = null;
            let parseError = null;
            try {
                const parsed = JSON.parse(lastJsonLine);
                if (parsed && parsed.event === 'rig_closed' && parsed.payload) {
                    payload = parsed.payload;
                } else {
                    parseError = `Unexpected final line structure: ${lastJsonLine}`;
                }
            } catch (err) {
                parseError = `Failed to parse final stdout line as JSON: ${lastJsonLine} — ${err.message}`;
            }

            // On non-zero exit with no valid payload, return passed=false with diagnostics.
            if (code !== 0 && payload === null) {
                resolvePromise({
                    passed: false,
                    exitReason: null,
                    wallClockMs,
                    chainEntryCount: null,
                    chainTailHash: null,
                    tarballPath: null,
                    stdout,
                    stderr,
                });
                return;
            }

            // Validate the closed 5-key tuple exactly (D-14-08, T-14-04-01).
            if (payload !== null) {
                const actualKeys = Object.keys(payload).sort().join(',');
                if (actualKeys !== EXPECTED_PAYLOAD_KEYS) {
                    throw new RigClosedTupleViolation(
                        `chronos.rig_closed payload key mismatch.\n` +
                        `  Expected: ${EXPECTED_PAYLOAD_KEYS}\n` +
                        `  Actual:   ${actualKeys}`
                    );
                }

                // Validate exit_reason enum (D-14-08).
                if (!VALID_EXIT_REASONS.has(payload.exit_reason)) {
                    throw new RigClosedTupleViolation(
                        `chronos.rig_closed exit_reason '${payload.exit_reason}' is not a valid RigExitReason. ` +
                        `Valid values: ${[...VALID_EXIT_REASONS].join(', ')}`
                    );
                }
            }

            // Extract tarball path from human-readable stdout line (best-effort).
            const tarballMatch = stdout.match(/tarball=([^\s]+)/);
            const tarballPath = tarballMatch ? tarballMatch[1] : null;

            const exitReason = payload?.exit_reason ?? null;

            // Determine pass/fail — mismatch from expectExitReason is a soft failure.
            let passed = code === 0 && payload !== null && parseError === null;
            if (passed && expectExitReason != null && exitReason !== expectExitReason) {
                passed = false;
            }

            resolvePromise({
                passed,
                exitReason,
                wallClockMs,
                chainEntryCount: payload?.chain_entry_count ?? null,
                chainTailHash: payload?.chain_tail_hash ?? null,
                tarballPath,
                stdout,
                stderr,
            });
        });
    });
}

export default runRigBench;
