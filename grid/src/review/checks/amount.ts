// grid/src/review/checks/amount.ts — REV-01 check 3 (non_positive_amount).
// Mirrors grid/src/registry/registry.ts:126-128 `invalid_amount` branch exactly.

import { registerCheck } from '../registry.js';

registerCheck('non_positive_amount', (ctx) => {
    return Number.isInteger(ctx.amount) && ctx.amount > 0
        ? { ok: true }
        : { ok: false, code: 'non_positive_amount' };
});
