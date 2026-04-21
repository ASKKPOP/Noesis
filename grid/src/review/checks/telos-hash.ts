// grid/src/review/checks/telos-hash.ts — REV-01 check 5 (malformed_telos_hash).
// STRUCTURAL ONLY per D-05. Phase 7 WATCHPOINT: TelosRegistry will upgrade this to
// semantic "matches latest-seen hash for proposerDid" — DO NOT add registry lookup in Phase 5.

import { registerCheck } from '../registry.js';

const SHA256_HEX_64 = /^[a-f0-9]{64}$/;

registerCheck('malformed_telos_hash', (ctx) => {
    return SHA256_HEX_64.test(ctx.telosHash)
        ? { ok: true }
        : { ok: false, code: 'malformed_telos_hash' };
});
