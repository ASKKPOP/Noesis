---
status: resolved
phase: 43-right-to-fork
source: [43-VERIFICATION.md]
started: 2026-05-28T03:15:00Z
updated: 2026-05-28T03:15:00Z
---

## Current Test

[awaiting human decision on SC4 + 3 verification items]

## Tests

### 1. SC4 — Fork verify endpoint (product decision)
expected: POST /api/v1/operator/fork/verify returns {found: true, forked_at_tick: N, civic_did: <did>}
result: [pending — endpoint not yet implemented. Decision: ship in Phase 43 gap closure or defer to Phase 49?]

### 2. SC2 — Standalone Brain memory inspector
expected: Run standalone CLI with real archive → Steward Console renders imported memory
result: [pending — requires live Brain process]

### 3. SC3 — Civic action gate error code
expected: Civic actions return error code 'civic_features_unavailable_in_standalone'
result: [pending — implemented returns 'grid_unavailable'. Deviation intentional?]

### 4. SC1 — Archive file structure alignment
expected: archive uses brain/memory/karpathy.json, civic/civic-did.jws (per ROADMAP SC1)
result: [pending — implemented uses memory/*.db, credentials/civic-did.vc.json. Structural refinement OK?]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
