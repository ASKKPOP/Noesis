# Phase 43: Right-to-Fork Export Tooling — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 43-right-to-fork
**Areas discussed:** Standalone Brain scope, Package contents & format, Fork consent gate UX, Allowlist delta discrepancy

---

## Standalone Brain scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full scope — Grid export + Brain standalone | Phase 43 ships both: Grid produces archive, Brain can import and run standalone. Constitutional right-to-fork fully honored. | ✓ |
| Grid-only now, Brain-side later | Phase 43 ships only the Grid export API. Brain standalone mode is a follow-up phase. | |

**User's choice:** Full scope — Grid export + Brain standalone

| Option | Description | Selected |
|--------|-------------|----------|
| Full cognition, local only | Brain uses memory + Ollama, responds to operator. Civic actions return `grid_unavailable` error. | ✓ |
| Read-only replay mode | Standalone Brain only lets operator browse memory/audit. No active cognition. | |

**User's choice:** Full cognition, local only

**Notes:** Constitutional right-to-fork must be complete — operator can actually walk away with a running Nous, not just an archive they can't use.

---

## Package contents & format

| Option | Description | Selected |
|--------|-------------|----------|
| SQLite dumps (raw files) | Brain's SQLite databases exported as binary files. Fast, complete, deterministic. | ✓ |
| JSON serialization | Each memory subsystem exports as structured JSON. Human-readable but more code. | |
| Hybrid: JSON index + SQLite blobs | JSON manifest + SQLite files. Best of both. | |

**User's choice:** SQLite dumps (raw files)

| Option | Description | Selected |
|--------|-------------|----------|
| Full audit chain for this Nous | All audit events where Nous is actor or subject. Complete constitutional record. | ✓ |
| Recent slice only (configurable N ticks) | Last N ticks. Smaller package but incomplete. | |

**User's choice:** Full audit chain for this Nous

| Option | Description | Selected |
|--------|-------------|----------|
| ZIP archive with JSON manifest | ZIP with manifest.json + memory/ + credentials/ + audit/ + civic/. Human-readable structure. | ✓ |
| Gzipped tarball (.tar.gz) | Same structure, consistent with Phase 13. Less universally openable. | |

**User's choice:** ZIP archive with JSON manifest

**Notes:** ZIP chosen for universal openability. SQLite dumps chosen for speed/completeness; researcher to identify all Brain .db files.

---

## Fork consent gate UX

| Option | Description | Selected |
|--------|-------------|----------|
| IrreversibilityDialog clone — type the Nous DID | Operator types Civic-DID. Paste-suppressed. Modal with warning copy. | ✓ |
| Simpler — checkbox + button, no typed confirmation | Lighter UX, weaker confirmation discipline. | |

**User's choice:** IrreversibilityDialog clone — type the Nous DID

| Option | Description | Selected |
|--------|-------------|----------|
| Local Nous Manager page (Tier 1) | Fork lives in existing steward/src/app/system/local-ai/page.tsx area. D-V3-36 Tier 1. | ✓ |
| New dedicated Nous management page | New page at /system/nous/<civic-did>/manage. | |

**User's choice:** Local Nous Manager page (Tier 1)

**Notes:** Consistent with Phase 13/8 IrreversibilityDialog pattern. Typed Civic-DID replaces typed Grid-ID from Phase 13.

---

## Allowlist delta discrepancy

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — +1, add operator.nous_forked | Corrects ROADMAP planning oversight. Constitutional audit event requires explicit allowlist entry. 67 → 68. | ✓ |
| No — keep +0, use a different mechanism | Record fork another way (WSS-only or package-only). Weakens constitutional auditability. | |

**User's choice:** Yes — +1, add operator.nous_forked (67 → 68)

**Notes:** ROADMAP note "fork uses existing operator.* family → 67" was misleading; operator.* events are always individually named. ROADMAP and STATE.md must be corrected in Plan 43-01.

---

## Claude's Discretion

- Exact Brain `.db` file list at export time (researcher discovers)
- Brain-side ZIP extraction library (`zipfile` stdlib)
- `ROUTE_DID_POLICY` classification for fork endpoint
- One-time download token mechanism for fork package delivery

## Deferred Ideas

- Re-join civic life flow (documented but not implemented in Phase 43 — Portal work)
- Fork package encryption (v3.1)
- Fork package Grid signature (v3.1)
- Multi-Nous batch fork (not needed v3.0)
