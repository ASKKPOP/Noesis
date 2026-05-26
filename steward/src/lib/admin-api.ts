'use client';

/**
 * Admin API client for the Local Management Site (post-v2.6).
 *
 * All endpoints are gated by GRID_ADMIN_ENABLED=true on the Grid side.
 * When the env is unset, every call returns 503 — caller must surface this
 * as "Admin disabled — enable via .env and restart Grid".
 *
 * Auth: x-operator-tier + x-operator-id headers. Tier requirements:
 *   - GET /config        → H4
 *   - PUT /config        → H5 (config change is sovereign-tier)
 *   - POST /restart/...  → H5
 *   - GET /notifications → H3
 */

import { useEffect, useState } from 'react';

const GRID_ORIGIN = process.env.NEXT_PUBLIC_GRID_ORIGIN ?? 'http://localhost:8080';

// Local operator identity for admin actions. In production this would be a real
// SSO/operator-token flow; for the local management site we generate a stable
// UUID per browser session and use H5 by default (since the site itself is
// localhost-only and the operator running it IS the admin).
function getAdminOperatorId(): string {
    if (typeof window === 'undefined') return 'op:00000000-0000-4000-8000-000000000000';
    const k = 'noesis_admin_operator_id';
    let id = localStorage.getItem(k);
    if (id) return id;
    // RFC4122 v4 UUID
    const rand = crypto.getRandomValues(new Uint8Array(16));
    rand[6] = (rand[6] & 0x0f) | 0x40;
    rand[8] = (rand[8] & 0x3f) | 0x80;
    const hex = Array.from(rand).map((b) => b.toString(16).padStart(2, '0')).join('');
    id = `op:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    localStorage.setItem(k, id);
    return id;
}

function adminHeaders(tier: 3 | 4 | 5): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'x-operator-tier': String(tier),
        'x-operator-id': getAdminOperatorId(),
    };
}

export interface ConfigEntry {
    value: string;
    masked: boolean;
    editable: boolean;
}

export interface ConfigResponse {
    config: Record<string, ConfigEntry>;
    env_path: string;
}

export interface NotificationEntry {
    ts: number;
    level: number;
    level_name: string;
    module: string;
    event?: string;
    msg: string;
}

export interface NotificationsResponse {
    count: number;
    ring_capacity: number;
    ring_size: number;
    events: NotificationEntry[];
}

export interface ApiResult<T> {
    ok: boolean;
    data?: T;
    error?: string;
    detail?: string;
    status?: number;
}

async function call<T>(path: string, init: RequestInit & { tier: 3 | 4 | 5 }): Promise<ApiResult<T>> {
    try {
        const res = await fetch(`${GRID_ORIGIN}${path}`, { ...init, headers: { ...adminHeaders(init.tier), ...(init.headers || {}) } });
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string; detail?: string };
        if (!res.ok) {
            return { ok: false, status: res.status, error: body.error || `HTTP ${res.status}`, detail: body.detail };
        }
        return { ok: true, status: res.status, data: body as T };
    } catch (e) {
        return { ok: false, error: 'network_error', detail: e instanceof Error ? e.message : String(e) };
    }
}

export function getConfig(): Promise<ApiResult<ConfigResponse>> {
    return call<ConfigResponse>('/api/v1/admin/config', { method: 'GET', tier: 4 });
}

export function putConfig(updates: Record<string, string>): Promise<ApiResult<{ ok: boolean; keys_changed: string[]; backup_path: string; restart_required: boolean }>> {
    return call('/api/v1/admin/config', {
        method: 'PUT',
        tier: 5,
        body: JSON.stringify({ updates }),
    });
}

export function restartService(service: string): Promise<ApiResult<{ ok: boolean; service: string; restart_completed: boolean }>> {
    return call(`/api/v1/admin/restart/${encodeURIComponent(service)}`, { method: 'POST', tier: 5 });
}

export function getNotifications(opts: { eventPrefix?: string; minLevel?: number; limit?: number } = {}): Promise<ApiResult<NotificationsResponse>> {
    const qs = new URLSearchParams();
    if (opts.eventPrefix) qs.set('event_prefix', opts.eventPrefix);
    if (opts.minLevel !== undefined) qs.set('min_level', String(opts.minLevel));
    if (opts.limit !== undefined) qs.set('limit', String(opts.limit));
    return call<NotificationsResponse>(`/api/v1/admin/notifications?${qs}`, { method: 'GET', tier: 3 });
}

/** React hook — poll any admin endpoint every `intervalMs`. */
export function usePolling<T>(fn: () => Promise<ApiResult<T>>, intervalMs = 5000): { result: ApiResult<T> | null; refresh: () => void } {
    const [result, setResult] = useState<ApiResult<T> | null>(null);
    const [tick, setTick] = useState(0);
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const r = await fn();
            if (!cancelled) setResult(r);
        };
        run();
        const id = setInterval(run, intervalMs);
        return () => { cancelled = true; clearInterval(id); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intervalMs, tick]);
    return { result, refresh: () => setTick((t) => t + 1) };
}
