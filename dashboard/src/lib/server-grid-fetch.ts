/**
 * safeGridFetch — never-throwing, 3s-timeout SSR fetch helper.
 *
 * Incident (2026-07-06): async server components did top-level
 * `await fetch(`${origin}/api/v1/...`, { cache: 'no-store' })` to the Grid with
 * NO timeout and NO non-2xx / non-JSON handling. When the Grid restarted or was
 * slow these awaits hung → the Node event loop backed up → every route (even the
 * static landing) timed out (000). Some endpoints also 401 without a cookie,
 * whose HTML body then crashed .json()/JSON.parse.
 *
 * This helper hardens the transport so a Grid outage degrades exactly one page
 * and can never back up the event loop:
 *   - AbortSignal.timeout(3000): no SSR await outlives ~3s.
 *   - res.ok guard: non-2xx (401/403/404/500) → null.
 *   - content-type guard: non-JSON body (auth-redirect HTML) → null, never
 *     reaching JSON.parse.
 *   - try/catch: network / DNS / timeout AbortError / parse error → null.
 *
 * It NEVER throws. Callers keep their own response interface via the generic <T>.
 * No external deps — AbortSignal.timeout / AbortSignal.any are Node 18+/20+
 * built-ins available in the Next 15.2 server runtime.
 */
export async function safeGridFetch<T>(
    url: string,
    init?: RequestInit,
): Promise<T | null> {
    const timeout = AbortSignal.timeout(3000);
    // Merge a caller-supplied signal with the timeout so BOTH can abort.
    const signal = init?.signal
        ? AbortSignal.any([init.signal, timeout])
        : timeout;
    try {
        // Spread init FIRST, then override signal, so cache:'no-store' and any
        // headers from the caller survive.
        const res = await fetch(url, { ...init, signal });
        if (!res.ok) return null;
        const ct = res.headers.get('content-type');
        if (!ct || !ct.toLowerCase().includes('application/json')) return null;
        return (await res.json()) as T;
    } catch {
        // network / DNS / timeout (AbortError) / JSON parse → graceful null
        return null;
    }
}
