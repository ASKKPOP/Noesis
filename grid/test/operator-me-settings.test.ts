/**
 * Phase 40 — Operator settings route tests (LOCAL-01, LOCAL-02)
 * Tests GET + PATCH /api/v1/operator/me/settings with LocalAiSettings shape (D-40-02).
 * Wave 0 stubs — implemented in Plan 02.
 */
import { describe, it, vi } from 'vitest';

vi.mock('../../src/operator/data/operator-settings-store.js', () => ({
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
}));

describe('GET /api/v1/operator/me/settings', () => {
    it.todo('returns 200 with LocalAiSettings shape (small_model, primary_model, large_model, temperature, max_tokens, _version: 2)');
    it.todo('returns 401 when no Portal session cookie present');
});

describe('PATCH /api/v1/operator/me/settings', () => {
    it.todo('persists new temperature value and returns updated shape');
    it.todo('returns 401 when no Portal session cookie present');
});

describe('operator-settings-store (unit)', () => {
    it.todo('getSettings() returns qwen3:4b defaults when no DB row exists');
    it.todo('updateSettings() merges patch with current settings and returns new shape');
});
