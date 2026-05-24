# Deferred Items — Phase 25c

## Pre-existing Test Failures (out-of-scope for 25c-02)

The following 21 test failures exist in the `feat/grid-retheme-portal-dashboard` branch and predate Phase 25c-02. They were invisible before because the original `vitest.config.ts` caused all JSX test files to fail with parse errors (44 files), masking these deeper failures.

After fixing the JSX parse issue (25c-02 Task 1), 5 test files now fail with pre-existing behavioral failures:

| File | Failure | Cause |
|------|---------|-------|
| `src/app/grid/components/firehose-row.test.tsx` | expects `border-rose-900`, gets `border-rose-400` | Branch retheme changed Tailwind classes |
| `src/app/grid/components/heartbeat.test.tsx` | expects `text-red-400`, gets `animate-pulse` | Branch retheme changed stale state styling |
| `src/app/grid/components/inspector.test.tsx` | Multiple failures: missing `section-psyche`, missing `inspector-h5-delete` | Retheme removed/renamed data-testid attributes |
| `test/integration/delete-flow.test.tsx` | Integration flow broken | Depends on inspector changes from retheme |
| `src/components/portal/__tests__/PortalSidebarHeader.test.tsx` | `aside.style.transform` empty string | Retheme changed sidebar implementation |

**Action:** These failures should be addressed in the final 25c plan or as a dedicated bug-fix pass before merging the branch.
