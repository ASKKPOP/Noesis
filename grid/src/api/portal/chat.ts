/**
 * Portal chat routes — Sophia onboarding LLM proxy.
 *
 * POST /api/v1/portal/chat/onboard
 *   - Accepts conversation history (up to 10 messages)
 *   - Prepends Sophia system prompt
 *   - Calls Ollama /api/chat (non-streaming)
 *   - Returns { reply: string, done: boolean }
 *
 * Security: requires valid JWT cookie (same guard as auth.ts)
 * ONBOARD-06: Sophia system prompt is fixed — no user can change it.
 */

import { jwtVerify } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { COOKIE_NAME, keyPairPromise } from './auth.js';

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

function detectClose(content: string): boolean {
    const lower = content.toLowerCase();
    return lower.includes('shall we explore') ||
           lower.includes('shall we see the world') ||
           lower.includes('ready to explore') ||
           lower.includes("let's explore");
}

export function registerPortalChatRoutes(
    app: FastifyInstance,
    _services: GridServices,
): void {
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
}
