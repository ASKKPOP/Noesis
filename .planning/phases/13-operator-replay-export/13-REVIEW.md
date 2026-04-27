---
phase: 13-operator-replay-export
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - README.md
  - dashboard/src/app/grid/components/firehose.tsx
  - dashboard/src/app/grid/components/inspector.tsx
  - dashboard/src/app/grid/components/region-map.tsx
  - dashboard/src/app/grid/replay/export-consent-dialog.test.tsx
  - dashboard/src/app/grid/replay/export-consent-dialog.tsx
  - dashboard/src/app/grid/replay/page.tsx
  - dashboard/src/app/grid/replay/replay-client.test.tsx
  - dashboard/src/app/grid/replay/replay-client.tsx
  - dashboard/src/app/grid/replay/scrubber.tsx
  - dashboard/src/app/grid/replay/use-replay-session.ts
  - dashboard/src/test/setup.ts
  - dashboard/tests/e2e/replay.spec.ts
  - grid/src/api/operator/export-replay.ts
  - grid/src/api/operator/index.ts
  - grid/src/audit/append-operator-exported.ts
  - grid/src/audit/broadcast-allowlist.ts
  - grid/src/export/canonical-json.ts
  - grid/src/export/index.ts
  - grid/src/export/manifest.ts
  - grid/src/export/tarball-builder.ts
  - grid/src/replay/index.ts
  - grid/src/replay/readonly-chain.ts
  - grid/src/replay/replay-grid.ts
  - grid/src/replay/state-builder.ts
  - grid/src/replay/tarball.ts
  - grid/test/audit/allowlist-twenty-six.test.ts
  - grid/test/audit/allowlist-twenty-two.test.ts
  - grid/test/audit/broadcast-allowlist.test.ts
  - grid/test/audit/operator-exported-allowlist.test.ts
  - grid/test/audit/operator-exported-payload-privacy.test.ts
  - grid/test/audit/operator-exported-producer-boundary.test.ts
  - grid/test/export/canonical-json.test.ts
  - grid/test/relationships/allowlist-frozen.test.ts
  - grid/test/replay/readonly-chain.test.ts
  - grid/test/replay/replay-grid.test.ts
  - grid/test/replay/state-builder.test.ts
  - grid/test/replay/tarball-determinism.test.ts
  - scripts/check-replay-readonly.mjs
  - scripts/check-state-doc-sync.mjs
  - scripts/check-wallclock-forbidden.mjs
  - scripts/replay-verify.mjs
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-27
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

Phase 13 implements Operator Replay & Export: a `/grid/replay` rewind surface plus a deterministic audit-chain tarball export. The overall architecture is sound and the multi-layer defense discipline (type system + runtime throws + CI grep gates) is faithfully carried forward from prior phases. The allowlist, sole-producer boundary, payload privacy gate, and closed-tuple enforcement all appear correctly implemented.

One critical security issue was found: the export confirm handler in `replay-client.tsx` fires the fetch immediately after `onConfirm()` but does **not** wait for the dialog's close animation — more importantly, it completely silences fetch errors, leaving the operator with no signal when export fails. Combined with the audit event already having been committed before the bytes stream back, a network failure between those two events means the operator sees nothing while the audit chain records an export that the operator never received. This is an unhandled error path with no user feedback.

Four warnings were found covering an off-by-one in the tarball adapter's `startReplay` slice logic, a double-fire risk on the `ExportConsentDialog` `onCancel` callback, a missing teardown of the `setTimeout` toast timer in `inspector.tsx`, and the `replay-client.tsx` confirm handler mutating state on an already-unmounted component.

Three informational items cover minor code quality notes.

## Critical Issues

### CR-01: Export fetch errors are swallowed — operator receives no feedback on failure

**File:** `dashboard/src/app/grid/replay/replay-client.tsx:220`
**Issue:** The `onConfirm` handler catches all fetch/network errors with an empty `.catch(() => { // Export fetch failed — silently ignore for now })`. By the time this error occurs the audit event (`operator.exported`) has already been committed to the chain (the route appends *before* streaming per the D-30 order invariant). The operator sees the dialog close and nothing else — no toast, no error banner. The phrase "for now" in the comment signals this was intentional deferral, but it creates a UX gap where a real export failure is indistinguishable from success.

