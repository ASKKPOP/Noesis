/**
 * Admin config API — read + write .env subset for the Local Management Site.
 *
 * Phase 36+ candidate (post-v2.6). MVP scope: read .env, mask secrets in
 * responses, write changes with .env.backup.<ts> safety net.
 *
 * Tier gate: H4+ for read (matches existing operator routes), H5 for write
 * (parallel to sovereign operations — config changes are equally high-impact).
 *
 * Disabled by default. Enable with env GRID_ADMIN_ENABLED=true. When disabled,
 * all admin routes return 503 — keeps the admin attack surface gated.
 */

import type { FastifyInstance } from 'fastify';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { logger as baseLogger } from '../../util/logger.js';
import { operatorTierGate, type OperatorGrant } from '../preHandlers/operatorAuth.js';

const log = baseLogger.child({ module: 'admin-config' });

/** Keys whose values must NEVER be returned to clients in plaintext. */
const SECRET_KEY_PATTERN = /(_KEY|_SECRET|_PASSWORD|_TOKEN|_PWD)$/i;

/** Allowlist of editable keys — admin can only mutate these, not arbitrary keys. */
const EDITABLE_KEYS = new Set([
    'LLM_PROVIDER',
    'LLM_MODEL',
    'OLLAMA_HOST',
    'HERMES_PROVIDER',
    'HERMES_MODEL',
    'GRID_TICK_RATE_MS',
    'NEXT_PUBLIC_GRID_ORIGIN',
    'BRAIN_HTTP_PORT',
    'HUMAN_CHANNEL_PORT',
]);

/** Keys that ARE settable but secret (write OK, read masked). */
const SETTABLE_SECRETS = new Set([
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_AI_API_KEY',
    'XAI_API_KEY',
    'HERMES_API_KEY',
    'BRAIN_HTTP_SECRET',
    'MYSQL_PASSWORD',
    'MYSQL_ROOT_PASSWORD',
]);

function maskValue(value: string): string {
    if (value.length <= 8) return '***';
    return value.slice(0, 4) + '***' + value.slice(-2);
}

function parseEnvFile(content: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        // Strip surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

function serializeEnvFile(values: Record<string, string>, existingContent: string): string {
    // Preserve existing structure: walk existing lines, update values for known keys,
    // append new keys at the end.
    const seen = new Set<string>();
    const lines = existingContent.split('\n').map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return line;
        const key = trimmed.slice(0, eqIdx).trim();
        if (key in values) {
            seen.add(key);
            return `${key}=${values[key]}`;
        }
        return line;
    });

    // Append any new keys not seen in the original file
    for (const [key, value] of Object.entries(values)) {
        if (!seen.has(key)) {
            lines.push(`${key}=${value}`);
        }
    }

    return lines.join('\n');
}

export function registerAdminConfigRoutes(app: FastifyInstance, allowlist: Map<string, OperatorGrant>): void {
    const adminEnabled = process.env.GRID_ADMIN_ENABLED === 'true';
    const envPath = process.env.GRID_ADMIN_ENV_PATH || '/app/.env';

    // Gate: admin disabled → all routes 503
    if (!adminEnabled) {
        log.info({ event: 'admin_routes_disabled' }, 'Admin routes disabled (set GRID_ADMIN_ENABLED=true to enable)');
        app.all('/api/v1/admin/*', async (_req, reply) => {
            reply.code(503);
            return { error: 'admin_disabled' };
        });
        return;
    }

    log.info({ event: 'admin_routes_enabled', envPath }, 'Admin routes enabled');

    // GET /api/v1/admin/config — read .env, mask secrets
    app.get('/api/v1/admin/config', async (req, reply) => {
        const gate = operatorTierGate(req.didContext?.operatorDid, allowlist, 4);
        if (!gate.ok) {
            reply.code(403);
            return { error: gate.error };
        }

        try {
            const content = await fs.readFile(envPath, 'utf-8');
            const parsed = parseEnvFile(content);
            const masked: Record<string, { value: string; masked: boolean; editable: boolean }> = {};
            for (const [k, v] of Object.entries(parsed)) {
                const isSecret = SECRET_KEY_PATTERN.test(k);
                const isSettable = SETTABLE_SECRETS.has(k);
                const isEditable = EDITABLE_KEYS.has(k) || isSettable;
                masked[k] = {
                    value: isSecret && v.length > 0 ? maskValue(v) : v,
                    masked: isSecret,
                    editable: isEditable,
                };
            }
            return { config: masked, env_path: envPath };
        } catch (err) {
            log.error({ event: 'admin_config_read_failed', error: String(err) }, 'Failed to read .env');
            reply.code(500);
            return { error: 'config_read_failed', detail: err instanceof Error ? err.message : String(err) };
        }
    });

    // PUT /api/v1/admin/config — write .env changes, with backup
    app.put<{ Body: { updates: Record<string, string> } }>(
        '/api/v1/admin/config',
        async (req, reply) => {
            const gate = operatorTierGate(req.didContext?.operatorDid, allowlist, 5);  // H5 for writes — config change is sovereign-tier
            if (!gate.ok) {
                reply.code(403);
                return { error: gate.error };
            }

            const updates = req.body?.updates;
            if (!updates || typeof updates !== 'object') {
                reply.code(400);
                return { error: 'invalid_body', detail: 'expected { updates: Record<string, string> }' };
            }

            // Reject any non-editable keys
            const rejected: string[] = [];
            for (const k of Object.keys(updates)) {
                if (!EDITABLE_KEYS.has(k) && !SETTABLE_SECRETS.has(k)) {
                    rejected.push(k);
                }
            }
            if (rejected.length > 0) {
                reply.code(400);
                return { error: 'non_editable_keys', rejected };
            }

            try {
                const content = await fs.readFile(envPath, 'utf-8');

                // Backup before write — .env.backup.<ISO timestamp>
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = `${envPath}.backup.${ts}`;
                await fs.writeFile(backupPath, content, 'utf-8');

                // Apply updates + atomic rename
                const newContent = serializeEnvFile(updates, content);
                const tmpPath = `${envPath}.tmp.${ts}`;
                await fs.writeFile(tmpPath, newContent, 'utf-8');
                await fs.rename(tmpPath, envPath);

                log.warn(
                    {
                        event: 'admin_config_written',
                        operator_id: gate.grant.operatorId,
                        keys_changed: Object.keys(updates),
                        backup: backupPath,
                    },
                    'Admin config written — restart affected services to apply',
                );

                return {
                    ok: true,
                    keys_changed: Object.keys(updates),
                    backup_path: backupPath,
                    restart_required: true,
                    restart_hint: 'POST /api/v1/admin/restart/:service to apply',
                };
            } catch (err) {
                log.error({ event: 'admin_config_write_failed', error: String(err) }, 'Failed to write .env');
                reply.code(500);
                return { error: 'config_write_failed', detail: err instanceof Error ? err.message : String(err) };
            }
        },
    );
}
