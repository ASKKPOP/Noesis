---
status: partial
updated: 2026-05-21T02:35:00Z
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
result: pass

### 4. /api/v1/portal/auth/me with cookie
expected: Returns { did, eth_address } matching the connected wallet address
result: blocked
blocked_by: prior-phase
reason: "Cannot sign in — MetaMask SDK webpack error (test 2) blocks SIWE. Discovered email auth form calling /api/v1/portal/auth/email/signup which returns 404 — email auth UI exists but no backend endpoint."

### 5. Reconnect idempotency — sign in twice (WEB3-06)
expected: Second sign-in does NOT fire a second human.joined audit event
result: blocked
blocked_by: prior-phase
reason: "SIWE not functional — MetaMask SDK webpack error blocks sign-in"

### 6. CORS check — POST /api/v1/portal/auth/verify from browser (CR-02)
expected: Browser preflight succeeds; credentials:include POST allowed (requires CORS configured for POST + credentials)
result: blocked
blocked_by: prior-phase
reason: "SIWE not functional — MetaMask SDK webpack error blocks sign-in"

## Summary

total: 6
passed: 2
issues: 1
pending: 0
skipped: 1
blocked: 3

## Gaps

- truth: "Email auth form calls a working backend endpoint"
  status: failed
  reason: "User reported: POST /api/v1/portal/auth/email/signup returns 404 — email auth UI exists but no backend route is registered"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
