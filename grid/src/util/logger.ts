/**
 * grid/src/util/logger.ts — Phase 31 OBS-03 structured-logger singleton (D-31-B1, D-31-B2).
 *
 * Design invariants:
 *   • Module-scoped singleton: `pino()` evaluates exactly once at import time.
 *   • JSON to stdout in production; pretty-printed only when NOESIS_LOG_PRETTY=1
 *     (dev-only — pino-pretty is in devDependencies).
 *   • Redact list strips secrets BEFORE they hit stdout. Future audit payloads
 *     accidentally containing forbidden keys are scrubbed at the logger boundary.
 *   • Default level 'info'; override via NOESIS_LOG_LEVEL env (trace|debug|info|warn|error|fatal).
 *   • No pino-mysql transport — would create a single-point-of-failure where the
 *     log channel and the audit_trail it observes share a MySQL connection.
 *     (CONTEXT.md D-31-B2; ROADMAP.md Out-of-Scope: "Add pino-mysql transport".)
 *
 * Usage:
 *   import { logger } from '../util/logger.js';
 *   const log = logger.child({ module: 'persistent-chain' });
 *   log.warn({ event: 'audit_persist_failed', entry_id, event_type, ... }, 'msg');
 *
 * Why not console.* — see OBS-03 and CI gate scripts/check-no-silent-catch.mjs (Phase 31 plan 05).
 */

import pino, { type Logger } from 'pino';

const isPretty = process.env.NOESIS_LOG_PRETTY === '1';
const level = process.env.NOESIS_LOG_LEVEL ?? 'info';

export const logger: Logger = pino({
    level,
    // remove:true strips keys entirely rather than replacing with '[Redacted]'.
    // Keys cover stdlib defaults (Pino redacts password/secret/token by convention)
    // PLUS Phase 31 explicit additions that mirror Phase 33 PORTAL_AUTH_FORBIDDEN_KEYS.
    redact: {
        paths: [
            'password',
            'password_hash',
            'signature',
            'nonce',
            'cookie',
            'jwt',
            'authorization',
            'secret',
            'token',
            '*.password',
            '*.password_hash',
            '*.signature',
            '*.nonce',
            '*.cookie',
            '*.jwt',
            '*.authorization',
            '*.secret',
            '*.token',
        ],
        remove: true,
    },
    // pid + hostname are useful inside Docker logs (multiple grid containers
    // get distinguished automatically). Epoch-ms timestamp is the simplest
    // machine-parseable shape — operators do not need ISO strings.
    base: { pid: process.pid, hostname: process.env.HOSTNAME ?? 'grid' },
    timestamp: pino.stdTimeFunctions.epochTime,
    transport: isPretty
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss.l' } }
        : undefined,
});

export type { Logger };
