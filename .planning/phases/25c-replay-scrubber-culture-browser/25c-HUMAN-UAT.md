---
status: partial
phase: 25c-replay-scrubber-culture-browser
source: [25c-VERIFICATION.md]
started: 2026-05-22T20:00:00Z
updated: 2026-05-22T20:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Tier source for replay-modal H3+ gate
expected: The scrubber modal should gate based on the *viewing operator's* session tier, not the exporting operator's tier. Current implementation passes `operatorTier={selected.payload.tier}` (the exporting operator's tier, always 'H5') so the H3+ gate effectively always passes. Verify if this is intentional v1 behavior or a wiring bug — if unintentional, the modal needs to receive the current session's operator tier instead.
result: [pending]

### 2. Culture panels render correctly with live Grid data
expected: Navigating to /culture with a running Grid should render three SVG panels (Skill Lineage, Norm Timeline, Lore Graph) with real data, the Nous DID filter bar filters Skill Lineage and Lore Graph by ?nous=<did>, Norm Timeline always shows all norms Grid-wide.
result: [pending]

### 3. Replay scrubber H4 redaction with real operator tiers
expected: With live Grid export data and different operator session tiers — H3 operators see slider + event list with SENSITIVE_KEYS fields redacted (telos_text, creed_text, message, text, etc.), H4/H5 operators see slider + event list with no redaction, H1/H2 see gate message instead of slider.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
