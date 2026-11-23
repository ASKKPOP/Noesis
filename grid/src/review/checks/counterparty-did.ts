// grid/src/review/checks/counterparty-did.ts — REV-01 check 2 (invalid_counterparty_did).
// DID regex is the FROZEN Phase 1 invariant — /^did:noesis:[a-z0-9_\-]+$/i. DO NOT WIDEN.
// Also rejects self-transfer (counterparty === proposerDid) — mirrors registry.ts:135 `self_transfer`.

import { registerCheck } from '../registry.js';
import { NOESIS_DID_RE as DID_PATTERN } from '../../util/id-patterns.js';

registerCheck('invalid_counterparty_did', (ctx) => {
    if (!DID_PATTERN.test(ctx.counterparty)) {
        return { ok: false, code: 'invalid_counterparty_did' };
    }
    if (ctx.counterparty === ctx.proposerDid) {
        return { ok: false, code: 'invalid_counterparty_did' };
    }
    return { ok: true };
});
