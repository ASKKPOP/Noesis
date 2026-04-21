// grid/src/review/checks/memory-refs.ts — REV-01 check 4 (malformed_memory_refs).
// STRUCTURAL ONLY per D-05 (reviewer verifies shape; brain self-attests semantic existence).
// Format per RQ3: `mem:<int>` where int is the brain-side Memory.id primary key.

import { registerCheck } from '../registry.js';

const MEM_ID_PATTERN = /^mem:\d+$/;

registerCheck('malformed_memory_refs', (ctx) => {
    const refs = ctx.memoryRefs;
    if (!Array.isArray(refs) || refs.length === 0) {
        return { ok: false, code: 'malformed_memory_refs' };
    }
    for (const ref of refs) {
        if (typeof ref !== 'string' || !MEM_ID_PATTERN.test(ref)) {
            return { ok: false, code: 'malformed_memory_refs' };
        }
    }
    return { ok: true };
});
