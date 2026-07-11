// grid/src/review/checks/balance.ts — REV-01 check 1 (insufficient_balance).
// Mirrors grid/src/registry/registry.ts:137-139 `insufficient` branch exactly.
// DO NOT introduce subjective reasoning — see REV-04 lint gate.

import { registerCheck } from '../registry.js';

registerCheck('insufficient_balance', (ctx) => {
    // WR-05: proposerBalance is a wei bigint; compare in BigInt space so the gate is exact
    // above 2^53. `amount` is a finite number bounded by validateTransfer (positive integer
    // < maxTransfer); Math.trunc keeps a non-integer amount from throwing here (it is caught
    // and rejected at the authoritative settle) while being a no-op for real integer wei.
    return ctx.proposerBalance >= BigInt(Math.trunc(ctx.amount))
        ? { ok: true }
        : { ok: false, code: 'insufficient_balance' };
});
