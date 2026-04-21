/**
 * Tests for useElevatedAction — closure-capture race-safe dispatcher (D-07).
 *
 * These tests cover the common hook contract (fire/confirm/cancel/auto-downgrade,
 * operator_id injection, multiple fires). The single-most-important SC#4
 * race-regression test lives in `elevation-race.test.tsx` so its name surfaces
 * explicitly in CI output for traceability.
 *
 * Harness pattern: render a tiny consumer component that exposes the hook
 * methods via test hooks. The ElevationDialog primitive is rendered so that
 * real DOM events (Confirm click) drive the hook — no testing-library
 * renderHook reaching directly into hook internals.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useElevatedAction } from './use-elevated-action';
import { ElevationDialog, type ElevatedTier } from '@/components/agency/elevation-dialog';
import { agencyStore } from '@/lib/stores/agency-store';
import * as storeModule from '@/lib/stores/agency-store';
import { OPERATOR_ID_REGEX } from '@/lib/protocol/agency-types';

/** jsdom 26 shim — see elevation-dialog.test.tsx for notes. */
const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal: () => void;
    close: () => void;
};
proto.showModal = function (this: HTMLDialogElement) {
    (this as unknown as { open: boolean }).open = true;
};
proto.close = function (this: HTMLDialogElement) {
    (this as unknown as { open: boolean }).open = false;
    this.dispatchEvent(new Event('close'));
};

/** Minimal localStorage polyfill for getOperatorId persistence. */
function installLocalStoragePolyfill(): void {
    const map = new Map<string, string>();
    const storage: Storage = {
        get length() {
            return map.size;
        },
        clear(): void {
            map.clear();
        },
        getItem(key: string): string | null {
            return map.has(key) ? (map.get(key) as string) : null;
        },
        key(index: number): string | null {
            return Array.from(map.keys())[index] ?? null;
        },
        removeItem(key: string): void {
            map.delete(key);
        },
        setItem(key: string, value: string): void {
            map.set(String(key), String(value));
        },
    };
    Object.defineProperty(window, 'localStorage', {
        value: storage,
        configurable: true,
        writable: true,
    });
}

beforeAll(() => {
    installLocalStoragePolyfill();
});

beforeEach(() => {
    window.localStorage.clear();
    act(() => {
        agencyStore.setTier('H1');
    });
});

type DispatchFn = (body: Record<string, unknown>) => Promise<unknown>;
type ResultFn = (r: unknown) => void;

function Harness({
    tier,
    dispatch,
    onResult,
}: {
    tier: ElevatedTier;
    dispatch: DispatchFn;
    onResult: ResultFn;
}) {
    const { dialogOpen, onConfirm, onCancel, fire } = useElevatedAction(tier);
    return (
        <>
            <button
                data-testid="trigger"
                onClick={() => {
                    void fire({ target_did: 'did:noesis:x' }, dispatch).then(onResult);
                }}
            >
                fire
            </button>
            <ElevationDialog
                targetTier={tier}
                open={dialogOpen}
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        </>
    );
}

describe('useElevatedAction — fire opens dialog and elevates store', () => {
    it('fire() sets dialogOpen=true and calls agencyStore.setTier(targetTier)', () => {
        const dispatch = vi.fn<DispatchFn>(async () => ({ ok: true }));
        render(<Harness tier="H3" dispatch={dispatch} onResult={() => {}} />);

        expect(agencyStore.getSnapshot()).toBe('H1');
        fireEvent.click(screen.getByTestId('trigger'));

        expect(agencyStore.getSnapshot()).toBe('H3');
        expect(screen.queryByTestId('elevation-dialog')).not.toBeNull();
    });
});

describe('useElevatedAction — onCancel aborts without dispatch', () => {
    it('clicking Cancel resolves { ok:false, reason:"cancelled" } and auto-downgrades', async () => {
        const dispatch = vi.fn<DispatchFn>(async () => ({ ok: true }));
        const results: unknown[] = [];

        render(
            <Harness
                tier="H3"
                dispatch={dispatch}
                onResult={(r) => results.push(r)}
            />,
        );
        fireEvent.click(screen.getByTestId('trigger'));
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-cancel'));
        });

        expect(dispatch).not.toHaveBeenCalled();
        expect(agencyStore.getSnapshot()).toBe('H1');
        expect(results).toEqual([{ ok: false, reason: 'cancelled' }]);
    });
});