**Fix:**
```tsx
// Replace the silent catch with user feedback.
// Add error state to ReplayClient:
const [exportError, setExportError] = useState<string | null>(null);

// In the onConfirm handler's .catch():
}).catch(() => {
    setExportError('Export failed. Check Grid connectivity and retry.');
});

// Render below the export button:
{exportError && (
    <p
        data-testid="replay-export-error"
        className="mt-1 text-xs text-red-400"
        role="alert"
    >
        {exportError}
    </p>
)}
```

## Warnings

### WR-01: Off-by-one in tarball adapter's startReplay slice — entry at startTick included in start snapshot

**File:** `grid/src/replay/tarball.ts:60`
**Issue:** `startReplay` is constructed with `sortedEntries.slice(0, startTick)`. Because `entry.id` is 1-based and the entries array is 0-indexed, `slice(0, startTick)` cuts at position `startTick` (exclusive), which excludes exactly the `startTick`-th entry. However the export route in `export-replay.ts` builds its `startEntries` as `allEntries.filter((e) => (e.id ?? 0) <= startTickN)` — inclusive of the entry whose `id === startTick`. The two slice strategies are inconsistent: the standalone `tarball.ts` helper excludes `id===startTick` from the start snapshot while the route's own `buildStateAtTick` call includes it. This means `tarball.ts`'s start-snapshot state will diverge from the route's start-snapshot whenever the slice is used directly, breaking the determinism invariant for any consumer that calls `buildExportTarball` from `tarball.ts` directly.

**Fix:**
```typescript
// In grid/src/replay/tarball.ts, line 60 — change the filter to be
// consistent with export-replay.ts (inclusive):
const startEntries = sortedEntries.filter((e) => (e.id ?? 0) <= startTick);
const startReplay = new ReplayGrid(startEntries, gridName);
```

### WR-02: ExportConsentDialog close event fires onCancel twice on programmatic confirm path

**File:** `dashboard/src/app/grid/replay/export-consent-dialog.tsx:82-91` and `172-174`
**Issue:** The `close` event listener registered in `useEffect` (lines 82–91) always calls `onCancel()`. The confirm button (line 172) calls `onConfirm()` without first closing the dialog. If the parent's `onConfirm` eventually triggers `open=false → dlg.close()` (via the `open` prop changing in the `useEffect` at line 63–74), the `close` event will fire and call `onCancel()` as well as the already-called `onConfirm()`. This mirrors an identical bug in the referenced `IrreversibilityDialog` pattern but matters here because `onCancel` also calls `agencyStore.setTier('H1')` — a confirmed export would downgrade tier unexpectedly.

**Fix:**
```tsx
// Track whether onConfirm was called to suppress the close-event onCancel.
const confirmedRef = useRef(false);

// In confirm button onClick:
onClick={() => {
    confirmedRef.current = true;
    onConfirm();
}}

// In handleClose:
const handleClose = () => {
    openerRef?.current?.focus();
    agencyStore.setTier('H1');
    if (!confirmedRef.current) {
        onCancel();
    }
    confirmedRef.current = false;
};
```

### WR-03: Toast setTimeout in inspector.tsx not cleaned up — potential state update after unmount

**File:** `dashboard/src/app/grid/inspector.tsx:207-210`
**Issue:** `showToast` schedules a bare `setTimeout(() => setToast(null), 4000)` with no cleanup. If the inspector closes (component unmounts) while the timer is pending, React will still attempt to call `setToast(null)` on the unmounted component. In React 18 this is a no-op warning, but the function reference captured by the closure may keep the component alive in memory longer than expected.

**Fix:**
```typescript
// Replace bare setTimeout with a ref-tracked timer:
const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, id: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
};

// Add cleanup in useEffect:
useEffect(() => {
    return () => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
}, []);
```

### WR-04: ReplayClient onConfirm handler updates state after potential unmount

