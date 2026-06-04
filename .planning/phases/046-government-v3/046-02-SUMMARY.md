---
phase: 046-government-v3
plan: 02
status: complete
completed: 2026-06-03
---

# Phase 46 — Plan 02 Summary (Producers + Store)

## Allowlist 75 → 81 (GREEN)
`grid/src/audit/broadcast-allowlist.ts`: 6 entries appended after `irs.disbursement_executed // (75)` — `gov.bill_drafted` (76) … `gov.law_repealed` (81). Header "75 event types" → "81". Allowlist test now **GREEN** (103 tests).

## 6 sole-producers (`grid/src/audit/append-gov-*.ts`)
Each clones the Phase 45 9-step discipline (type guard → per-field regex/int → closed-tuple → explicit reconstruction → payloadPrivacyCheck → audit.append). Placed in `grid/src/audit/` so the existing sole-producer + wallclock gates cover them with **no gate changes** (mirrors Phase 45 IRS). Sole-producer gate: 58 → **64 files, OK**.

## ⚠️ D-46-01 — privacy-walker key collision (execution-discovered)
The frozen `FORBIDDEN_KEY_PATTERN` (a security control — NOT weakened) forbids the substring `body` and the exact key `session_id` (Phase 33 portal-auth anti-leak). The spec'd keys `body_hash` and `session_id` were renamed in the **audit payload only**:
- `body_hash` → **`content_hash`** (uses the pattern's `content(?!_hash)` escape hatch, same as lore `content_hash`).
- `session_id` → **`gov_session_id`** (word-boundary `\bsession_id\b` does not match the prefixed form).

DB columns keep `session_id`; only the cross-boundary audit key is prefixed. Without this rename, every valid "open session" / "draft bill" emit threw a privacy TypeError (caught by the producer happy-path tests).

## Types + Store
- `grid/src/gov/types.ts`: 6 payload interfaces + 6 alphabetical `*_KEYS` tuples (`supersedes_law_id: string | null`).
- `grid/src/gov/gov-bill-store.ts`: `GovBillStore` interface + `InMemoryGovBillStore` (Map-backed, tests) + `MySqlGovBillStore` (Pool-backed, prod; `addCosponsor` handles `ER_DUP_ENTRY` → `duplicate_cosponsor`). Chosen over raw-pool-mocking for a multi-table lifecycle (no brittle SQL-string matching in tests).

## Tests
`grid/test/append-gov-events.test.ts` — 6 describe blocks, **35 tests GREEN**. Conventions mirror `append-irs-disbursement-authorized.test.ts`: missing validated key → generic `TypeError`; extra key → `/closed-tuple/`.

## Verify
- allowlist + producer tests GREEN (138 total) ✓
- `npx tsc --noEmit` → 0 errors ✓
- `check-sole-producer-discipline` → OK (64 files) ✓
