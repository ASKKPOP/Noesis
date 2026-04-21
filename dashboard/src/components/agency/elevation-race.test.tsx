/**
 * SC#4 elevation-race regression (D-07) — the single most important test in
 * Phase 6. If it passes, the whole sovereignty discipline holds:
 *
 *   The tier committed to the audit chain is the tier captured at
 *   dialog-confirm time, NOT the tier active when the HTTP request arrives
 *   at Grid.
 *
 * Mechanism asserted: `useElevatedAction` captures { tier, operator_id } into
 * a local body object BEFORE any `await`. A mid-flight `agencyStore.setTier('H1')`
 * fired from inside the dispatch callback MUST NOT mutate the serialized
 * body. See use-elevated-action.ts — the line
 *     const body = { tier: targetTier, operator_id: getOperatorId(), ...p.payload };
 * is load-bearing. If it ever mutates to `agencyStore.getSnapshot()`, this
 * test fails loudly.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useElevatedAction } from '@/hooks/use-elevated-action';
import { ElevationDialog } from '@/components/agency/elevation-dialog';
import { agencyStore } from '@/lib/stores/agency-store';
import { OPERATOR_ID_REGEX } from '@/lib/protocol/agency-types';

/** jsdom 26 shim — see elevation-dialog.test.tsx for rationale. */
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

function Harness({
    dispatch,
    onResult,
}: {
    dispatch: DispatchFn;
    onResult: (r: unknown) => void;
}) {
    const { dialogOpen, onConfirm, onCancel, fire } = useElevatedAction('H4');
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
                targetTier="H4"
                open={dialogOpen}
                onConfirm={onConfirm}
                onCancel={onCancel}
            />
        </>
    );
}

describe('SC#4 elevation-race invariant (D-07)', () => {
    it('SC#4 — committed tier is the confirmed tier, not the tier at HTTP arrival (tier captured at confirm)', async () => {
        const observedBody: Record<string, unknown>[] = [];
        // Mid-flight downgrade: the dispatch callback fires setTier('H1') BEFORE
        // returning. If the hook closed over agencyStore.getSnapshot() instead of
        // the lexical targetTier, the assertion below on body.tier === 'H4' fails.
        const dispatch = vi.fn<DispatchFn>(async (body) => {
            observedBody.push(body);
            act(() => {
                agencyStore.setTier('H1');
            });
            return { ok: true, tier_echo: (body as { tier: string }).tier };
        });

        const resultCollector = vi.fn();
        render(<Harness dispatch={dispatch} onResult={resultCollector} />);

        fireEvent.click(screen.getByTestId('trigger'));
        await act(async () => {
            fireEvent.click(screen.getByTestId('elevation-confirm'));
        });

        // Core invariant assertions.
        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(observedBody).toHaveLength(1);
        expect(observedBody[0]).toMatchObject({
            tier: 'H4', // confirmed tier survives mid-flight downgrade
            target_did: 'did:noesis:x',
        });
        expect(observedBody[0]!.operator_id).toMatch(OPERATOR_ID_REGEX);

        // After dispatch resolves, the auto-downgrade finally ran; tier is H1.
        expect(agencyStore.getSnapshot()).toBe('H1');

        // Caller observed success, with dispatch's resolved value passed through.
        expect(resultCollector).toHaveBeenCalledTimes(1);
        expect(resultCollector).toHaveBeenCalledWith({
            ok: true,
            data: { ok: true, tier_echo: 'H4' },
        });
    });
});
