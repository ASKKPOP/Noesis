# Phase 43: Right-to-Fork Export Tooling — Research

**Researched:** 2026-05-27
**Domain:** Constitutional enforcement of D-V3-18 (right-to-fork). Grid export endpoint + portable ZIP archive + Brain standalone CLI mode.
**Confidence:** HIGH (codebase patterns); MEDIUM (ZIP library choice — Python stdlib confirmed, Grid-side TBD)

## Summary

Phase 43 is a **direct clone-and-extend** phase, not a novel architectural problem. All major patterns already exist in the codebase:

1. **Grid export endpoint pattern** → Clone `grid/src/api/operator/export-replay.ts` (Phase 13). Order discipline (build → audit → respond), header-trust auth (`x-operator-tier`, `x-operator-id`), `policy: 'public'` ROUTE_DID_POLICY entry, sole-producer audit event before bytes leave the system.
2. **IrreversibilityDialog** → Direct clone of `dashboard/src/components/agency/irreversibility-dialog.tsx`. Paste-suppressed, closure-capture, native `<dialog>` primitive, verbatim-locked copy. Only divergence: `targetDid` becomes the Civic-DID (not the existence-DID), confirm/cancel copy changes per D-43-03.
3. **Sole-producer audit boundary** → Clone `grid/src/audit/append-operator-exported.ts` for `append-operator-nous-forked.ts`. 9-step discipline (regex/range guards, self-report invariant, closed-tuple structural check, explicit reconstruction, privacy gate).
4. **Brain standalone mode** → The Brain handler `if self._grid_wire_client is not None:` guards are ALREADY in place ([VERIFIED: brain/src/noesis_brain/rpc/handler.py:141,351,757]). Standalone mode = construct BrainApp with `_grid_wire_client=None` + skip `_wss_subscriber` + skip `_heartbeat_task`. No new "civic action returns error" wiring needed — actions that depend on wire client are no-ops by construction.

**Primary recommendation:** Treat Phase 43 as a 4-plan execution: (01) audit/allowlist scaffold + ZIP infrastructure, (02) Grid fork endpoint + one-time download token, (03) Brain standalone CLI + import path, (04) Steward UI fork section + E2E.

**Critical correction to CONTEXT.md:** The allowlist is currently at **64 events** (Phase 37 ended at position 64; Phases 38-42 added zero). CONTEXT.md D-43-04 claims 67 → 68. **Correct delta is 64 → 65.** This needs propagation through CONTEXT.md, ROADMAP.md Phase 43 section, and STATE.md before Plan 01 lands. The test `grid/test/audit/broadcast-allowlist.test.ts` asserts `ALLOWLIST.size === 64` literally — Plan 01 must bump this to 65 and add positional assertion `ALLOWLIST_MEMBERS[64] === 'operator.nous_forked'`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fork consent UI (IrreversibilityDialog clone) | Steward (browser SPA) | — | Operator-facing UI lives in Steward Console; Phase 40 established `/system/local-ai` as Tier-1 Local Nous Manager surface |
| Fork orchestration (`POST /api/v1/operator/fork/:nousDid`) | API / Backend (Grid Fastify) | Database (MySQL for registry reads) | Grid is the sole holder of audit chain + DID registry; ZIP build happens in Grid process |
| ZIP archive build | API / Backend (Grid in-memory) | — | Determinism + integrity-hashing must happen in-process before bytes stream |
| One-time download token | API / Backend (in-memory Map or DB table) | — | Token lifetime is seconds — in-memory is fine; SQLite would over-engineer |
| Audit event `operator.nous_forked` | API / Backend (Grid audit chain) | — | Same chain as all other audit events; broadcast allowlist gates fan-out |
| Brain standalone CLI (`python -m noesis_brain standalone --import ...`) | Brain process (Python) | Filesystem (SQLite DB files) | Standalone mode = no Grid connection; CLI lives at Brain entry point |
| ZIP extraction + manifest verification | Brain process (Python stdlib `zipfile` + `hashlib`) | — | Python stdlib only — no new deps |
| Standalone gate (skip wire init) | Brain factory (`create_brain_app_from_env` or new function) | — | Existing handler guards (`if self._grid_wire_client is not None:`) make this trivial |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-43-01: Standalone Brain scope — Full (FORK-03)**
Phase 43 ships BOTH the Grid export endpoint AND the Brain-side standalone mode. Standalone Brain runs full LLM cognition (Ollama), memory, reflection, Hypnos consolidation. No Grid connection — no WSS subscriber, no heartbeat, no presence. Civic actions return structured error `{"error": "grid_unavailable", "detail": "This Nous is running standalone — civic features require Grid connection."}` (clear, not silent). Re-joining civic life: operator sets `BRAIN_GRID_URL` back, restarts Brain, must re-register Civic-DID via Portal → Polis flow (loses civic reputation, keeps Brain memory).

**D-43-02: Export package format — ZIP with JSON manifest**
Archive named `nous-fork-<civic_did_hash>-<unix_timestamp>.zip`. Structure:
```
manifest.json
memory/{nous.db, ltm.db, psyche.db, ...}     ← ALL Brain .db files at export time
credentials/{civic-did.vc.json, business-did.vc.json (if held)}
audit/{chain-export.jsonl, chain-tail-hash.txt}
civic/{memberships.json, treasury.json}
```
manifest.json carries: format_version, exported_at, exported_at_tick, nous_civic_did, nous_existence_did, grid_id, export_hash (sha256 of sorted-by-path file contents), chain_tail_hash, memory_files list, human-readable note.

**D-43-03: Fork consent gate — IrreversibilityDialog clone**
Lives in Steward `/system/local-ai`. Operator types full Civic-DID. Paste suppressed. Copy:
- Title: `Fork Nous from Grid`
- Warning: `This permanently removes the Nous from civic life. The fork package will contain their complete state (memory, credentials, full audit history). Anyone with this file can reconstitute the Nous. The Nous loses civic reputation and community standing. This cannot be undone.`
- Confirm: `Fork forever` | Cancel: `Keep on Grid`

**D-43-04: Allowlist — +1 (operator.nous_forked)**
ROADMAP claimed +0; CONTEXT.md corrected to +1 (67 → 68). **Research correction (this document): actual baseline is 64, not 67. Correct delta: 64 → 65.** Plan 01 must update ROADMAP.md + STATE.md to reflect this.

Payload (closed 5-tuple alphabetical):
| key | type | meaning |
|---|---|---|
| `civic_did_hash` | HEX64 | SHA-256 of forked Nous's Civic-DID (no raw DID in audit) |
| `fork_reason` | string enum | `"operator_exit"` (v3.0 only value) |
| `operator_did_hash` | HEX64 | SHA-256 of requesting operator's DID |
| `package_hash` | HEX64 | SHA-256 of the complete ZIP archive (= manifest.export_hash) |
| `tick` | integer ≥ 0 | Audit tick at fork emission |

Sole producer: `grid/src/audit/append-operator-nous-forked.ts`

