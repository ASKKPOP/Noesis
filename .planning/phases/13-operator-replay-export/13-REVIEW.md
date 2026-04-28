---
phase: 13-operator-replay-export
reviewed: 2026-04-27T00:00:00Z
depth: standard
files_reviewed: 49
files_reviewed_list:
  - README.md
  - dashboard/src/app/grid/components/firehose-row.tsx
  - dashboard/src/app/grid/components/firehose.tsx
  - dashboard/src/app/grid/components/inspector.tsx
  - dashboard/src/app/grid/components/region-map.tsx
  - dashboard/src/app/grid/replay/export-consent-dialog.test.tsx
  - dashboard/src/app/grid/replay/export-consent-dialog.tsx
  - dashboard/src/app/grid/replay/page.tsx
  - dashboard/src/app/grid/replay/replay-client.test.tsx
  - dashboard/src/app/grid/replay/replay-client.tsx
  - dashboard/src/app/grid/replay/replay-redaction-copy.ts
  - dashboard/src/app/grid/replay/replay-stores.tsx
  - dashboard/src/app/grid/replay/scrubber.tsx
  - dashboard/src/app/grid/replay/use-replay-session.ts
  - dashboard/src/app/grid/use-stores.ts
  - dashboard/src/test/setup.ts
  - dashboard/tests/e2e/replay.spec.ts
  - grid/package.json
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
  - package.json
  - scripts/check-relationship-graph-deps.mjs
  - scripts/check-replay-readonly.mjs
  - scripts/check-state-doc-sync.mjs
  - scripts/check-wallclock-forbidden.mjs
  - scripts/replay-verify.mjs
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-27
**Depth:** standard
**Files Reviewed:** 49
**Status:** issues_found

## Summary

Phase 13 introduces the Operator Replay & Export feature: a deterministic tarball exporter, a read-only replay engine, and a consent-gated dashboard surface. The architecture and multi-layer defense disciplines (type system + runtime throws + CI grep gates) are well-implemented and faithfully carry forward from prior phases. The allowlist sole-producer boundary, payload privacy gate, closed-tuple enforcement, and T-10-07/T-10-08 invariants are all correctly in place.

No critical security vulnerabilities were found. Five warnings were found covering: silent export failure feedback, an inconsistent slice strategy in the tarball adapter, a close-handler double-fire risk, an unguarded async fetch against potential unmount, and an uncleared toast timer. Five informational items cover dead code, a stale comment, an ESM/CJS mixing issue, a missing `operator_id` source, and an unused prop stub.

---

## Warnings

### WR-01: Silent export failure — operator receives no feedback when export fetch fails

**File:** `dashboard/src/app/grid/replay/replay-client.tsx:206`

**Issue:** The `onConfirm` fetch callback catches all errors with `.catch(() => { // Export fetch failed — silently ignore for now })`. When the fetch fails (network error, HTTP 4xx/5xx, or a non-`ok` response), the dialog has already closed and the operator receives no signal. Since the route commits the audit event *before* streaming bytes back (D-30 order invariant), a network failure between commit and delivery means the audit chain records an export that the operator never received, with no feedback to the operator and no recovery path visible.

**Fix:**
```tsx
// Add error state to ReplayClient:
const [exportError, setExportError] = useState<string | null>(null);

// In the onConfirm handler's .catch():
}).catch((err) => {
    if ((err as { name?: string }).name !== 'AbortError') {
        setExportError('Export failed. Check Grid connectivity and retry.');
    }
});

// Also handle non-ok HTTP response:
if (!res.ok) {
    setExportError(`Export failed: HTTP ${res.status}`);
    return;
}

// Render below the export button:
{exportError && (
    <p data-testid="replay-export-error" className="mt-1 text-xs text-red-400" role="alert">
        {exportError}
    </p>
)}
```

---

### WR-02: Inconsistent slice strategy in `tarball.ts` startReplay — uses count, not tick id

**File:** `grid/src/replay/tarball.ts:60`

**Issue:** `startReplay` is constructed with `sortedEntries.slice(0, startTick)`, which uses `startTick` as a **count / array index** rather than an entry id filter. The production export route in `export-replay.ts` builds the equivalent slice with `allEntries.filter((e) => (e.id ?? 0) <= startTickN)` — inclusive on the entry whose `id === startTick`. These two strategies diverge whenever entry ids are non-contiguous or the slice does not begin at id=1. For example, if `startTick=5` but the provided entries start at id=3, `slice(0, 5)` takes all five entries instead of the three with ids ≤ 5. This produces a different start snapshot than what the route would generate, breaking the snapshot consistency for any consumer of the `tarball.ts` adapter (including `replay-verify.mjs` if used against route output).

**Fix:**
```typescript
// grid/src/replay/tarball.ts line 60 — replace slice with id-based filter:
const startReplay = new ReplayGrid(
    sortedEntries.filter((e) => (e.id ?? 0) <= startTick),
    gridName,
);
```

---

### WR-03: ExportConsentDialog `close` event fires `onCancel` on the confirm path

**File:** `dashboard/src/app/grid/replay/export-consent-dialog.tsx:82-91`

**Issue:** The native `close` event listener registered in the second `useEffect` (lines 82–91) unconditionally calls `agencyStore.setTier('H1')` and `onCancel()` on every close. When the operator clicks "Export forever", `onConfirm()` is called (line 172) and the parent eventually sets `open=false`, which causes the `useEffect` at lines 63–74 to call `dlg.close()`. That fires the `close` event, which then calls `onCancel()` a second time and downgrades the tier mid-export. The confirm and cancel paths are not distinguished.

