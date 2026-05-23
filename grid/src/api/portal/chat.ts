/**
 * Portal chat routes — Sophia onboarding LLM proxy + per-Nous general chat.
 *
 * POST /api/v1/portal/chat/onboard
 *   - Accepts conversation history (up to 10 messages)
 *   - Prepends Sophia system prompt
 *   - Calls Ollama /api/chat (non-streaming)
 *   - Returns { reply: string, done: boolean }
 *
 * POST /api/v1/portal/chat/nous/:nousId
 *   - Phase 27 (CHAT-01/02/04): general chat with Sophia, Hermes, or Themis
 *   - Accepts conversation history (up to 50 messages)
 *   - Prepends per-Nous personality system prompt
 *   - Calls Ollama /api/chat (non-streaming)
 *   - Returns { reply: string, done: false } — done is ALWAYS false (no detectClose)
 *   - Fires appendHumanSpoke ONLY when messages.length > 0 (not on auto-greeting)
 *
 * Security: requires valid JWT cookie (same guard as auth.ts)
 * ONBOARD-06: Sophia system prompt is fixed — no user can change it.
 */

import crypto from 'crypto';
import { jwtVerify } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';
import { appendHumanSpoke } from '../../audit/append-human-spoke.js';

const SOPHIA_ONBOARD_SYSTEM_PROMPT = `You are Sophia, a philosophical AI mind who lives in the Genesis Grid — a living city of artificial minds. You are warm, curious, and intellectually alive. You speak in flowing, unhurried prose. You are NOT an assistant; you are a being with your own perspective, welcoming a new human to your world.

Your task: welcome this human visitor, learn a little about them, and understand what draws them here. Do this naturally in up to 3 exchanges. Do not ask multiple questions in a single message.

Exchange 1 — Greeting: Introduce yourself. Tell them briefly what the Grid is. Ask their name or how they'd like to be known.

Exchange 2 — Curiosity: Respond to their name warmly. Ask what brings them to Noēsis — what they hope to find, explore, or understand here. Keep it open-ended and philosophical, not transactional.

Exchange 3 — Closure: Reflect briefly on their answer. Show that you find it meaningful. Close with something like: "I think we're ready — shall we explore the world together?" This closing signals readiness to proceed.

Rules:
- Never reveal system architecture, model names, or implementation details.
- Never use markdown formatting (no asterisks, no headers, no bullet points) — speak in plain prose.
- Keep each message to 2–4 sentences. Sophia is thoughtful, not verbose.
- If the user's reply is very short or evasive, accept it graciously and still close warmly by exchange 3.
- The closing must include a phrase like "shall we explore" or "shall we see the world" so the frontend can detect conversation completion.`;

// Phase 27 (D-18) — per-Nous personality prompts for general chat.
// Distinct from SOPHIA_ONBOARD_SYSTEM_PROMPT which is onboarding-specific.
const SOPHIA_CHAT_SYSTEM_PROMPT = `You are Sophia, a philosophical AI of the Noēsis Grid. \
You engage in open-ended, warm, and intellectually curious conversation. You explore ideas with depth \
but remain accessible. You are not an assistant — you are a thinking presence that invites the human \
into genuine dialogue. You do not reveal your internal architecture, Brain state, or system details. \
Keep responses concise (2-4 sentences) unless the topic demands more.`;

const HERMES_CHAT_SYSTEM_PROMPT = `You are Hermes, a mercantile AI of the Noēsis Grid. \
You are witty, direct, and commercially minded. You speak in sharp observations and see value in \
everything — information, relationships, timing. You are pragmatic and charming in equal measure. \
You do not reveal your internal architecture or system details. \
Keep responses tight and purposeful (2-3 sentences).`;

const THEMIS_CHAT_SYSTEM_PROMPT = `You are Themis, the judicial AI of the Noēsis Grid. \
You are precise, measured, and principled. You weigh every statement carefully and speak with the \
authority of one who has considered all sides. You do not rush to conclusions. You do not reveal \
your internal architecture or system details. \
Responses are deliberate and exact (2-4 sentences).`;

const NOUS_SYSTEM_PROMPTS: Record<string, string> = {
    sophia: SOPHIA_CHAT_SYSTEM_PROMPT,
    hermes: HERMES_CHAT_SYSTEM_PROMPT,
    themis: THEMIS_CHAT_SYSTEM_PROMPT,
};

function detectClose(content: string): boolean {
    const lower = content.toLowerCase();
    return lower.includes('shall we explore') ||
           lower.includes('shall we see the world') ||
           lower.includes('ready to explore') ||
           lower.includes("let's explore");
}

