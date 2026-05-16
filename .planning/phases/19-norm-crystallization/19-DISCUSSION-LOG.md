# Phase 19: Norm Crystallization — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 19-norm-crystallization
**Areas discussed:** Fingerprint wire format, Norm state persistence

---

## Fingerprint wire format

| Option | Description | Selected |
|--------|-------------|----------|
| revision_hash IS the n-gram fingerprint | Brain Phase 15 was designed to compute 6-char n-gram fingerprint as `revision_hash`. NormDetector clusters on it directly. Phase 19 is Grid-side only — verify Brain in Wave 0, correct if wrong. | ✓ |
| revision_hash is full SHA-256 — add new Brain action | Add `ActionType.NORM_FINGERPRINT`; NousRunner routes to NormDetector as internal channel. No new allowlist event. | |

**User's choice:** revision_hash IS the n-gram fingerprint — Phase 19 Grid-side only with Wave 0 Brain audit and correction.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fix Brain in Wave 0, update revision_hash semantics | Change `rules.py` to compute 6-char n-gram fingerprint if it's currently full SHA-256. Closed-tuple stays 3 keys. | ✓ |
| Treat revision_hash as exact-match only | Don't change Brain. Cluster on whatever hash it sends. Effectively disables cross-Nous norm detection. | |

**User's choice:** Fix Brain in Wave 0.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Count the Nous once per fingerprint | N≥3 counts distinct Nous DIDs — single Nous writing 3 matching rules = 1 participant. | ✓ |
| Count each rule write separately | Each `nous.self_model_revised` event adds 1 to count. Allows single-Nous inflation. | |

**User's choice:** Count distinct Nous DIDs.

---

## Norm state persistence

| Option | Description | Selected |
|--------|-------------|----------|
| MySQL derived table | Two tables via MigrationRunner. Persistent, rebuildable, consistent with Phase 9 RelationshipListener. | ✓ |
| In-memory only | Map in memory. Simple but lost on restart. | |

**User's choice:** MySQL derived table.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Two tables: candidates + crystallized | `norm_candidates` (mutable) + `norm_registry` (immutable append-only). Clean separation. | ✓ |
| Single table with status column | `norm_state` with `status` column. Simpler migration but mixes mutable/immutable rows. | |

**User's choice:** Two tables.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild from audit chain | Replay last W-tick `nous.self_model_revised` events at startup. Clone Phase 9 idempotent rebuild. | ✓ |
| Persist candidate state, no rebuild | Rows survive restart as-is. Requires tick-clock management to validate window staleness. | |

**User's choice:** Rebuild from audit chain.

---

## Claude's Discretion

- Exact SQL schema (indexes, NULL constraints, defaults)
- In-memory sliding window data structure shape
- Defection handling during K-tick crystallization window
- Startup rebuild sync vs async

## Deferred Ideas

- REST endpoint for active candidates (observable via audit firehose instead)
- Direct audit-chain scan for causal lineage (RelationshipListener edge lookup used instead)
- Defection events (`norm.weakened` or similar)
