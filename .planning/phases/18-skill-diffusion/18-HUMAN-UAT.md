---
status: partial
phase: 18-skill-diffusion
source: [18-VERIFICATION.md]
started: 2026-05-16T11:38:00Z
updated: 2026-05-16T11:38:00Z
---

## Current Test

[awaiting human decision]

## Tests

### 1. OL Rate-Limit Gate — tick-based vs observation-count-based

expected: Inferred skills are rate-limited to one creation per sleep epoch (30 ticks) per Nous (ROADMAP Success Criterion 2). Confirm whether the current observation-count gate (MIN_OBSERVATIONS_BEFORE_EXTRACT=2 in observational.py line 54) satisfies this, or whether a separate tick-based gate is required.

The conflict: the count gate blocks extraction until the same buyer/seller/item pair is seen twice, but places no restriction on how many tick-epochs that spans. An adversarial seller could force 2 identical observations within a single tick epoch, satisfying the count gate while violating the 30-tick cadence.

Options:
  A — Accept the observation-count gate as sufficient. No new code needed.
  B — Add a tick-based gate: track `_last_extraction_tick` per Nous, block if `current_tick - last_extraction_tick < 30`. Requires a new plan.

result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