**File:** `dashboard/src/app/grid/replay/replay-client.tsx:193-224`
**Issue:** The `onConfirm` callback passed to `ExportConsentDialog` contains a `.then(res => res.blob().then(...))` chain that calls `URL.createObjectURL`, creates an anchor, and clicks it. This entire chain runs asynchronously after `setExportDialogOpen(false)` on line 194. If the user navigates away from `/grid/replay` between the `fetch()` call and the `.then()` resolution, `ReplayClient` will have unmounted (triggering the `agencyStore.setTier('H1')` cleanup), but the blob URL creation and anchor click will still execute against a detached document — an already-unmounted component's closure. The anchor element will be created and clicked in a stale execution context. An `AbortController` tied to the component's mount lifetime would prevent this.

**Fix:**
```typescript
// Add an AbortController for the export fetch, cleaned up on unmount:
const exportAcRef = useRef<AbortController | null>(null);

useEffect(() => {
    return () => {
        agencyStore.setTier('H1');
        exportAcRef.current?.abort();  // cancel in-flight export on unmount
    };
}, []);

// In onConfirm:
onConfirm={() => {
    setExportDialogOpen(false);
    if (origin) {
        const ac = new AbortController();
        exportAcRef.current = ac;
        fetch(`${origin}/api/v1/operator/replay/export`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ tier: 'H5', operator_id: gridId, start_tick: startTick, end_tick: endTick }),
            signal: ac.signal,
        }).then((res) => {
            if (ac.signal.aborted) return;
            if (res.ok) {
                return res.blob().then((blob) => {
                    if (ac.signal.aborted) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `replay-${startTick}-${endTick}.tar`;
                    a.click();
                    URL.revokeObjectURL(url);
                });
            }
        }).catch((err) => {
            if ((err as { name?: string }).name === 'AbortError') return;
            setExportError('Export failed. Check Grid connectivity and retry.');
        });
    }
}}
```

## Info

### IN-01: `replayMode` prop accepted but not wired — Firehose, Inspector, RegionMap read live store regardless

**File:** `dashboard/src/app/grid/components/firehose.tsx:61`, `dashboard/src/app/grid/components/inspector.tsx:102`, `dashboard/src/app/grid/components/region-map.tsx:58`
**Issue:** All three components accept a `replayMode` prop that is immediately aliased to `_replayMode` (prefixed with underscore to silence the unused-variable warning). The prop is documented as "Phase 13 (REPLAY-05): when true, reads from replay store instead of live store" but the actual store-switching logic is not implemented — both `useFirehose()` and `usePresence()` read from the live store unconditionally. This is a stub, not a bug, but it means the replay route's firehose panel will show live events rather than the rewound chain entries if these components are ever mounted inside `ReplayClient`. Given that `ReplayClient` renders its own `replay-firehose` div (not these components), the impact is currently zero, but the dead prop is misleading.

**Fix:** Either remove the `replayMode` prop and the underscore aliases until the store-switching logic is implemented, or add a TODO comment with a reference to the phase/ticket that will complete the wiring.

### IN-02: `check-state-doc-sync.mjs` asserts "21 events" but checks 27 — misleading comment

**File:** `scripts/check-state-doc-sync.mjs:11`
**Issue:** The script header comment says "Asserts the STATE.md Accumulated Context stays in sync with the frozen broadcast allowlist invariant" and line 11 lists the invariant as "STATE.md mentions '21 events'", but the actual assertion on line 47 checks for `"27 events"`. The comment block was not updated when the count changed through subsequent phases.

**Fix:** Update the comment on line 11 to read `"27 events"` instead of `"21 events"`.

### IN-03: `tarball-determinism.test.ts` uses `require('node:stream')` — inconsistent with ESM module context

**File:** `grid/test/replay/tarball-determinism.test.ts:139`
**Issue:** The test file uses `import` statements throughout (ESM) but line 139 contains `const { Readable } = require('node:stream')`. The top of the file (lines 20–22) already imports from ES modules. The `require()` call in an ESM file will either fail (if not CJS-interop) or inject a CommonJS dependency unexpectedly.

**Fix:**
```typescript
// Add to the existing imports at the top of the file:
import { Readable } from 'node:stream';

// Remove the inline require() on line 139:
// const { Readable } = require('node:stream');   <-- delete this line
```

---

_Reviewed: 2026-04-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
