---
status: partial
phase: 40-local-ai-integration
source: [40-VERIFICATION.md]
started: 2026-05-27T09:15:00.000Z
updated: 2026-05-27T09:15:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Local AI page renders with real model dropdowns
expected: Navigate to /system/local-ai with Brain + Ollama running; dropdowns show installed models (e.g. qwen3:4b); temperature/max_tokens show saved values (0.7 / 2048)
result: [pending]

### 2. Save shows amber banner
expected: Change temperature, click Save → "Restart Brain to apply changes." amber banner appears immediately
result: [pending]

### 3. Ollama offline red banner
expected: pkill ollama, wait 15s → red banner: "Local AI offline — using [provider] fallback. Memory content is leaving this machine."
result: [pending]

### 4. Recovery auto-dismisses banner
expected: ollama serve, wait 15s → red banner disappears without page refresh
result: [pending]

### 5. Brain restart uses selected model
expected: Change model, save, restart Brain → Brain log shows "[Brain] Settings fetched: primary=<selected>"
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
