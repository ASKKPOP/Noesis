// grid/src/review/checks/balance.ts — REV-01 check 1 (insufficient_balance).
// Mirrors grid/src/registry/registry.ts:137-139 `insufficient` branch exactly.
// DO NOT introduce subjective reasoning — see REV-04 lint gate.

import { registerCheck } from '../registry.js';

registerCheck('insufficient_balance', (ctx) => {
    return ctx.proposerBalance >= ctx.amount
        ? { ok: true }
        : { ok: false, code: 'insufficient_balance' };
});