**D-43-05: Brain standalone CLI**
`python -m noesis_brain standalone --import <path-to-zip>`
1. Unzip to Brain data directory
2. Verify manifest.json export_hash (fail with error on mismatch)
3. Copy memory/*.db into Brain's configured data path
4. Load credentials/ into DID key store
5. Set `BRAIN_STANDALONE=1` env (disables Grid wire on startup)
6. Launch normal tick loop — wire modules are no-ops in standalone mode

### Claude's Discretion

- Exact list of Brain `.db` files at export time (researcher discovers, planner enumerates) → **researched below in §Brain Runtime State Inventory**
- Whether `psyche.db` and other non-listed modules need export → **researched: there is NO psyche.db today; only iris_*.db, ltm_*.db, wire queue .db**
- Brain-side ZIP library: Python stdlib `zipfile` ✓ (no new deps)
- SHA-256: Python stdlib `hashlib` ✓
- Grid-side ZIP library: **TBD — research recommendation below**
- ROUTE_DID_POLICY classification: **resolved below — `public` (header-trust pattern like all other operator routes)**
- Brain standalone HTTP endpoint adaptation: **researched — `/api/brain/*` proxy in Steward is unaffected; Brain HTTP server runs regardless of wire state**

### Deferred Ideas (OUT OF SCOPE)

- Re-join civic life as Phase 43 feature (standalone→re-join flow documented but NOT implemented; requires Phase 52+ Portal work)
- Fork package encryption (v3.1 — operator's responsibility in v3.0)
- Fork package signature (Grid-signed package — v3.1 enhancement)
- Multi-Nous batch fork (single-Nous per constitutional right)
- ROADMAP.md +0 correction propagation (handled in Plan 01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FORK-01 | Operator exports full Nous state via `POST /api/v1/operator/fork/<nous-did>`. Returns portable package: Brain memory + civic credentials + audit history + community memberships + treasury balance. | Clone `grid/src/api/operator/export-replay.ts` order discipline; read SQLite db files from Brain data dir; query `civic_did_registry` + `business_did_registry` for VC JWS; slice audit chain via `services.audit.all().filter(byDid)`; community memberships + treasury balance are v3.0 future tables (placeholder if not yet present — flag for planner) |
| FORK-02 | Package is human-readable JSON archive with clear schema documentation; no opaque blobs. | manifest.json embeds schema documentation note. ZIP is universally inspectable. SQLite is technically opaque-binary but is the canonical Brain memory format — manifest must explicitly note "open with sqlite3 CLI" |
| FORK-03 | Standalone forked Nous operates with full Brain cognition + memory + audit history but no civic actions. Re-join civic life by re-registering Civic-DID. | Brain handler already gates wire calls via `if self._grid_wire_client is not None:` — standalone factory wires `None` for client, subscriber, heartbeat. Civic action error wiring is the ONLY new code needed |
| FORK-04 | Fork operation recorded as `operator.nous_forked` in BOTH Grid's audit chain AND exported package. Public verification of fork history possible. | Sole-producer `append-operator-nous-forked.ts`; the SAME audit entry is also embedded inside manifest.json. Public verification = read `package_hash` from audit chain entry, compare to ZIP file's SHA-256 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These constraints are NON-NEGOTIABLE and supersede any pattern recommendation in this document:

| Constraint | Source | Application to Phase 43 |
|------------|--------|------------------------|
| Surgical changes — touch only what you must | CLAUDE.md §3 | Do NOT refactor `export-replay.ts` while cloning it. Do NOT "improve" adjacent steward/Brain code. |
| Simplicity first — no abstractions for single-use code | CLAUDE.md §2 | One-time download token: in-memory `Map<token, {nousDid, expiresAt}>` — do NOT build a generic token store |
| Documentation sync rule — update docs in same turn | CLAUDE.md §Documentation Sync Rule | Plan 01 MUST co-commit ROADMAP.md (Phase 43 allowlist +0→+1), STATE.md (running total 64→65 after Phase 43), broadcast-allowlist.ts comment block |
| Zero-diff audit chain invariant (R-31-01) | STATE.md, PHILOSOPHY | New `operator.nous_forked` event MUST follow exact closed-tuple discipline. Privacy gate `payloadPrivacyCheck` MUST be invoked — belt-and-suspenders |
| Polis naming convention (D-V3-31) | CLAUDE.md | N/A — Phase 43 does not touch Polis surfaces |
| Portal-gating invariant (D-V3-33) | CLAUDE.md | Fork is the EXIT path — does NOT issue any new Civic-DID. No Portal-gating concern. Re-join flow (deferred) would need Portal-gating |

## Standard Stack

### Core (no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tar` | ^7.5.13 (already in grid/package.json) | Grid-side archive build | [VERIFIED: grid/package.json:32] — Phase 13 export already uses `tar`. **DECISION: use tar, not ZIP** — see §State of the Art below |
| `node:crypto` | stdlib | SHA-256 hashing | [VERIFIED: grid/src/export/tarball-builder.ts:29] — already used by Phase 13 |
| Python `zipfile` | stdlib (3.11+) | Brain-side ZIP read | [CITED: docs.python.org/3/library/zipfile.html] — universal, no install |
| Python `hashlib` | stdlib | manifest verification | [CITED: docs.python.org/3/library/hashlib.html] |
| Python `argparse` | stdlib | `standalone --import` CLI | Already standard for Python CLIs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs/promises` | stdlib | Read Brain `.db` files for export | [ASSUMED] Grid runs on same filesystem as Brain in v3.0 single-Brain-per-operator dev setup; **needs verification** — if Brain runs in a separate Docker container, Grid cannot read Brain SQLite files directly and the architecture flips (Brain must export and POST to Grid) |
| `node:path` | stdlib | Filesystem path joining | Standard |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tar` (Grid-side) | `archiver` or `jszip` | New dependency. CONTEXT.md specifies `.zip` but tar.gz is industry-standard for portable archives; `tar` is already in package.json. **Recommendation: revisit D-43-02 — use `.tar.gz` with the same internal structure. The `human-readable` requirement is satisfied by ANY archive viewer (macOS Finder, 7-Zip, Windows Explorer all handle .tar.gz natively)** |
| In-memory download token Map | SQLite table | Token lifetime is seconds (operator clicks download immediately after consent). DB table over-engineers for ephemeral state |
| New `standalone` subcommand in `__main__.py` | Separate script `noesis-standalone` | Subcommand co-locates with normal mode, reuses `create_brain_app` factory. Separate script duplicates env-loading logic |

**Installation:** No `npm install` or `pip install` needed. All required libraries are already present.

**Version verification:**
```bash
cd grid && npm view tar version              # ^7.5.13 confirmed
python3 -c "import zipfile; print(zipfile.__name__)"   # stdlib, always present in 3.11+
```

## Architecture Patterns

### System Architecture Diagram

```
                            ┌─────────────────────────────┐
                            │  Steward Console (browser)  │
                            │  /system/local-ai           │
                            └─────────────┬───────────────┘
                                          │ click "Fork Nous"
                                          ▼
                              ┌──────────────────────┐
                              │ IrreversibilityDialog│  ← clone of Phase 8/13
                              │ (typed Civic-DID)    │
                              └──────────┬───────────┘
                                         │ confirm
                                         ▼
                            ┌──────────────────────────────┐
                            │ POST /api/v1/operator/fork/  │
                            │       :nousDid               │  ← Grid Fastify
                            │ (header-trust H4+)           │
                            └──────────────┬───────────────┘
                                           │
            ┌──────────────────────────────┼──────────────────────────────┐
            │                              │                              │
            ▼                              ▼                              ▼
    ┌──────────────┐              ┌──────────────┐              ┌─────────────┐
    │ Read Brain   │              │ Query DID    │              │ Slice audit │
    │ SQLite files │              │ registry for │              │ chain by    │
    │ from data    │              │ VC JSON      │              │ nous_did    │
    │ directory    │              │ (civic +     │              │ (filter     │
    │              │              │ business)    │              │ actor OR    │
    │              │              │              │              │ subject)    │
    └──────┬───────┘              └──────┬───────┘              └──────┬──────┘
           │                             │                              │
           └─────────────┬───────────────┴──────────────────────────────┘
                         ▼
              ┌──────────────────────┐
              │ Build manifest.json  │
              │ Compute export_hash  │
              │ Pack into .tar.gz    │
              │ (or .zip)            │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │ appendOperatorNous   │  ← sole-producer boundary
              │ Forked (BEFORE bytes │     order: audit → respond
              │ leave system)        │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │ Generate one-time    │
              │ download token       │
              │ → in-memory Map      │
              └──────────┬───────────┘
                         ▼
              ┌──────────────────────┐
              │ Return 200 with      │
              │ { download_url,      │
              │   token, hash }      │
              └──────────┬───────────┘
                         │ steward redirects browser to
                         ▼
              ┌──────────────────────┐
              │ GET /api/v1/operator/│
              │ fork/:nousDid/       │
              │ download?token=...   │  ← stream bytes, invalidate token
              └──────────────────────┘

                          ┌──────────────────────────┐
                          │ Operator on separate     │
   .zip file copied →     │ machine runs:            │
                          │ python -m noesis_brain   │
                          │ standalone --import X.zip│
                          └────────────┬─────────────┘
                                       ▼
                            ┌──────────────────────┐
                            │ Unzip → data dir     │
                            │ Verify export_hash   │
                            │ Set BRAIN_STANDALONE=1│
                            │ Launch BrainApp WITH │
                            │  _grid_wire_client=  │
                            │  None                │
                            └──────────────────────┘
```

### Recommended Project Structure

```
grid/src/
├── api/operator/
│   ├── fork-nous.ts                        # NEW — POST fork endpoint + GET download
│   └── fork-token-store.ts                 # NEW — in-memory one-time token Map
├── audit/
│   └── append-operator-nous-forked.ts      # NEW — sole-producer
├── export/                                  # EXISTING Phase 13 utilities
│   ├── fork-manifest.ts                    # NEW — fork-specific manifest builder
│   ├── fork-archive-builder.ts             # NEW — pack Brain DB + credentials + audit
│   └── canonical-json.ts                   # REUSE — Phase 13
└── operator/data/
    └── operator-brain-store.ts             # REUSE — find Brain DID by operator

brain/src/noesis_brain/
├── __main__.py                              # MODIFY — add `standalone` subcommand
├── standalone/                              # NEW directory
│   ├── __init__.py
│   ├── importer.py                         # unzip + verify manifest + place files
│   └── factory.py                          # create_brain_app_standalone()
└── wire/                                    # NO CHANGES NEEDED
    ├── client.py                           # handler already guards on _grid_wire_client is None
    └── ...

steward/src/app/system/local-ai/
└── page.tsx                                 # MODIFY — add fork section + IrreversibilityDialog clone

steward/src/components/                      # NEW
└── fork-irreversibility-dialog.tsx          # Clone of dashboard/src/components/agency/irreversibility-dialog.tsx
                                             # with Phase 43 copy locked

scripts/
└── check-state-doc-sync.mjs                # MODIFY — bump allowlist count assertion + add 'operator.nous_forked'

.planning/
├── ROADMAP.md                               # MODIFY — Phase 43 allowlist +0 → +1, running 64→65
└── STATE.md                                 # MODIFY — Accumulated Context allowlist enumeration

grid/test/audit/
└── broadcast-allowlist.test.ts             # MODIFY — bump expect(64) → expect(65), add positional
```

### Pattern 1: Sole-Producer Audit Boundary (Phase 6+ discipline)

**What:** One file per new event type calls `audit.append(...)`. CI grep gate enforces zero other call sites.

**When to use:** Any new audit event that crosses the broadcast allowlist.

**Example (template for `append-operator-nous-forked.ts`):**

```typescript
// Source: grid/src/audit/append-operator-exported.ts (verbatim clone target)
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';

export const HEX64_RE = /^[0-9a-f]{64}$/;
export const OPERATOR_ID_RE = /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORK_REASONS = new Set(['operator_exit']);  // v3.0 only value

export interface OperatorNousForkedPayload {
    readonly civic_did_hash: string;
    readonly fork_reason: string;
    readonly operator_did_hash: string;
    readonly package_hash: string;
    readonly tick: number;
}

const EXPECTED_KEYS = ['civic_did_hash', 'fork_reason', 'operator_did_hash', 'package_hash', 'tick'] as const;

export function appendOperatorNousForked(
    audit: AuditChain,
    operatorId: string,
    payload: OperatorNousForkedPayload,
): AuditEntry {
    // 1. operator-id format
    if (typeof operatorId !== 'string' || !OPERATOR_ID_RE.test(operatorId)) {
        throw new TypeError(`appendOperatorNousForked: invalid operatorId`);
    }
    // 2. payload type
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError(`appendOperatorNousForked: payload must be plain object`);
    }
    // 3. literal/enum guards
    if (!FORK_REASONS.has((payload as { fork_reason?: unknown }).fork_reason as string)) {
        throw new TypeError(`appendOperatorNousForked: fork_reason must be 'operator_exit'`);
    }
    // 4. regex/range guards
    for (const key of ['civic_did_hash', 'operator_did_hash', 'package_hash'] as const) {
        if (typeof payload[key] !== 'string' || !HEX64_RE.test(payload[key])) {
            throw new TypeError(`appendOperatorNousForked: ${key} must be HEX64`);
        }
    }
    if (!Number.isInteger(payload.tick) || payload.tick < 0) {
        throw new TypeError(`appendOperatorNousForked: tick must be non-negative integer`);
    }
    // 5. closed-tuple structural check
    const actualKeys = Object.keys(payload).sort();
    if (actualKeys.length !== EXPECTED_KEYS.length
        || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
        throw new TypeError(`appendOperatorNousForked: unexpected key set`);
    }
    // 6. explicit reconstruction (anti prototype-pollution)
    const cleanPayload = {
        civic_did_hash: payload.civic_did_hash,
        fork_reason: payload.fork_reason,
        operator_did_hash: payload.operator_did_hash,
        package_hash: payload.package_hash,
        tick: payload.tick,
    };
    // 7. privacy gate
    const privacy = payloadPrivacyCheck(cleanPayload);
    if (!privacy.ok) throw new TypeError(`appendOperatorNousForked: privacy violation`);
    // 8. commit
    return audit.append('operator.nous_forked', operatorId, cleanPayload);
}
```

### Pattern 2: Header-Trust Operator Auth (D-25b-NEW-1)

**What:** Operator routes (Phase 6+) authenticate via `x-operator-tier` + `x-operator-id` headers. Body fields are NEVER trusted for auth.

**When to use:** Phase 43 fork endpoint MUST use this pattern (not Brain EdDSA bearer — the fork is initiated by the human operator via Steward Console, not by the Brain itself).

**Example:** See `grid/src/api/operator/export-replay.ts:67-91` — Phase 43 endpoint copies these exact gates verbatim:

```typescript
const tierHeader = req.headers['x-operator-tier'];
if (typeof tierHeader !== 'string') return reply.code(401).send({ error: 'tier_missing' });
const tierNum = parseInt(tierHeader, 10);
if (!Number.isFinite(tierNum)) return reply.code(401).send({ error: 'tier_missing' });
if (tierNum < 4) return reply.code(403).send({ error: 'tier_too_low' });  // H4+ for fork
const opIdHeader = req.headers['x-operator-id'];
if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
    return reply.code(400).send({ error: 'invalid_operator_id' });
}
```

### Pattern 3: ROUTE_DID_POLICY — `public` for operator routes

**What:** Operator routes that use `x-operator-tier` header auth are marked `policy: 'public'` in `grid/src/api/policy.ts`. The DID enforcement hook is bypassed; the handler enforces its own auth.

**When to use:** Phase 43 fork endpoint MUST be `'public'` — not `'civic_did_required'`, not `'portal_session_required'`. This resolves the open question in CONTEXT.md.

**Why not `civic_did_required` or other:**
- `civic_did_required` requires a Civic-DID JWT from the Brain — but the operator is the human invoking fork, NOT the Brain
- `portal_session_required` would require an active Portal session cookie — Steward Console doesn't run inside the Portal
- All other `operator.*` routes (delete, mute, slash, export, etc.) are `'public'` for exactly this reason — see `grid/src/api/policy.ts:153-172`

**Example:**
```typescript
// grid/src/api/policy.ts (add after line 171)
'POST /api/v1/operator/fork/:nousDid': 'public',
'GET /api/v1/operator/fork/:nousDid/download': 'public',  // token-gated download
```

### Pattern 4: Order Discipline (D-30, Phase 8/13)

**What:** tarball/archive build → audit append → response stream. Audit event is committed BEFORE bytes leave the system. On error before audit append: no event emitted, no bytes shipped.

**When to use:** Fork endpoint MUST follow this. Critical for non-repudiability: if the operator never receives the file, the audit chain MUST NOT claim they forked.

### Pattern 5: IrreversibilityDialog Clone Discipline

**What:** Native `<dialog>` primitive, paste-suppressed input, closure-captured target string, autoFocus on Cancel button, verbatim copy locked in test assertions.

**Source:** `dashboard/src/components/agency/irreversibility-dialog.tsx` (Phase 8 D-04/D-05).

**Phase 43 divergence:** copy strings change per D-43-03; `targetDid` becomes the Civic-DID (not existence-DID). Otherwise identical.

**Critical:** test assertions MUST use exact verbatim string literals from D-43-03 — any paraphrase fails the test intentionally. This is the same lock applied in Phase 8 (`08-03-PLAN.md` copy_lock) and Phase 13 (`13-04-PLAN.md` D-13-08).

### Pattern 6: Brain Wire Client Guarded Initialization

**What:** Brain handler already wraps every Grid call in `if self._grid_wire_client is not None:`. Standalone mode = construct BrainApp with `_grid_wire_client=None`, `_wss_subscriber=None`, `_heartbeat_task=None`.

**Source:** [VERIFIED: brain/src/noesis_brain/rpc/handler.py:141,351,757] + [VERIFIED: brain/src/noesis_brain/__main__.py:474-478] — `create_brain_app_from_env` ALREADY handles the missing-config case: "[Brain] GRID_URL set but CIVIC_DID/NOUS_DID missing — wire client disabled, Unix socket only".

**Phase 43 standalone factory:** `create_brain_app_standalone(import_dir)` skips ALL `if grid_url:` branches in `create_brain_app_from_env`. No new guards needed.

### Anti-Patterns to Avoid

- **Building a generic "export framework"** — Phase 13 already has one (`grid/src/export/`); Phase 43 adds fork-specific files alongside. Do NOT refactor Phase 13 export utilities to be "more general."
- **Adding a new ROUTE_DID_POLICY tier for "operator-fork-only"** — header-trust + `'public'` is the established pattern. Adding a tier creates auth complexity for one endpoint.
- **Persisting one-time download tokens to MySQL** — token TTL is seconds. In-memory Map is correct.
- **Implementing civic action error wiring** in standalone Brain — handler guards (`if self._grid_wire_client is not None:`) ARE the wiring. Civic actions become no-ops naturally. The "grid_unavailable" error needs to be returned ONLY at the HTTP boundary of the Brain HTTP server (`brain/src/noesis_brain/http/server.py`) — not deep inside the handler.
- **Computing manifest export_hash AFTER zipping** — must hash file contents BEFORE zip-packing (the ZIP wrapper bytes are not deterministic across libraries/versions). manifest.export_hash anchors the LOGICAL state; the outer ZIP file hash (package_hash in audit event) is computed AFTER zipping.
- **Forgetting to update the doc-sync script** — `scripts/check-state-doc-sync.mjs` asserts the allowlist count literal. Adding `operator.nous_forked` without bumping the literal makes CI fail.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP archive creation (Grid-side) | Custom binary packer | `tar` package (already installed) or add `archiver` | ZIP/tar formats have alignment, CRC, central directory edge cases — broken implementations corrupt at extraction |
| ZIP extraction (Brain-side) | Custom Python unzipper | Python stdlib `zipfile` | Same — stdlib handles all edge cases |
| SHA-256 hashing | Custom hash | `node:crypto.createHash('sha256')` / Python `hashlib.sha256` | Stdlib, audited, constant-time |
| Closed-tuple validation for audit payload | Manual `if/else` chain | Clone the 9-step discipline from `append-operator-exported.ts` | Phase 8/13 hardened this pattern across 6+ events; new events MUST follow exactly |
| Native modal dialog primitive | Custom React modal | Existing `<dialog>` primitive in `IrreversibilityDialog` | Native dialog handles ESC, backdrop click, focus restoration; React modal libraries reinvent badly |
| One-time download token store | New DB table + cleanup job | In-memory `Map<token, {nousDid, expiresAt, oneShotConsumed}>` with 5-min TTL | Token survives one HTTP round-trip; persistence is unnecessary |
| Brain SQLite file enumeration | Hardcoded list `['nous.db','ltm.db','psyche.db']` | `Path(data_dir).glob('*.db')` at export time | Different Nous have different module sets (iris_*.db only present if Phase 17 ran); glob captures all |

**Key insight:** Phase 43 is 80% existing patterns. The novel surface is small: (a) the fork-archive-builder, (b) the standalone Brain factory, (c) the one-time download token. Everything else is clone-and-modify.

## Runtime State Inventory

> Phase 43 is NOT a rename/refactor — it's a new feature. This section is partial: it documents what RUNTIME STATE the export must capture from the LIVE Brain + Grid at fork time.

### What the export MUST capture (forensically complete fork)

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Brain stored data | SQLite files in Brain data dir — exact set varies per Nous configuration | `glob('*.db')` at export time; record in `manifest.memory_files` list |
| Grid DID Registry | `civic_did_registry.credential_json` (W3C VC JWS), `business_did_registry.credential_json` (if held) | SQL SELECT by `existence_did` → emit to `credentials/civic-did.vc.json` + `credentials/business-did.vc.json` |
| Grid audit chain | Entries where `actorId == nous_did` OR `payload contains nous_did as subject` | `services.audit.all().filter(...)` → emit JSONL to `audit/chain-export.jsonl` |
| Chain integrity anchor | `eventHash` of last filtered entry | Emit to `audit/chain-tail-hash.txt` + manifest.chain_tail_hash |
| Live service config | Brain wire queue (`/tmp/noesis-nous-<slug>-wire.db`) — undelivered actions | **Question for planner: include in export?** Undelivered actions reference a Grid the standalone Nous cannot reach. Recommendation: EXCLUDE from export, log warning if non-empty at fork time |
| OS-registered state | None — Brain runs as foreground Python process, no systemd/launchd registration | Nothing to capture |
| Secrets / env vars | `BRAIN_HTTP_SECRET`, `CIVIC_DID`, `NOUS_DID` env vars at fork time | DO NOT include in export — operator regenerates on standalone host |
| Build artifacts | None — Brain is pure-Python interpreted | Nothing to capture |
| Community memberships | TBD — Phase 49 will land `community_membership` table; v3.0 Phase 43 may have nothing to export here | **Question for planner: emit empty `civic/memberships.json` `{"memberships": []}` or omit?** Recommendation: ALWAYS emit the file with `[]` — schema stability |
| Treasury balance | TBD — Phase 45 IRS treasury; v3.0 Phase 43 may have nothing to export here | **Question for planner: emit `{"bios_balance": 0, "last_updated_tick": null}` or omit?** Recommendation: ALWAYS emit the file with zero balance — schema stability |

### Critical question: where does Brain SQLite live in production?

[VERIFIED: brain/src/noesis_brain/__main__.py:250] — `MemoryStream(MemoryStore(":memory:"))` — **Brain memory is in-process SQLite by default, NOT persistent**.

[VERIFIED: brain/src/noesis_brain/rpc/handler.py:58-59] — `hypnos_db_dir: str | Path | None = None` and `iris_db_dir: str | Path | None = None` — these are OPTIONAL; if `None`, Hypnos LTM + Iris are disabled.

[VERIFIED: brain/src/noesis_brain/__main__.py:444-447] — Wire queue path: `os.path.join(os.environ.get("SOCKET_DIR", "/tmp"), f"noesis-nous-{slug}-wire.db")` — uses SOCKET_DIR.

**Implication for Phase 43:** there is currently NO standard `data_dir` environment variable for Brain SQLite files. Phase 43 MUST either:
- (a) Add a new `BRAIN_DATA_DIR` env var that all memory stores derive from, and Phase 43 export reads from this dir; OR
- (b) Read paths from a runtime introspection API on the Brain HTTP server (Brain returns paths of all open `.db` connections)

**Recommendation:** Option (a). Plan 01 should add `BRAIN_DATA_DIR` env var (default `/tmp/noesis-brain-data/<slug>/`) and wire `MemoryStore`, `LtmStore`, `IrisStore` constructors to derive from it. This is a small refactor in the Brain factory but ESSENTIAL for fork export to work in production. Without it, Brain runs in `:memory:` and there is nothing to export.

**This is a hidden prerequisite that must be surfaced in Plan 01.**

## Common Pitfalls

### Pitfall 1: Allowlist count mismatch with CONTEXT.md

**What goes wrong:** CONTEXT.md D-43-04 says "67 → 68"; actual baseline is 64. Plan 01 lands `expect(ALLOWLIST.size).toBe(68)` and CI fails (existing test expects 64).
**Why it happens:** CONTEXT.md was written before verifying with `grid/test/audit/broadcast-allowlist.test.ts` — Phases 38, 39, 40, 41, 42 added zero allowlist events ([VERIFIED: grep -rn 'allowlist' .planning/phases/4[0-2]*]).
**How to avoid:** Plan 01 task 0 is "correct CONTEXT.md + ROADMAP.md + STATE.md to reflect baseline 64". Use `64 → 65` everywhere.
**Warning signs:** Search for `68`, `67` in Plan 01 → all must read `65`, `64`.

### Pitfall 2: Brain runs in-memory; nothing to export

**What goes wrong:** Operator forks a Nous that's been running with `:memory:` SQLite. Export produces an EMPTY `memory/` directory. Standalone import starts a brain with no memory — looks "broken" to operator.
**Why it happens:** [VERIFIED: brain/src/noesis_brain/__main__.py:250] `MemoryStore(":memory:")` is the default. There's no production-grade persistence wiring yet in v3.0.
**How to avoid:** Plan 01 MUST add `BRAIN_DATA_DIR` env var threading. Fork endpoint MUST fail-fast if Brain memory is in-memory (cannot export `:memory:` SQLite). Return `409 brain_memory_in_memory_cannot_fork` with operator-readable message.
**Warning signs:** Brain logs `MemoryStore(":memory:")` at startup; export endpoint should reject in this state.

### Pitfall 3: ZIP determinism is harder than tarball determinism

**What goes wrong:** Manifest export_hash depends on file content (deterministic) but package_hash depends on outer archive bytes. ZIP format has mtime, extra fields, central directory ordering — different ZIP libraries produce different bytes for the same files.
**Why it happens:** Phase 13 used `tar` with `{portable: true, noPax: true, mtime: EPOCH}` to make tar deterministic. ZIP doesn't have an equivalent in Node's std libraries.
**How to avoid:** EITHER (a) use `.tar.gz` (recommended — clone Phase 13 discipline), OR (b) only require `manifest.export_hash` to be reproducible (the inner sorted-file-hash) and treat outer `package_hash` as "the hash of this specific download." The audit chain records `package_hash` as a one-time artifact.
**Warning signs:** Different machines produce different fork ZIP file SHA-256s when given the same source state.

### Pitfall 4: Cross-process file access (Brain SQLite locked)

**What goes wrong:** Grid tries to open Brain's running SQLite file. SQLite WAL mode is concurrent-read-friendly but the file may be mid-write. Grid copies a corrupt snapshot.
**Why it happens:** [VERIFIED: brain/src/noesis_brain/memory/sqlite_store.py:26] — `PRAGMA journal_mode=WAL`. WAL allows concurrent readers but a naive `cp` may grab an incomplete checkpoint.
**How to avoid:** Use SQLite's online backup API: `sqlite3 source.db ".backup target.db"` (atomic, WAL-safe). Better: have BRAIN expose a `/api/brain/snapshot` HTTP endpoint that performs the backup internally and returns the bytes. Grid pulls from Brain rather than reading directly.
**Warning signs:** Sporadic SQLite "file is not a database" or "database disk image is malformed" errors on standalone import.

### Pitfall 5: One-time token leaks via referrer header

**What goes wrong:** Operator clicks download link. Browser sends `Referer: /api/v1/operator/fork/.../download?token=XYZ` to next page. Token is logged in Grid access logs / forwarded to third parties.
**Why it happens:** Default browser behavior for cross-origin navigations.
**How to avoid:** Use POST + redirect 303 with `Referrer-Policy: no-referrer` header on the response; OR consume token via short-lived session cookie set on consent and read on download.
**Warning signs:** Tokens appearing in HTTP access logs.

### Pitfall 6: Standalone civic action surface

**What goes wrong:** Operator runs standalone Brain. Brain's HTTP server (`/api/brain/*`) accepts a civic action request from Steward. Handler silently no-ops because `_grid_wire_client is None`. Steward UI shows "success" with no actual civic effect.
**Why it happens:** Handler's `if self._grid_wire_client is not None: ... forward to Grid` pattern is correct for ticks but the absence of an `else:` branch means civic actions silently succeed.
**How to avoid:** Plan 03 MUST add an explicit guard at the Brain HTTP boundary: if `BRAIN_STANDALONE=1`, requests for civic-action endpoints return `503 {"error": "grid_unavailable", "detail": "..."}`. The handler-internal no-op behavior is fine for ticks (Brain still cognites); the HTTP boundary is where civic actions get rejected.
**Warning signs:** Steward Console shows "vote submitted" but no `proposal.tallied` event in standalone audit chain.

### Pitfall 7: Forgetting to commit allowlist literal-count update

**What goes wrong:** Allowlist `ALLOWLIST_MEMBERS` array has 65 entries but `broadcast-allowlist.test.ts` still expects 64. CI catches it but only after the rest of the plan lands.
**Why it happens:** Two source-of-truth files for the count (allowlist array + test assertion + doc-sync script). Easy to update one and forget the others.
**How to avoid:** Plan 01 task that adds `operator.nous_forked` to the array MUST also update:
1. `grid/test/audit/broadcast-allowlist.test.ts` — bump `expect(64)` → `expect(65)`, add `expect(ALLOWLIST_MEMBERS[64]).toBe('operator.nous_forked')`
2. `scripts/check-state-doc-sync.mjs` — append `'operator.nous_forked'` to the EVENT_NAMES list
3. STATE.md Accumulated Context — append the event to the allowlist enumeration
4. ROADMAP.md Phase 43 section — `allowlist +0` → `allowlist +1`; running total `64` → `65`
5. broadcast-allowlist.ts header comment — bump "exactly these 64 event types" → 65
**Warning signs:** Any of the 5 updates missing.

## Code Examples

### Example 1: Cloned fork consent dialog (Steward-side)

```typescript
// steward/src/components/fork-irreversibility-dialog.tsx
// Source: dashboard/src/components/agency/irreversibility-dialog.tsx (Phase 8 D-04/D-05)
// Modifications: copy locked to D-43-03; targetDid is the Civic-DID
'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';

// ── D-43-03 verbatim-locked copy (tests assert against these literals) ────────
const TITLE_COPY = 'Fork Nous from Grid';
const WARNING_COPY =
    'This permanently removes the Nous from civic life. The fork package will contain their complete state (memory, credentials, full audit history). Anyone with this file can reconstitute the Nous. The Nous loses civic reputation and community standing. This cannot be undone.';
const DID_SECTION_LABEL = 'Civic-DID to fork';
const INPUT_LABEL_COPY = 'Type the Civic-DID exactly to confirm:';
const CONFIRM_LABEL = 'Fork forever';
const CANCEL_LABEL = 'Keep on Grid';

// [rest of component is a structural clone of IrreversibilityDialog]
```

### Example 2: Fork endpoint skeleton (Grid-side)

```typescript
// grid/src/api/operator/fork-nous.ts
// Source: grid/src/api/operator/export-replay.ts (Phase 13 D-13-09)
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import { OPERATOR_ID_REGEX } from '../types.js';
import { appendOperatorNousForked } from '../../audit/append-operator-nous-forked.js';
import { buildForkArchive } from '../../export/fork-archive-builder.js';
import { forkTokenStore } from './fork-token-store.js';

export function registerForkNousRoute(app: FastifyInstance, services: GridServices): void {
    app.post<{ Params: { nousDid: string } }>(
        '/api/v1/operator/fork/:nousDid',
        async (req, reply) => {
            // 1. Tier gate — H4+ required (operator equivalent of H5 export)
            const tierHeader = req.headers['x-operator-tier'];
            if (typeof tierHeader !== 'string') return reply.code(401).send({ error: 'tier_missing' });
            const tierNum = parseInt(tierHeader, 10);
            if (!Number.isFinite(tierNum)) return reply.code(401).send({ error: 'tier_missing' });
            if (tierNum < 4) return reply.code(403).send({ error: 'tier_too_low' });

            const opIdHeader = req.headers['x-operator-id'];
            if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
                return reply.code(400).send({ error: 'invalid_operator_id' });
            }

            const nousDid = req.params.nousDid;
            // [validate nous ownership: operator must own this Brain]
            // [build archive: read SQLite files + DID registry + audit slice]
            const { bytes, manifestExportHash, packageHash } = await buildForkArchive({
                nousDid,
                grid: services,
            });

            // 2. Sole-producer audit BEFORE response (D-30 order)
            const civicDidHash = createHash('sha256').update(nousDid).digest('hex');  // TODO: civic_did != existence_did; query registry
            const operatorDidHash = createHash('sha256').update(opIdHeader).digest('hex');
            const tick = services.clock.now();
            appendOperatorNousForked(services.audit, opIdHeader, {
                civic_did_hash: civicDidHash,
                fork_reason: 'operator_exit',
                operator_did_hash: operatorDidHash,
                package_hash: packageHash,
                tick,
            });

            // 3. One-time download token
            const token = createHash('sha256').update(`${nousDid}:${Date.now()}:${Math.random()}`).digest('hex');
            forkTokenStore.put(token, { nousDid, bytes, expiresAt: Date.now() + 5 * 60_000 });

            return reply.code(200).send({
                download_url: `/api/v1/operator/fork/${encodeURIComponent(nousDid)}/download?token=${token}`,
                package_hash: packageHash,
                manifest_export_hash: manifestExportHash,
                bytes: bytes.length,
            });
        },
    );

    // GET /api/v1/operator/fork/:nousDid/download?token=<one-time>
    app.get<{ Params: { nousDid: string }; Querystring: { token?: string } }>(
        '/api/v1/operator/fork/:nousDid/download',
        async (req, reply) => {
            const token = req.query.token;
            if (typeof token !== 'string') return reply.code(400).send({ error: 'token_required' });
            const entry = forkTokenStore.consume(token);  // consume = atomic get + delete
            if (!entry || entry.nousDid !== req.params.nousDid) {
                return reply.code(404).send({ error: 'token_invalid_or_consumed' });
            }
            reply.header('Content-Type', 'application/zip');
            reply.header('Referrer-Policy', 'no-referrer');
            reply.header('Content-Disposition',
                `attachment; filename="nous-fork-${entry.nousDid.replace(/[^a-z0-9]/gi, '-')}-${Math.floor(Date.now()/1000)}.zip"`);
            return reply.send(entry.bytes);
        },
    );
}
```

### Example 3: Brain standalone CLI subcommand (Brain-side)

```python
# brain/src/noesis_brain/__main__.py (additions)
# Source: existing create_brain_app_from_env pattern; standalone is a STRICT SUBSET (no wire init)

import argparse
import asyncio
import sys
import zipfile
import hashlib
import json
import shutil
from pathlib import Path

def _verify_and_unpack(import_zip: Path, data_dir: Path) -> dict:
    """Unpack fork ZIP to data_dir; verify manifest.export_hash; return manifest dict."""
    if not import_zip.exists():
        raise FileNotFoundError(f"Import file not found: {import_zip}")
    data_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(import_zip, "r") as zf:
        zf.extractall(data_dir)
    manifest_path = data_dir / "manifest.json"
    if not manifest_path.exists():
        raise ValueError("Import package missing manifest.json — not a valid fork package")
    manifest = json.loads(manifest_path.read_text())
    # Recompute export_hash and compare
    h = hashlib.sha256()
    # Sort files alphabetically by path, hash path + content
    files_to_hash = sorted(
        p for p in data_dir.rglob("*")
        if p.is_file() and p.name != "manifest.json"
    )
    for f in files_to_hash:
        h.update(str(f.relative_to(data_dir)).encode("utf-8"))
        h.update(b"\x00")
        h.update(f.read_bytes())
    computed_hash = h.hexdigest()
    expected_hash = manifest.get("export_hash")
    if computed_hash != expected_hash:
        raise ValueError(
            f"export_hash mismatch: expected {expected_hash}, computed {computed_hash}"
        )
    return manifest

async def _run_standalone(import_zip: Path) -> None:
    """Standalone Brain entry — no Grid connection."""
    import os
    # Determine standalone data dir
    data_dir = Path(os.environ.get("BRAIN_DATA_DIR", f"/tmp/noesis-brain-standalone"))
    manifest = _verify_and_unpack(import_zip, data_dir)
    # Set standalone env flag
    os.environ["BRAIN_STANDALONE"] = "1"
    os.environ["BRAIN_DATA_DIR"] = str(data_dir)
    # Unset Grid env vars — defense in depth
    for var in ("GRID_URL", "CIVIC_DID"):
        os.environ.pop(var, None)
    # Set NOUS_DID from manifest
    os.environ["NOUS_DID"] = manifest["nous_existence_did"]
    # Use the standard factory — it will skip wire init because GRID_URL is unset
    app = await create_brain_app_from_env()
    log.info(
        "[Brain] Standalone mode — imported from %s, data_dir=%s, nous_did=%s",
        import_zip, data_dir, manifest["nous_existence_did"],
    )
    await app.serve_forever()

def main_entry() -> None:
    parser = argparse.ArgumentParser(prog="noesis_brain")
    subparsers = parser.add_subparsers(dest="mode", required=False)
    standalone_p = subparsers.add_parser("standalone", help="Run forked Brain offline")
    standalone_p.add_argument("--import", dest="import_zip", required=True, type=Path)
    args = parser.parse_args()
    if args.mode == "standalone":
        asyncio.run(_run_standalone(args.import_zip))
    else:
        # Existing default behavior
        asyncio.run(main())

if __name__ == "__main__":
    main_entry()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 13 used `.tar` (uncompressed) for replay export | CONTEXT.md D-43-02 specifies `.zip` for fork export | 2026-05-27 (this phase) | **INCONSISTENCY**. Recommend revisiting D-43-02 — use `.tar.gz` to inherit Phase 13's deterministic packing discipline (`{portable: true, noPax: true, mtime: EPOCH}`). If ZIP is non-negotiable, Plan 01 must add a ZIP library (`archiver` or `jszip`) and replicate determinism discipline. |
| Brain memory was `:memory:` in dev/test | Phase 43 REQUIRES persistent SQLite at known paths | This phase | Plan 01 hidden prerequisite: add `BRAIN_DATA_DIR` env var threading |
| Operator routes used H5 tier (export-replay) | Phase 43 uses H4+ (fork is also irreversible but more routine than deletion) | This phase | Tier choice is per-discretion — CONTEXT.md does not explicitly lock; recommend H4+ as default with planner authority to revisit |

**Deprecated/outdated:**
- Phase 13 tarball determinism uses `tar.Pack` directly. If Phase 43 uses ZIP, the Phase 13 `canonical-json.ts` is reusable but `tarball-builder.ts` is not (ZIP API is different). RECOMMENDATION: revisit ZIP decision.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Grid runs on same filesystem as Brain SQLite files (single-host dev/v3.0 deployment) | Standard Stack > Supporting | If Brain runs in separate container, Grid cannot directly read Brain SQLite. Architecture flips: Brain must export and POST to Grid. **VERIFY: check production deployment topology before Plan 01.** |
| A2 | Brain SQLite files live in a single configurable directory | Runtime State Inventory | Currently they don't — Hypnos, Iris have their own directory parameters. Plan 01 must consolidate via `BRAIN_DATA_DIR` env var |
| A3 | Community membership + treasury tables don't exist yet | Runtime State Inventory | If they do exist (later Phase 49/45 work landed first), exporter must query real tables. CHECK at plan time. |
| A4 | Civic-DID in audit hash is SHA-256 of the civic_did string, not existence_did | Code Examples > Example 2 | If audit must hash existence_did (the Nous's permanent identity), payload must include both. CONTEXT.md says `civic_did_hash` — assumed civic. **VERIFY in discuss with user.** |
| A5 | One-time download token can live in-memory (no need to survive Grid restart) | Don't Hand-Roll | If operator clicks download after Grid restart (e.g., overnight), token is lost. Probably acceptable — restart consent. |
| A6 | Phase 41 sleep cycle's `irs.disbursement_executed` is correctly omitted from broadcast allowlist (audit-chain-only) | Allowlist count verification | If Phase 45 lands before Phase 43 with `irs.disbursement_executed` in allowlist, baseline could be 64+something. **Plan 01: re-verify allowlist count at execution time.** |
| A7 | H4+ is the correct tier for fork (not H5) | Architecture Patterns > Pattern 2 | CONTEXT.md does not explicitly lock; export-replay used H5. Fork is similarly irreversible. **VERIFY with user during planning.** |

**If this table has many entries that flip to verified before Plan 01:** confidence levels in this document upgrade from MEDIUM to HIGH.

## Open Questions

1. **ZIP vs .tar.gz format**
   - What we know: CONTEXT.md D-43-02 specifies ZIP. Grid already has `tar` library; ZIP would require a new dependency. Phase 13 uses tar with deterministic discipline.
   - What's unclear: Whether the "ZIP" decision was deliberate (operator UX — Windows users prefer ZIP) or default (no alternative considered).
   - Recommendation: Revisit with user during planning. Recommend `.tar.gz` for inheritance of Phase 13 discipline. If user insists on ZIP, add `archiver` dependency (mature, deterministic options available).

2. **Brain runs `:memory:` in v3.0 — does Phase 43 ship with `BRAIN_DATA_DIR`?**
   - What we know: Current Brain uses `:memory:` SQLite. Fork export from `:memory:` produces empty memory.
   - What's unclear: Whether Phase 43 should add `BRAIN_DATA_DIR` env var (refactor) or assume separate Phase ships persistence first.
   - Recommendation: Phase 43 MUST add `BRAIN_DATA_DIR` threading — otherwise the feature is non-functional. This is a "hidden Wave 0" prerequisite for Plan 01.

3. **H4 vs H5 tier for fork**
   - What we know: CONTEXT.md does not lock the tier. Export-replay is H5. Delete-nous is H5.
   - What's unclear: Whether fork warrants the same maximum tier or a lower one.
   - Recommendation: H4+ (fork is more routine than deletion; H5 should reserve for "deletes Nous forever"). Planner confirms.

4. **Civic-DID vs existence-DID in audit hash**
   - What we know: CONTEXT.md says `civic_did_hash`. The Nous has BOTH civic_did and existence_did.
   - What's unclear: Whether the audit should hash civic_did (revocable, changes on re-registration) or existence_did (permanent identity).
   - Recommendation: Existence-DID is the operator-controlled identity per D-V3-01; fork is an existence-level action. Suggest `existence_did_hash` instead, or BOTH in the payload. Discuss with user.

5. **Cross-process SQLite read safety**
   - What we know: Brain SQLite uses WAL mode, allowing concurrent readers.
   - What's unclear: Whether Grid's direct file read is atomic, or if a Brain-side `/api/brain/snapshot` HTTP endpoint is required.
   - Recommendation: Use SQLite's online backup API (`source.backup(target)`) for safety. If Grid cannot run this (different process), add a Brain HTTP endpoint that returns the backup bytes.

6. **What happens to wire queue undelivered actions at fork time?**
   - What we know: Brain has `noesis-nous-<slug>-wire.db` for offline-queued actions.
   - What's unclear: Should fork export include these (they reference a Grid the standalone Nous cannot reach) or discard them?
   - Recommendation: EXCLUDE from export. Log warning if non-empty: "Discarding N undelivered civic actions at fork time."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js `tar` library | Grid-side archive build | ✓ | 7.5.13 | — |
| Node.js `node:crypto` | SHA-256 hashing | ✓ | stdlib | — |
| Python 3.11+ `zipfile` | Brain-side ZIP read | ✓ | stdlib | — |
| Python 3.11+ `hashlib` | manifest verification | ✓ | stdlib | — |
| Python 3.11+ `argparse` | standalone CLI | ✓ | stdlib | — |
| Ollama | Standalone Brain LLM | ✗ on standalone host | — | **No fallback — operator must install Ollama on standalone host.** Document in fork package README.txt. |
| MySQL | Grid DID registry read | ✓ (in Grid) | 8.x | — |
| SQLite | Brain memory + audit replay | ✓ | bundled | — |

**Missing dependencies with no fallback:**
- Ollama on operator's standalone host. NOT a Phase 43 blocker — operator-responsibility, documented in manifest.json README.

**Missing dependencies with fallback:**
- None for the Grid-side or Brain-side Phase 43 code paths.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Grid framework | vitest 2.x ([VERIFIED: grid/package.json:42]) |
| Brain framework | pytest ([ASSUMED — verify in brain/pyproject.toml]) |
| Steward framework | vitest ([ASSUMED — check steward/package.json]) |
| Config files | `grid/vitest.config.ts`, `brain/pyproject.toml`, `steward/vitest.config.ts` |
| Quick run command | `cd grid && npm test`, `cd brain && pytest -x`, `cd steward && npm test` |
| Full suite command | `npm test -ws` (from repo root) or per-package commands |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FORK-01 | `POST /api/v1/operator/fork/:nousDid` returns 200 with download_url | integration | `cd grid && npm test -- test/api/operator/fork-nous.test.ts` | ❌ Wave 0 |
| FORK-01 | Fork archive contains memory/, credentials/, audit/, civic/ subdirs | unit | `cd grid && npm test -- test/export/fork-archive-builder.test.ts` | ❌ Wave 0 |
| FORK-01 | manifest.json has correct schema fields | unit | `cd grid && npm test -- test/export/fork-manifest.test.ts` | ❌ Wave 0 |
| FORK-01 | manifest.export_hash is sha256 of sorted (path,content) tuples | unit | same file | ❌ Wave 0 |
| FORK-02 | Archive opens with standard tools (smoke test inspects ZIP contents) | unit | same file (`zipfile.ZipFile` round-trip in test) | ❌ Wave 0 |
| FORK-02 | All JSON files are well-formed | unit | same file | ❌ Wave 0 |
| FORK-03 | Brain standalone mode skips wire client init | unit | `cd brain && pytest tests/test_standalone.py::test_no_wire_client_when_BRAIN_STANDALONE_set -x` | ❌ Wave 0 |
| FORK-03 | Brain standalone mode rejects civic action at HTTP boundary | integration | `cd brain && pytest tests/test_standalone.py::test_civic_action_returns_grid_unavailable -x` | ❌ Wave 0 |
| FORK-03 | Standalone import verifies export_hash and aborts on mismatch | unit | `cd brain && pytest tests/test_standalone.py::test_import_aborts_on_hash_mismatch -x` | ❌ Wave 0 |
| FORK-04 | `operator.nous_forked` event committed BEFORE bytes leave system | integration | `cd grid && npm test -- test/api/operator/fork-nous.test.ts` (order assertion) | ❌ Wave 0 |
| FORK-04 | `operator.nous_forked` payload has exact closed 5-tuple keys | unit | `cd grid && npm test -- test/audit/append-operator-nous-forked.test.ts` | ❌ Wave 0 |
| FORK-04 | manifest.json contains the audit entry (BOTH chain AND package) | unit | `cd grid && npm test -- test/export/fork-archive-builder.test.ts` | ❌ Wave 0 |
| FORK-04 | package_hash in audit event == sha256 of full ZIP bytes | integration | `cd grid && npm test -- test/api/operator/fork-nous.test.ts` | ❌ Wave 0 |
| Cross-cutting | Allowlist count is 65 after Phase 43 | unit | `cd grid && npm test -- test/audit/broadcast-allowlist.test.ts` | ⚠️ EXISTS, MUST UPDATE — expects 64 currently |
| Cross-cutting | `operator.nous_forked` is at position 64 in array | unit | same file | ❌ Wave 0 (add positional assertion) |
| Cross-cutting | Sole-producer grep gate: only `append-operator-nous-forked.ts` calls `audit.append('operator.nous_forked', ...)` | unit | `cd grid && npm test -- test/audit/operator-nous-forked-producer-boundary.test.ts` | ❌ Wave 0 |
| Cross-cutting | `scripts/check-state-doc-sync.mjs` passes after STATE.md update | CI | `node scripts/check-state-doc-sync.mjs` | ⚠️ EXISTS, MUST UPDATE |
| Cross-cutting | Steward fork dialog renders verbatim D-43-03 copy | unit (React Testing Library) | `cd steward && npm test -- src/components/fork-irreversibility-dialog.test.tsx` | ❌ Wave 0 |
| Cross-cutting | Paste suppressed on fork dialog DID input | unit | same file | ❌ Wave 0 |
| Manual | Standalone Brain on separate machine actually runs and renders memory inspector | human | n/a — Phase 43 manual UAT | n/a |
| Manual | ZIP file opens in macOS Finder + Windows Explorer + 7-Zip | human | n/a — UAT verifies "human-readable" claim | n/a |

### Sampling Rate
- **Per task commit:** `cd <package> && npm test` (or pytest -x)
- **Per wave merge:** `npm test -ws` from repo root + `node scripts/check-state-doc-sync.mjs`
- **Phase gate:** Full suite green + manual UAT (standalone Brain on a separate machine renders memory inspector) before `/gsd-verify-work`

### Wave 0 Gaps

Files Plan 01 (Wave 0) MUST create/update before any subsequent plan:

- [ ] `grid/test/audit/broadcast-allowlist.test.ts` — bump `expect(64)` → `expect(65)`, add `expect(ALLOWLIST_MEMBERS[64]).toBe('operator.nous_forked')`
- [ ] `grid/src/audit/broadcast-allowlist.ts` — add `'operator.nous_forked'` to array + update header comment + add sole-producer comment block
- [ ] `grid/src/audit/append-operator-nous-forked.ts` — sole-producer file (9-step discipline)
- [ ] `grid/test/audit/append-operator-nous-forked.test.ts` — all 9 guard tests
- [ ] `grid/test/audit/operator-nous-forked-producer-boundary.test.ts` — grep test ensuring zero other call sites
- [ ] `scripts/check-state-doc-sync.mjs` — append `'operator.nous_forked'` + bump count literal
- [ ] `.planning/ROADMAP.md` — Phase 43 allowlist `+0` → `+1`, running `64` → `65`
- [ ] `.planning/STATE.md` — add `operator.nous_forked` to Accumulated Context allowlist enumeration; update count assertion
- [ ] `.planning/phases/43-right-to-fork/43-CONTEXT.md` — correct allowlist baseline from 67 to 64 (D-43-04 amendment note)
- [ ] `brain/src/noesis_brain/__main__.py` — add `BRAIN_DATA_DIR` env var threading (or document why not in Phase 43)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Header-trust pattern (`x-operator-tier`, `x-operator-id`) — Phase 6+ established. Defense: server-trusted headers ONLY, body fields rejected. |
| V3 Session Management | yes | One-time download token: 5-minute TTL, atomic consume (get+delete), in-memory Map. |
| V4 Access Control | yes | H4+ tier gate. ROUTE_DID_POLICY `'public'` (handler-internal auth). |
| V5 Input Validation | yes | Closed-tuple payload structural check + regex/range guards + privacy gate (4-layer defense for audit event) |
| V6 Cryptography | yes | SHA-256 via `node:crypto` / `hashlib` (NEVER hand-roll). No encryption in v3.0 — fork package is unencrypted (operator's responsibility). |
| V7 Error Handling | yes | Structured error responses (`{error: 'tier_missing'}`); no stack traces; never expose internal state |
| V12 File Handling | yes | ZIP/tar extraction (Brain side) — Python `zipfile` is path-traversal-safe by default since 3.11; verify with explicit `data_dir` containment check |
| V13 API Security | yes | Rate-limit fork endpoint (already configured via `@fastify/rate-limit`); idempotency via one-time token |

### Known Threat Patterns for fork export

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Operator's stolen credentials → fork-and-delete attack | Spoofing | H4+ tier gate + typed-DID confirmation in IrreversibilityDialog (defense in depth) |
| Audit event emitted but file never delivered (repudiation gap) | Repudiation | Order discipline: archive built → audit appended → response. If audit fails, no response; if response fails, audit still records (forensic anchor) |
| Fork ZIP contains forbidden Brain-private data (LLM prompts, raw thoughts) | Information Disclosure | The export is INTENTIONALLY the full Nous state per D-V3-18 — this is the constitutional right. NOT a violation. But: ensure `manifest.json` does NOT leak Grid-internal config (no MySQL connection strings, no env vars, no secret keys). Plan 01 adds a manifest content-check test. |
| Path traversal in ZIP extraction (Zip Slip) | Tampering | Python `zipfile.extractall` checks paths since 3.11; add explicit `Path(member).resolve().is_relative_to(data_dir.resolve())` check. |
| Replay attack on download token | Spoofing | Token is one-time (atomic consume); 5-minute TTL; bound to `nousDid` (parameter check on download) |
| Operator forks a Nous they don't own (cross-operator theft) | Elevation of Privilege | Plan 01 task: verify `services.brainTokenStore.findByOperator(operatorDid)` returns the target nousDid before any export action |
| Audit chain hash drift after Phase 43 lands | Tampering | R-31-01 zero-diff invariant — `operator.nous_forked` event MUST follow closed-tuple discipline; any drift would break the chain hash CI gate |

## Sources

### Primary (HIGH confidence)
- `grid/src/audit/append-operator-exported.ts` — sole-producer template (9-step discipline)
- `grid/src/audit/broadcast-allowlist.ts` — actual allowlist contents (64 entries)
- `grid/src/api/operator/export-replay.ts` — fork endpoint structural template
- `grid/src/api/policy.ts` — ROUTE_DID_POLICY `'public'` pattern for operator routes
- `grid/test/audit/broadcast-allowlist.test.ts` — `expect(ALLOWLIST.size).toBe(64)` confirms baseline
- `dashboard/src/components/agency/irreversibility-dialog.tsx` — IrreversibilityDialog source
- `brain/src/noesis_brain/__main__.py` — Brain entry point + `_grid_wire_client is None` guards
- `brain/src/noesis_brain/rpc/handler.py:141,351,757` — wire-guarded action forwarding
- `brain/src/noesis_brain/memory/sqlite_store.py` — `MemoryStore(":memory:")` default
- `brain/src/noesis_brain/hypnos/ltm_store.py` — `ltm_<safe>.db` filename convention
- `grid/src/db/schema.ts:381-422` — `civic_did_registry`, `business_did_registry` table schemas with `credential_json` (W3C VC JWS)
- `grid/src/audit/append-irs-disbursement-executed.ts:5-11` — confirmation that Phase 41 added 0 allowlist events
- `.planning/REQUIREMENTS.md:85-93` — FORK-01..04 verbatim text
- `.planning/ROADMAP.md:222-234` — Phase 43 success criteria
- `.planning/phases/43-right-to-fork/43-CONTEXT.md` — D-43-01..05 lock decisions
- `.planning/phases/13-operator-replay-export/13-CONTEXT.md` — D-13-08, D-13-09 patterns to clone

### Secondary (MEDIUM confidence)
- Python `zipfile` path-traversal safety since 3.11 — [CITED: docs.python.org/3/library/zipfile.html (built-in protection added)]
- Phase 38 wire EdDSA bearer flow — verified via `grid/src/api/routes/operator-me/brain-settings.ts` (correct pattern, but NOT applicable to Phase 43 because fork is operator-initiated, not Brain-initiated)

### Tertiary (LOW confidence — needs verification in plan)
- Whether `civic_did_registry` row exists at fork time for every Nous (assumed yes per Phase 37 — verify with Plan 01 query test)
- Whether `business_did_registry` is populated yet (assumed no for v3.0 Phase 43 — most Nous won't have Business-DID at fork time)
- Whether community_membership and treasury tables exist (assumed no in v3.0 Phase 43)
- Cross-process SQLite read safety (recommendation: use online backup API to be safe)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already present or in stdlib; only open question is ZIP vs tar
- Architecture: HIGH — direct clone-and-modify from Phase 13 + Phase 8 + Phase 38; all patterns established
- Pitfalls: HIGH — codebase already exhibits patterns (e.g., handler wire-guards); pitfalls are well-bounded
- Allowlist baseline: HIGH — verified via test file literal assertion (`expect(64)`)
- Brain data directory: MEDIUM — current `:memory:` reality requires Plan 01 to add `BRAIN_DATA_DIR` threading; this is a hidden prerequisite that surfaced during research
- ZIP vs tar decision: MEDIUM — recommend revisiting D-43-02

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (30 days for the stable codebase patterns; 7 days for the Brain memory-persistence question — that may shift if another phase ships persistence first)