describe('useElevatedAction — onConfirm dispatches with captured tier + operator_id', () => {
    it('clicking Confirm calls dispatch once with { tier, operator_id, ...payload }', async () => {
        const dispatch = vi.fn<DispatchFn>(async () => ({ ok: true, tier_echo: 'H3' }));
        const results: unknown[] = [];

        render(
            <Harness
                tier="H3"
                dispatch={dispatch}
                onResult={(r) => results.push(r)}
            />,
        );
        fireEvent.click(screen.getByTestId('trigger'));
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
        });

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                tier: 'H3',
                target_did: 'did:noesis:x',
                operator_id: expect.stringMatching(OPERATOR_ID_REGEX),
            }),
        );
    });
});

describe('useElevatedAction — auto-downgrade in finally', () => {
    it('after dispatch resolves successfully, tier returns to H1 and result.ok=true', async () => {
        const dispatch = vi.fn<DispatchFn>(async () => ({ data: 1 }));
        const results: unknown[] = [];

        render(
            <Harness tier="H4" dispatch={dispatch} onResult={(r) => results.push(r)} />,
        );
        fireEvent.click(screen.getByTestId('trigger'));
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
        });

        expect(agencyStore.getSnapshot()).toBe('H1');
        expect(results).toEqual([{ ok: true, data: { data: 1 } }]);
    });

    it('after dispatch rejects, tier returns to H1 and result resolves { ok:false, reason:"failed" }', async () => {
        const dispatch = vi.fn<DispatchFn>(async () => {
            throw new Error('boom');
        });
        const results: unknown[] = [];

        render(
            <Harness tier="H4" dispatch={dispatch} onResult={(r) => results.push(r)} />,
        );
        fireEvent.click(screen.getByTestId('trigger'));
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
        });

        expect(agencyStore.getSnapshot()).toBe('H1');
        expect(results).toEqual([{ ok: false, reason: 'failed' }]);
    });
});

describe('useElevatedAction — operator_id injection order', () => {
    it('getOperatorId fires BEFORE dispatch (body construction is pre-I/O per D-07)', async () => {
        const calls: string[] = [];
        const getOperatorIdSpy = vi
            .spyOn(storeModule, 'getOperatorId')
            .mockImplementation(() => {
                calls.push('getOperatorId');
                return 'op:00000000-0000-4000-8000-000000000000';
            });
        const dispatch = vi.fn<DispatchFn>(async () => {
            calls.push('dispatch');
            return { ok: true };
        });

        render(<Harness tier="H3" dispatch={dispatch} onResult={() => {}} />);
        fireEvent.click(screen.getByTestId('trigger'));
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
        });

        expect(calls).toEqual(['getOperatorId', 'dispatch']);
        expect(dispatch).toHaveBeenCalledWith(
            expect.objectContaining({
                operator_id: 'op:00000000-0000-4000-8000-000000000000',
            }),
        );
        getOperatorIdSpy.mockRestore();
    });
});

describe('useElevatedAction — superseding pending fire', () => {
    it('a second fire() while one is pending resolves the first as cancelled', async () => {
        const dispatchA = vi.fn<DispatchFn>(async () => ({ ok: true, tag: 'a' }));
        const dispatchB = vi.fn<DispatchFn>(async () => ({ ok: true, tag: 'b' }));

        const firstResults: unknown[] = [];
        const secondResults: unknown[] = [];

        function DualHarness() {
            const { dialogOpen, onConfirm, onCancel, fire } = useElevatedAction('H3');
            return (
                <>
                    <button
                        data-testid="fire-a"
                        onClick={() => {
                            void fire({ tag: 'a' }, dispatchA).then((r) =>
                                firstResults.push(r),
                            );
                        }}
                    />
                    <button
                        data-testid="fire-b"
                        onClick={() => {
                            void fire({ tag: 'b' }, dispatchB).then((r) =>
                                secondResults.push(r),
                            );
                        }}
                    />
                    <ElevationDialog
                        targetTier="H3"
                        open={dialogOpen}
                        onConfirm={onConfirm}
                        onCancel={onCancel}
                    />
                </>
            );
        }

        render(<DualHarness />);
        fireEvent.click(screen.getByTestId('fire-a'));
        fireEvent.click(screen.getByTestId('fire-b'));
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
        });

        // First fire superseded → cancelled; second fire confirmed → dispatched.
        expect(firstResults).toEqual([{ ok: false, reason: 'cancelled' }]);
        expect(dispatchA).not.toHaveBeenCalled();
        expect(dispatchB).toHaveBeenCalledTimes(1);
        expect(dispatchB).toHaveBeenCalledWith(
            expect.objectContaining({ tier: 'H3', tag: 'b' }),
        );
        expect(secondResults).toEqual([{ ok: true, data: { ok: true, tag: 'b' } }]);
    });
});

afterAll(() => {
    vi.restoreAllMocks();
});
