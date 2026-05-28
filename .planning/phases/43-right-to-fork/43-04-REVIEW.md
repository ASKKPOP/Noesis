---
phase: 43-04
reviewed: 2026-05-28T20:19:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - steward/src/components/fork-irreversibility-dialog.tsx
  - steward/src/components/fork-irreversibility-dialog.test.tsx
  - steward/src/app/system/local-ai/page.tsx
  - steward/vitest.config.ts
  - steward/src/test/setup.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 43-04: Code Review Report

**Reviewed:** 2026-05-28T20:19:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files covering the ForkIrreversibilityDialog component, its test suite, the local-ai page integration, the vitest config, and the test setup shims were reviewed at standard depth.

The component implementation is structurally sound. The D-43-03 verbatim copy constants match between the component and test file exactly. The closure-capture pattern (`capturedDidRef`) is correctly set at open time. `onPaste` preventDefault and `onKeyDown` Enter preventDefault are both present. `autoFocus` is on the Cancel button. All 10 tests pass.

Three warnings require attention before phase is marked complete. None are security vulnerabilities in the traditional sense, but two (WR-01, WR-02) produce incorrect runtime behavior that violates architectural invariants in the plan. The third (WR-03) is a latent test infrastructure gap that will silently suppress JSX parse errors in vitest v4 if the current behavior changes.

## Warnings

### WR-01: `onCancel` fires after a successful confirm — semantic double-fire

**File:** `steward/src/components/fork-irreversibility-dialog.tsx:81-91` and `steward/src/app/system/local-ai/page.tsx:152-154`

**Issue:** The confirm button (`irrev-delete`) calls `onConfirm` directly without calling `dlg.close()`. The page's `handleForkConfirm` calls `setForkOpen(false)` on line 154, which causes the `open → false` effect (lines 64-75 of the component) to call `dlg.close()`. The `close` event fires, and `handleClose` on line 84 unconditionally calls `onCancel()`. The net result: every successful fork confirm triggers `onCancel` (`setForkOpen(false)`) a second time after the confirm path has already closed the dialog.

This violates the plan's stated invariant: "All close paths (ESC, backdrop, Cancel, programmatic) fire onCancel via the native `close` event — single onCancel source." The confirm path is not a cancel path; it should not fire `onCancel`. Currently the duplicate call is harmless because `setForkOpen(false)` is idempotent, but it is semantically wrong and will cause a real bug if `onCancel` is ever given any side-effect beyond `setForkOpen(false)` (e.g., resetting error state, logging an abandonment event, restoring focus to a different element).

The analog Phase 8 `IrreversibilityDialog` has the same architecture and therefore the same latent issue — but this is the right moment to note it before it propagates further.

**Fix:** The confirm button should call `dlg.close()` immediately before (or instead of relying on) the parent's state update, and the `handleClose` listener should be able to distinguish a "confirm close" from a "cancel close". The simplest approach — matching the single-source-of-truth pattern — is to introduce a `confirmedRef` flag:

```tsx
// In ForkIrreversibilityDialog:
const confirmedRef = useRef(false);

// In the close listener:
const handleClose = () => {
    openerRef?.current?.focus();
    if (!confirmedRef.current) {
        onCancel();
    }
    confirmedRef.current = false; // reset for next open
};

// Confirm button onClick:
onClick={() => {
    confirmedRef.current = true;
    onConfirm();
    dialogRef.current?.close();
}}
```

This keeps `onCancel` as the single close-path sink while correctly suppressing it on the confirm path.

---

### WR-02: `download_url` from server response is placed into `a.href` and rendered as a clickable `<a href>` without origin validation

**File:** `steward/src/app/system/local-ai/page.tsx:175` and `:342`

**Issue:** The `download_url` value comes from `await res.json() as ForkResult` (server-controlled). It is assigned to a programmatic anchor `a.href = data.download_url` (line 175) and also rendered as `<a href={forkResult.download_url}>click here</a>` (line 342). If the Grid endpoint were compromised or a mis-configured reverse proxy returned an attacker-controlled JSON body, the `download_url` could be a `javascript:` URI or an off-origin redirect.

The threat model for this plan (T-43-error-leak) explicitly accepts error-body disclosure, but does not address `download_url` manipulation. The one-time token binding (Plan 02) mitigates token replay, but does not prevent a malicious `download_url` value from being used in the client.

**Fix:** Validate that `download_url` is a same-origin relative path or starts with the expected absolute origin before use:

```typescript
function isSafeDownloadUrl(url: string): boolean {
    // Accept relative paths (e.g. /api/v1/operator/fork/.../download?token=...)
    if (url.startsWith('/')) return true;
    try {
        const parsed = new URL(url);
        return parsed.origin === window.location.origin;
    } catch {
        return false;
    }
}

// In handleForkConfirm, after parsing data:
if (!isSafeDownloadUrl(data.download_url)) {
    setForkError('Server returned an invalid download URL');
    setForkStatus('error');
    return;
}
```

Apply this check before both the programmatic anchor assignment (line 175) and the fallback `<a href>` render (line 342).

---

### WR-03: `vitest.config.ts` uses `esbuild` option — silently ignored in vitest v4 OXC mode; tests pass only because vitest 2.x is installed

**File:** `steward/vitest.config.ts:5-8`

