---
status: partial
phase: 22-web3-identity
source: [22-VERIFICATION.md]
started: 2026-05-20T00:00:00Z
updated: 2026-05-20T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Middleware redirect — /portal → /portal/auth (no JWT)
expected: Browser is redirected to /portal/auth without showing portal content
result: pass

### 2. SIWE sign-in flow — wallet connect → sign → redirect to /portal
expected: Wallet prompts to sign a SIWE message; after signing, page redirects to /portal
result: skipped
reason: MetaMask not enabled in incognito — user skipped

### 3. Post-sign-in — visit /portal/auth again
expected: Redirects back to /portal (JWT cookie present, middleware passes through)
result: [pending]

### 4. /api/v1/portal/auth/me with cookie
expected: Returns { did, eth_address } matching the connected wallet address
result: [pending]

### 5. Reconnect idempotency — sign in twice (WEB3-06)
expected: Second sign-in does NOT fire a second human.joined audit event
result: [pending]

### 6. CORS check — POST /api/v1/portal/auth/verify from browser (CR-02)
expected: Browser preflight succeeds; credentials:include POST allowed (requires CORS configured for POST + credentials)
result: [pending]

## Summary

total: 6
passed: 1
issues: 0
pending: 4
skipped: 1
blocked: 0

## Gaps
