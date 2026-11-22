/**
 * Local Nous alert — a person's own Local Nous Manager tells the Grid that their Nous
 * cannot stay running, and the Grid emails that person.
 *
 *   POST /api/v1/portal/nous-alert   { kind: 'brain_down' | 'local_ai_down', nous?: string }
 *
 * Signed-in accounts only (Portal session cookie). The mail goes to the email address
 * of the signed-in account and nowhere else: the caller chooses neither the recipient
 * nor the wording, only which of two fixed notices and the Nous's name. One mail per
 * kind per account per hour. A private account notice — no audit event, allowlist +0.
 */
import { jwtVerify } from 'jose';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';
import { sesMailerFromEnv } from './alert-mailer.js';

const NOTICES = {
    brain_down: {
        subject: (nous: string) => `${nous}'s Brain keeps stopping`,
        text: (nous: string) => `The Brain of ${nous} has failed to stay running several times in a row on your Mac.\n\nThe Local Nous Manager keeps trying to start it. Open the app and look at Brain Process to see why it stops.`,
    },
    local_ai_down: {
        subject: (nous: string) => `${nous} cannot reach its local AI`,
        text: (nous: string) => `${nous} cannot reach the local AI model server on your Mac. It has not answered several times in a row, so ${nous} cannot think.\n\nThe Local Nous Manager keeps trying. Check that Ollama is running on that Mac.`,
    },
} as const;
type Kind = keyof typeof NOTICES;

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} _.-]{0,39}$/u;
const HOUR_MS = 60 * 60 * 1000;

async function sessionDid(req: FastifyRequest): Promise<string | null> {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[COOKIE_NAME];
    if (!token) return null;
    try {
        const { publicKey } = await keyPairPromise;
        const { payload } = await jwtVerify(token, publicKey);
        return typeof payload['did'] === 'string' ? payload['did'] : null;
    } catch {
        return null;
    }
}

export function registerNousAlertRoutes(app: FastifyInstance, services: GridServices): void {
    const grid = services.gridName ?? 'genesis';
    const mailer = services.alertMailer ?? sesMailerFromEnv();
    /** `${did}:${kind}` → when the last mail was sent. */
    const lastSent = new Map<string, number>();

    app.post<{ Body: { kind?: unknown; nous?: unknown } }>('/api/v1/portal/nous-alert', async (req, reply) => {
        const did = await sessionDid(req);
        if (!did) return reply.code(401).send({ error: 'not_authenticated' });

        const kind = req.body?.kind;
        if (kind !== 'brain_down' && kind !== 'local_ai_down') return reply.code(400).send({ error: 'invalid_kind' });
        const given = typeof req.body?.nous === 'string' ? req.body.nous.trim() : '';
        const nous = NAME_RE.test(given) ? given : 'Your Nous';

        const email = services.humanRegistry?.findByDid(grid, did)?.email;
        if (!email) return reply.code(409).send({ error: 'no_email_on_account' });
        if (!mailer) return reply.code(503).send({ error: 'email_not_configured' });

        const key = `${did}:${kind}`;
        const now = Date.now();
        if (now - (lastSent.get(key) ?? -Infinity) < HOUR_MS) return reply.code(429).send({ error: 'already_sent_this_hour' });
        lastSent.set(key, now);

        const notice = NOTICES[kind as Kind];
        try {
            await mailer.send(email, notice.subject(nous), notice.text(nous));
        } catch (err) {
            lastSent.delete(key); // nothing went out — the next try may send
            req.log.warn({ event: 'nous_alert_email_failed', err: String(err) }, 'nous alert email failed');
            return reply.code(502).send({ error: 'email_failed' });
        }
        return reply.send({ ok: true });
    });
}
