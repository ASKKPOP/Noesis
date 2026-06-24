/**
 * O3 Forest / O2c-b — client for the human↔Nous PERSISTENT conversation.
 *
 * Talks to the Portal-session-authed grid routes (credentials: 'include' sends the
 * session cookie cross-origin to api.<host>). Persists across reloads/devices,
 * unlike the transient /portal/chat path.
 */
const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

export interface ConvMessage {
    message_id: string;
    sender: 'human' | 'nous';
    text: string;
    tick: number;
}

/** Read the caller's persisted thread with a Nous. [] on any error. */
export async function getThread(nousId: string): Promise<ConvMessage[]> {
    try {
        const res = await fetch(`${GRID_ORIGIN}/api/v1/portal/conversation/${encodeURIComponent(nousId)}`, {
            credentials: 'include', cache: 'no-store',
        });
        if (!res.ok) return [];
        const body = (await res.json()) as { messages?: ConvMessage[] };
        return Array.isArray(body.messages) ? body.messages : [];
    } catch { return []; }
}

/** Persist a human message to a Nous. Returns { ok, message_id? }. */
export async function postMessage(nousId: string, text: string): Promise<{ ok: boolean; message_id?: string }> {
    try {
        const res = await fetch(`${GRID_ORIGIN}/api/v1/portal/conversation/${encodeURIComponent(nousId)}/messages`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (!res.ok) return { ok: false };
        return (await res.json()) as { ok: boolean; message_id?: string };
    } catch { return { ok: false }; }
}