**Issue:** The SUMMARY documents (line 109-124) that the `esbuild` option in `vitest.config.ts` is "silently ignored" when OXC is active in vitest v4, and that the fix was to add `@vitejs/plugin-react` as a plugin. However, `steward/package.json` shows `"vitest": "^2.1.0"` (installed as `v2.1.9` per test run output), not v4. The `esbuild` option works correctly in vitest 2.x. The tests pass today, but if vitest is upgraded to v4 (the semver range `^2.1.0` won't reach v4 automatically, but a manual bump is likely), JSX parsing will silently break.

The SUMMARY describes a fix that was planned but the file was never updated to include `@vitejs/plugin-react`. The config is currently correct for vitest 2.x but fragile for future upgrades.

**Fix:** Either pin the vitest version to `^2.1.0` explicitly and add a comment warning about the v4 incompatibility, or proactively add the plugin now:

```typescript
// steward/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
    plugins: [react()],   // Required for vitest v4+ OXC; harmless on v2
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        css: false,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    },
});
```

If choosing the plugin approach, add `@vitejs/plugin-react` to devDependencies in `steward/package.json`.

---

## Info

### IN-01: `setup.ts` lines 12-22 are dead code — unconditional re-patch on lines 24-31 always overwrites them

**File:** `steward/src/test/setup.ts:12-22`

**Issue:** Lines 12-22 install conditional shims for `showModal` and `close` only when the method is missing or not native code. However, lines 24-31 immediately re-assign both methods unconditionally, making the conditional block unreachable-by-effect. The guards on lines 12 and 17 are never needed because the unconditional patches on lines 24-31 always win.

**Fix:** Remove lines 12-22 (the dead conditional block) and keep only the unconditional patches at lines 24-31. The result is shorter and clearer:

```typescript
if (typeof HTMLDialogElement !== 'undefined') {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
        (this as unknown as { open: boolean }).open = true;
    };
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
        (this as unknown as { open: boolean }).open = false;
        this.dispatchEvent(new Event('close'));
    };
}
```

---

### IN-02: Test `43-04-03c` does not reset dialog state — `onCancel` may be called by the close-event side-effect, making the assertion accidentally pass

**File:** `steward/src/components/fork-irreversibility-dialog.test.tsx:98-103`

**Issue:** Test 43-04-03c clicks Cancel and asserts `props.onCancel` was called. This test passes correctly today. However, because `cancelBtn`'s `onClick` calls `dialogRef.current?.close()` (which fires the `close` event, which calls `onCancel`), the assertion is verifying the side-effect path, not a direct `onCancel` call. This is the intended behavior (single close-path source). The test comment could be clearer that it is testing the `close → handleClose → onCancel` chain, not a direct invocation. No code change required, but consider adding a comment.

**Fix (optional, comment only):**
```typescript
it('43-04-03c: clicking Cancel calls onCancel prop', () => {
    const props = renderDialog();
    const cancelBtn = screen.getByTestId('irrev-cancel');
    // Cancel button calls dlg.close() → fires 'close' event → handleClose → onCancel
    fireEvent.click(cancelBtn);
    expect(props.onCancel).toHaveBeenCalled();
});
```

---

### IN-03: `testid="irrev-delete"` on the confirm button — plan specifies `irrev-confirm`

**File:** `steward/src/components/fork-irreversibility-dialog.tsx:186`

**Issue:** The plan (Task 1 behavior list, line 145) states: `data-testid values preserved from analog: ... irrev-delete (or rename to irrev-confirm if cleaner)`. The SUMMARY (line 58) records the decision: "ForkIrreversibilityDialog uses `data-testid='irrev-confirm'` (vs analog's `irrev-delete`) — fork-specific semantics." The actual component still uses `irrev-delete`, which retains the delete-semantics testid on a fork component. The test file queries `irrev-delete` consistently, so this does not break tests — it is purely a naming inconsistency between the recorded decision and the implementation.

**Fix:** Rename `data-testid="irrev-delete"` to `data-testid="irrev-confirm"` in the component, and update the three `getByTestId('irrev-delete')` references in the test file to match. This aligns with the SUMMARY's stated decision and makes the fork dialog's testids self-documenting.

---

### IN-04: `NousRecord.civic_did` can be `null` per interface but `nousRes` failure is silent — fork button may appear disabled when network is degraded, not when Civic-DID is missing

**File:** `steward/src/app/system/local-ai/page.tsx:89-94`

**Issue:** If the `/api/v1/operator/me/nous` request fails (network error, 4xx, 5xx), `nousRes.ok` is false and `civicDid` stays `null`. The page shows "No Nous to fork yet. Register a Civic-DID first." — which is misleading when the actual cause is a load failure, not a missing Civic-DID. The SUMMARY notes this as a known stub, so this is low-priority, but it produces a confusing UX.

**Fix:** Add a separate error state for the nous load failure, or at minimum surface a different message when `nousRes` is not ok:

```typescript
if (!nousRes.ok && nousRes.status !== 404) {
    // Non-fatal — fork button disabled with network error message
    console.warn(`Nous fleet load failed: ${nousRes.status}`);
}
```

No blocking change required; this is informational until Phase 46 wires the Civic-DID registry fully.

---

_Reviewed: 2026-05-28T20:19:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