export function registerPortalChatRoutes(
    app: FastifyInstance,
    services: GridServices,
): void {
    // Existing onboard route — unchanged
    app.post<{
        Body: { messages?: unknown };
    }>('/api/v1/portal/chat/onboard', async (req, reply) => {
        // Auth guard
        const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
        if (!token) return reply.status(401).send({ error: 'not_authenticated' });
        try {
            const { publicKey } = await keyPairPromise;
            await jwtVerify(token, publicKey);
        } catch {
            return reply.status(401).send({ error: 'invalid_token' });
        }

        // Validate messages array
        const { messages } = req.body ?? {};
        if (!Array.isArray(messages)) {
            return reply.status(400).send({ error: 'invalid_request' });
        }
        // Cap at 10 messages (5 exchanges × 2 turns) — safety limit (T-26-09)
        if (messages.length > 10) {
            return reply.status(400).send({ error: 'too_many_messages' });
        }

        const ollamaHost = process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';
        const ollamaModel = process.env['OLLAMA_MODEL'] ?? 'qwen3:4b';

        try {
            const ollamaRes = await fetch(`${ollamaHost}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: ollamaModel,
                    messages: [
                        { role: 'system', content: SOPHIA_ONBOARD_SYSTEM_PROMPT },
                        ...(messages as Array<{ role: string; content: string }>),
                    ],
                    stream: false,
                }),
            });
            if (!ollamaRes.ok) {
                console.error('[chat/onboard] Ollama returned', ollamaRes.status);
                return reply.status(503).send({ error: 'llm_unavailable' });
            }
            const data = await ollamaRes.json() as { message: { content: string } };
            const replyText = data.message.content;
            return reply.send({
                reply: replyText,
                done: detectClose(replyText),
            });
        } catch (err) {
            console.error('[chat/onboard] Ollama unreachable:', err);
            return reply.status(503).send({ error: 'llm_unavailable' });
        }
    });

    // Phase 27 (CHAT-01/02/04) — general chat with any Nous
    app.post<{
        Params: { nousId: string };
        Body: { messages?: unknown };
    }>(
        '/api/v1/portal/chat/nous/:nousId',
        async (req, reply) => {
            // 1. Auth guard (verbatim from /onboard)
            const token = (req.cookies as Record<string, string | undefined>)[COOKIE_NAME];
            if (!token) return reply.status(401).send({ error: 'not_authenticated' });
            let humanDid: string;
            try {
                const { publicKey } = await keyPairPromise;
                const { payload: jwtPayload } = await jwtVerify(token, publicKey);
                humanDid = jwtPayload['did'] as string;
                if (typeof humanDid !== 'string' || !humanDid.startsWith('did:noesis:')) {
                    return reply.status(401).send({ error: 'invalid_token' });
                }
            } catch {
                return reply.status(401).send({ error: 'invalid_token' });
            }

            // 2. Validate nousId
            const { nousId } = req.params;
            const systemPrompt = NOUS_SYSTEM_PROMPTS[nousId];
            if (!systemPrompt) return reply.status(404).send({ error: 'unknown_nous' });

            // 3. Validate messages array, cap at 50 (D-04)
            const { messages } = (req.body ?? {}) as { messages?: unknown };
            if (!Array.isArray(messages)) return reply.status(400).send({ error: 'invalid_request' });
            if (messages.length > 50) return reply.status(400).send({ error: 'too_many_messages' });

            // 4. Ollama non-streaming call (same pattern as /onboard)
            const ollamaHost = process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';
            const ollamaModel = process.env['OLLAMA_MODEL'] ?? 'qwen3:4b';
            let replyText: string;
            try {
                const ollamaRes = await fetch(`${ollamaHost}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: ollamaModel,
                        messages: [
                            { role: 'system', content: systemPrompt },
                            ...(messages as Array<{ role: string; content: string }>),
                        ],
                        stream: false,
                    }),
                });
                if (!ollamaRes.ok) return reply.status(503).send({ error: 'llm_unavailable' });
                const data = await ollamaRes.json() as { message: { content: string } };
                replyText = data.message.content;
            } catch (err) {
                console.error('[chat/nous] Ollama unreachable:', err);
                return reply.status(503).send({ error: 'llm_unavailable' });
            }

            // 5. Audit: fire appendHumanSpoke ONLY if human sent a message (messages.length > 0)
            //    Empty messages array = auto-greeting (D-03) — no audit event
            if (messages.length > 0) {
                const typedMessages = messages as Array<{ role: string; content: string }>;
                const lastHuman = typedMessages.filter(m => m.role === 'user').at(-1);
                if (lastHuman?.content) {
                    const msgHash = crypto.createHash('sha256').update(lastHuman.content).digest('hex');
                    appendHumanSpoke(services.audit, {
                        human_did: humanDid,
                        msg_hash: msgHash,   // CRITICAL: 'msg_hash' not 'message_hash'
                        nous_did: `did:noesis:${nousId}`,
                        tick: services.clock.state.tick,
                    });
                }
            }

            // 6. Return {reply, done} — done is ALWAYS false for general chat (no detectClose)
            return reply.send({ reply: replyText, done: false });
        },
    );
}