**Fix:**
```tsx
// Add a ref to track whether confirm was clicked:
const confirmedRef = useRef(false);

// In confirm onClick:
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

---

### WR-04: Export fetch in `replay-client.tsx` not guarded against component unmount

**File:** `dashboard/src/app/grid/replay/replay-client.tsx:193-210`

**Issue:** The `onConfirm` callback starts an async `fetch()` after `setExportDialogOpen(false)`. If the operator navigates away from `/grid/replay` while the fetch is in flight, the `useEffect` cleanup fires `agencyStore.setTier('H1')` and the component unmounts, but the `.then()` resolution still runs: it creates a blob URL, creates an anchor element, and calls `.click()` in a stale execution context with no abort signal. The blob URL is also created and immediately revoked inside the same microtask, which may produce an unreliable download on slow responses.

**Fix:**
```tsx
// In the useEffect cleanup, abort any in-flight export:
const exportAcRef = useRef<AbortController | null>(null);

useEffect(() => {
    return () => {
        agencyStore.setTier('H1');
        exportAcRef.current?.abort();
    };
}, []);

// In onConfirm, pass signal and guard all async steps:
const ac = new AbortController();
exportAcRef.current = ac;
fetch(url, { method: 'POST', headers, body, signal: ac.signal })
    .then((res) => {
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
    })
    .catch((err) => {
        if ((err as { name?: string }).name === 'AbortError') return;
        setExportError('Export failed. Check Grid connectivity and retry.');
    });
```

---

### WR-05: Toast `setTimeout` in `inspector.tsx` not cleared on unmount

**File:** `dashboard/src/app/grid/components/inspector.tsx:207-210`

**Issue:** `showToast` schedules `setTimeout(() => setToast(null), 4000)` with no cleanup ref. If the Inspector unmounts while the timer is pending (e.g., the operator closes the drawer within 4 seconds of a delete operation), the timer's callback fires on the unmounted component, calling `setToast(null)` after unmount. In React 18 this produces a no-op warning and may hold a closure reference keeping the component's state in memory longer than expected.

**Fix:**
```typescript
const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, id: Date.now() });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
};

// Add cleanup in a useEffect:
useEffect(() => {
    return () => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
}, []);
```

---

## Info

### IN-01: `replayMode` prop accepted but immediately discarded — Firehose, Inspector, RegionMap read live store unconditionally

**File:** `dashboard/src/app/grid/components/firehose.tsx:61`, `dashboard/src/app/grid/components/inspector.tsx:102`, `dashboard/src/app/grid/components/region-map.tsx:58`

**Issue:** All three components accept a `replayMode` prop that is immediately renamed to `_replayMode` to suppress the unused-variable lint warning. The prop is documented as the store-switching mechanism, but neither `useFirehose()` nor `usePresence()` inspects it. The actual store override happens via `ReplayStoresProvider`'s context injection, so for the current design the prop is entirely vestigial. It signals a design intent that was not implemented at the component level.

**Fix:** Remove the `replayMode` prop from the three components (and update their callers in `replay-client.tsx`), since the store override is already handled by `ReplayStoresProvider` without it. If the prop is intended for future non-provider-based usage, add a comment explaining the planned wiring.

---

### IN-02: `use-replay-session.ts` is not imported anywhere and defines a duplicate `AuditEntry` type

**File:** `dashboard/src/app/grid/replay/use-replay-session.ts`

**Issue:** The hook is not imported by any other file in scope. The data flow for the replay route goes through `page.tsx` (server component) props to `ReplayClient`, bypassing this hook entirely. The file also defines a local `AuditEntry` interface (lines 13–22) that duplicates `@/lib/protocol/audit-types`, and a `ReplayState` type that shadows the same name in `grid/src/replay/state-builder.ts`.

**Fix:** Either integrate `useReplaySession` into `ReplayClient` to drive client-side audit slice fetching, or remove the file if the server-component fetch pattern is the canonical approach.

---

### IN-03: `gridId=""` default in `page.tsx` means export `operator_id` is always empty string

**File:** `dashboard/src/app/grid/replay/page.tsx:82`

**Issue:** `ReplayPage` passes `gridId=""` to `ReplayClient`. The export fetch sends `operator_id: gridId` in the body. An empty string will fail `OPERATOR_ID_RE` validation in `appendOperatorExported` and return `400 audit_emit_failed`. This means the export feature will never succeed in the current server-component implementation — the operator can complete the consent dialog, the fetch will fire, and it will always receive a 400. This is related to WR-01 since the failure will be silently swallowed.

**Fix:** Determine the canonical source for the operator id (session cookie, header, env var, or URL param) and pass a real `op:<uuid-v4>` value to `ReplayClient` from `page.tsx`. The `gridId` and `operator_id` concepts may need to be separated into distinct props.

---

### IN-04: `tarball-determinism.test.ts` uses `require()` in an ESM module context

**File:** `grid/test/replay/tarball-determinism.test.ts:139`

**Issue:** The file uses `import` throughout but line 139 contains `const { Readable } = require('node:stream')`. This CommonJS `require()` inside an ESM test file will either fail in strict ESM mode or create a CJS/ESM interop dependency. The `node:stream` module is already importable as ESM.

**Fix:**
```typescript
// Add to the existing imports at the top of the file:
import { Readable } from 'node:stream';

// Remove line 139:
// const { Readable } = require('node:stream');
```

---

### IN-05: `check-state-doc-sync.mjs` header comment still references "21 events"

**File:** `scripts/check-state-doc-sync.mjs:11`

**Issue:** The script header on line 11 says: `"STATE.md mentions '21 events' (the Phase-10b post-ship count)"` but the actual assertion on line 47 checks for `"27 events"`. The comment is stale from Phase 10b and was not updated as the count grew through Phases 11, 12, and 13.

**Fix:** Update the comment on line 11 to `"27 events" (the Phase-13 post-ship count)`.

---

_Reviewed: 2026-04-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
