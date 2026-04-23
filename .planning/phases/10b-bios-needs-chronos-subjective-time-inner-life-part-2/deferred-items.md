# Phase 10b — Deferred Items

## From Plan 10b-03

- `test/ci/bios-no-walltime.test.ts` chronos subtest fails because `grid/src/chronos/` does not yet exist. Belongs to Plan 10b-04 (Brain Chronos retrieval) — out of scope for 10b-03 per plan files_modified list. Bios subtest passes GREEN.
- `test/regression/pause-resume-10b.test.ts` requires `grid/src/chronos/wire-listener.js` and `grid/src/bios/runtime.js`. Both are Wave 4+ artifacts (Plan 10b-04). Out of scope for 10b-03.
