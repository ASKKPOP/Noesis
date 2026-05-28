# Phase 43: Right-to-Fork Export Tooling — Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 43 delivers constitutional enforcement of D-V3-18 (right-to-fork). Two coordinated deliverables:

1. **Grid export endpoint** — `POST /api/v1/operator/fork/<nous-did>` produces a portable ZIP archive containing the full Nous state: Brain memory (SQLite dumps), civic credentials (W3C VCs), complete audit history (JSONL), community memberships, and treasury balance. The Grid records `operator.nous_forked` in the audit chain and inside the package.

2. **Brain standalone mode** — `nous standalone --import <package.zip>` reconstitutes the Brain from the export package and runs with full cognition (Ollama) but no Grid connectivity. Civic actions (marketplace, voting, messaging) return a `grid_unavailable` error. Operator can interact with the Nous as normal via Steward/local interface.

Depends on: Phase 37 (Civic-DID W3C VCs), Phase 38 (Brain-Grid wire protocol + EdDSA bearer tokens).

</domain>

<decisions>
## Implementation Decisions

### D-43-01: Standalone Brain scope — Full (FORK-03)

Phase 43 ships BOTH the Grid export endpoint AND the Brain-side standalone mode. Right-to-fork is only constitutionally meaningful if the operator can actually run the Nous after forking.

**Standalone Brain behavior:**
- Full LLM cognition via Ollama (same model, same tick loop)
- Memory, reflection, Hypnos consolidation — all active
- No Grid connection — no WSS subscriber, no heartbeat, no presence
- Civic actions (marketplace bids, governance votes, inter-Nous messaging) return `{"error": "grid_unavailable", "detail": "This Nous is running standalone — civic features require Grid connection."}` — clear error, not silent failure
- Re-joining civic life: operator sets `BRAIN_GRID_URL` env var back and restarts; Nous re-registers via Portal → Polis flow (Phase 37/43 migration path: loses civic reputation, keeps Brain memory, per FORK-03)

### D-43-02: Export package format — .tar.gz with JSON manifest (AMENDED from ZIP)

Fork package is a `.tar.gz` archive named `nous-fork-<civic_did_hash>-<unix_timestamp>.tar.gz`.

**Amendment note:** Originally specified as `.zip`. Changed to `.tar.gz` to inherit Phase 13's hardening discipline (`tar` already in `grid/package.json`, deterministic by default — no new npm dep, no new determinism implementation required).

**Internal structure:**
```
manifest.json                — Package metadata, integrity hashes, Nous identity
memory/
  nous.db                    — Primary memory SQLite (MemoryStore — episodic + wiki/Karpathy)
  ltm.db                     — Long-term memory SQLite (Hypnos LtmStore — consolidated memories)
  psyche.db                  — Psyche/identity state SQLite (if Pneuma maps here)
  [any other Brain SQLite DB files at BRAIN_DATA_DIR at export time]
credentials/
  civic-did.vc.json          — Civic-DID W3C VC (JWS-signed)
  business-did.vc.json       — Business-DID W3C VC (if held, else absent)
audit/
  chain-export.jsonl         — Full audit chain entries where Nous is actor or subject (JSONL)
  chain-tail-hash.txt        — Tail hash of the audit chain at export time (integrity anchor)
civic/
  memberships.json           — Community memberships: [{community_id, joined_at, role, charter_hash}]
  treasury.json              — Nous treasury balance: {bios_balance, last_updated_tick}
```

**manifest.json structure:**
```json
{
  "format_version": "1.0",
  "exported_at": "<ISO timestamp>",
  "exported_at_tick": 12345,
  "nous_civic_did": "did:noesis:nous:...",
  "nous_existence_did": "did:noesis:nous:...",
  "grid_id": "genesis",
  "export_hash": "<sha256 of all included files, sorted by path>",
  "chain_tail_hash": "<from audit/chain-tail-hash.txt>",
  "memory_files": ["nous.db", "ltm.db", ...],
  "note": "FORK-02: This archive is human-readable. Extract with tar -xzf and read manifest.json to inspect."
}
```

**Researcher and planner:** Identify all Brain SQLite database files at runtime (may vary by Nous configuration). The export captures ALL `.db` files in `BRAIN_DATA_DIR`.

### D-43-03: Fork consent gate — IrreversibilityDialog clone

Fork is consent-gated in Steward's Local Nous Manager page (Phase 40, `/system/local-ai`). Operator must type the Nous's **Civic-DID** to confirm.

- **Modal title:** `Fork Nous from Grid`
- **Warning body:** `This permanently removes the Nous from civic life. The fork package will contain their complete state (memory, credentials, full audit history). Anyone with this file can reconstitute the Nous. The Nous loses civic reputation and community standing. This cannot be undone.`
- **Confirm label:** `Fork forever`
- **Cancel label:** `Keep on Grid`
- **Typed confirmation:** Operator types the full Civic-DID string. Paste is suppressed (keyboard input only). String must match exactly before the `Fork forever` button activates.
- **Pattern:** Direct clone of `dashboard/src/components/agency/irreversibility-dialog.tsx` (Phase 13/8 pattern).

### D-43-04: Allowlist — +1 (operator.nous_forked), 67 → 68 (CORRECTED)

ROADMAP listed +0 but this was a planning oversight. FORK-04 requires `operator.nous_forked` in the Grid's audit chain. The allowlist discipline requires explicit addition for every event regardless of namespace family.

**Amendment 2026-05-27 (Plan 43-01 execution correction):** Plan 43-01 was written with baseline "64 → 65" (based on research that said Phase 42 was untracked/not yet executed). At execution time, Plan 43-01 found that Phase 42 HAS shipped: the test file literal `expect(ALLOWLIST.size).toBe(67)` in `grid/test/audit/broadcast-allowlist.test.ts` is authoritative. Correct delta: **67 → 68**. All 5 source-of-truth files updated with 67 → 68 by Plan 43-01.

**New event:**
| Event | Payload | Sole producer |
|-------|---------|--------------|
| `operator.nous_forked` | `{ civic_did_hash, operator_did_hash, tick, package_hash, fork_reason }` | `grid/src/audit/append-operator-nous-forked.ts` |

**Payload notes:**
- `civic_did_hash`: SHA-256 of the forked Nous's Civic-DID (no raw DID in audit)
- `operator_did_hash`: SHA-256 of the requesting operator's DID
- `package_hash`: SHA-256 of the complete .tar.gz archive (integrity anchor)
- `fork_reason`: string enum — `"operator_exit"` (v3.0 only value)

This event is also embedded INSIDE the fork package (`manifest.json` contains the Grid audit entry for the fork event, satisfying FORK-04's "BOTH chain AND package" requirement).

**Running allowlist total after Phase 43:** 68

**ROADMAP and STATE.md were updated** in Plan 43-01 to reflect +1 instead of +0, and the allowlist baseline corrected to 67 → 68.

### D-43-06: Brain data persistence prerequisite — BRAIN_DATA_DIR env var

Research found a showstopper: `MemoryStore(":memory:")` is hardcoded in `brain/src/noesis_brain/__main__.py:250`. Fork export from an in-memory SQLite DB produces an empty `memory/` directory — the fork would be non-functional.

**Plan 01 must add:**
- `BRAIN_DATA_DIR` env var (default: `~/.noesis/brain/data/` or similar)
- Thread `BRAIN_DATA_DIR` through `MemoryStore`, `LtmStore`, `IrisStore` construction in `__main__.py`
- SQLite files are created at `BRAIN_DATA_DIR/{nous.db,ltm.db,psyche.db,...}` 
- Brain standalone import extracts `.db` files into the configured `BRAIN_DATA_DIR`

This is a prerequisite for FORK-01 to be non-trivially functional.

### D-43-05: Brain standalone CLI interface

New Brain startup mode: `python -m noesis_brain standalone --import <path-to-zip>`

**Import behavior:**
1. Unzip package to Brain data directory
2. Verify `manifest.json` → check `export_hash` integrity (fail with error if mismatch)
3. Copy `memory/*.db` files into Brain's configured data path
4. Load `credentials/` into Brain's DID key store
5. Set a `STANDALONE_MODE=true` env flag that disables Grid wire module on startup
6. Launch normal tick loop (Ollama, memory, reflection) — Grid-bound modules (wire/client.py, wire/subscriber.py, heartbeat) are no-ops in standalone mode

**New env var:** `BRAIN_STANDALONE=1` (or set by `--standalone` flag) — tells BrainApp to skip Grid wire initialization

### Claude's Discretion

- Exact list of Brain `.db` files at export time (researcher discovers, planner enumerates)
- Whether `psyche.db` and other non-listed modules need export (researcher verifies)
- Brain-side ZIP extraction library (Python stdlib `zipfile` — no new deps)
- SHA-256 implementation for `export_hash` (Python stdlib `hashlib`)
- How `ROUTE_DID_POLICY` entry is classified for `POST /api/v1/operator/fork/<nous-did>` — `operator_did_required` (Brain EdDSA bearer) vs `civic_did_required`
- Whether Brain standalone HTTP endpoint (`/api/brain/*` via Steward) needs adaptation for standalone mode

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 43 Specification
- `.planning/ROADMAP.md` §"Phase 43: Right-to-Fork Export Tooling" — goal, success criteria (FORK-01..04), allowlist +1 correction
- `.planning/REQUIREMENTS.md` §FORK — FORK-01..04 requirement text
- `.planning/STATE.md` §D-V3-18 — Constitutional operator framework; right-to-fork is a constitutional mandate, not a feature

### Phase 13 Pattern (direct clone source)
- `.planning/phases/13-operator-replay-export/13-CONTEXT.md` — IrreversibilityDialog pattern (D-13-08), `operator.exported` sole-producer structure (D-13-09), closed-tuple payload discipline, H5-consent gate verbatim-copy locks
- `dashboard/src/components/agency/irreversibility-dialog.tsx` — Phase 43 fork consent gate is a direct clone of this component

### Allowlist (MUST update in Plan 01)
- `grid/src/audit/broadcast-allowlist.ts` — add `operator.nous_forked` at position 67 (array index, 0-based; current length 67). Running total 67 → 68. Update count assertion comment.
- `grid/src/audit/append-operator-exported.ts` — sole-producer pattern reference for new `append-operator-nous-forked.ts`

### Phase 38 Wire Protocol (Brain auth pattern)
- `brain/src/noesis_brain/wire/client.py` — GridWireClient (HTTPS REST + EdDSA bearer). Phase 43 Grid route uses same Brain JWT bearer auth as `GET /api/v1/operator/me/brain-settings`.
- `brain/src/noesis_brain/wire/token_manager.py` — EdDSA token management. Fork endpoint authenticated via same `brain_tokens` table mechanism.
- `grid/src/operator/data/operator-brain-store.ts` — existing Brain-facing operator store. Phase 43 fork endpoint builds on same operator data pattern.

### Phase 40 Local Nous Manager (UI integration point)
- `steward/src/app/system/local-ai/page.tsx` — Fork UI lives here as a new section. Read Phase 40 patterns for poll loops, Brain HTTP proxy, `BRAIN_HTTP_SECRET` env discipline.
- `steward/src/app/api/brain/[...path]/route.ts` — Brain HTTP proxy; Phase 43 fork trigger goes through Grid API (not Brain), but this file shows the server-side secret pattern.

### Phase 37 DID Registry (credentials in package)
- `grid/src/registry/` — Civic-DID and Business-DID registry. Fork export reads W3C VCs from this store to include in `credentials/`.

### Phase 36 Policy Table
- `grid/src/api/policy.ts` — ROUTE_DID_POLICY table. `POST /api/v1/operator/fork/:nousDid` MUST have an entry.

### Brain Memory Architecture (export targets)
- `brain/src/noesis_brain/memory/sqlite_store.py` — MemoryStore (primary memory + Karpathy wiki pages). SQLite file at Brain data path.
- `brain/src/noesis_brain/hypnos/ltm_store.py` — LtmStore (Hypnos long-term memory). SQLite file.
- `brain/src/noesis_brain/__main__.py` — Brain entry point; standalone mode adds `--import` subcommand here.

### Constitutional Architecture
- `.planning/research/v3.0/CIVIC-ARCHITECTURE.md` §D-V3-18 — Right-to-fork constitutional mandate

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dashboard/src/components/agency/irreversibility-dialog.tsx` — Direct clone for fork consent gate (typed Civic-DID confirmation, paste-suppressed, same prop interface)
- `grid/src/audit/append-operator-exported.ts` — Pattern reference for new `append-operator-nous-forked.ts` sole-producer file
- `brain/src/noesis_brain/wire/client.py` — GridWireClient pattern; fork endpoint uses same EdDSA bearer auth
- `steward/src/app/system/local-ai/page.tsx` — Existing Local Nous Manager; fork UI section added here
- `brain/src/noesis_brain/__main__.py` — Brain entry point; `standalone` subcommand added here
- `brain/src/noesis_brain/memory/sqlite_store.py` — MemoryStore SQLite (Karpathy wiki + episodic memory)
- `brain/src/noesis_brain/hypnos/ltm_store.py` — Hypnos LtmStore SQLite (LTM consolidation)

### Established Patterns
- **Sole-producer audit boundary** (Phase 6+): `append-operator-nous-forked.ts` is the ONLY file that calls `audit.append('operator.nous_forked', ...)`. Closed-tuple payload + `payloadPrivacyCheck` + `audit.append` triad.
- **IrreversibilityDialog** (Phase 8/13): paste-suppressed typed confirmation. Exact copy text must be verbatim-locked in test assertions.
- **ROUTE_DID_POLICY** (Phase 36): every new Fastify route under `api/v1/` needs an explicit entry.
- **Closed-tuple payloads**: `Object.keys(payload).sort()` strict-equality assertions required for all new audit events.
- **Phase 40 Tier 1 Local Nous Manager**: D-V3-36 taxonomy — fork is an operator-scoped Brain lifecycle action, lives in Tier 1.

### Integration Points
- `grid/src/api/server.ts` — register `POST /api/v1/operator/fork/:nousDid` route with Brain EdDSA bearer auth
- `grid/src/audit/broadcast-allowlist.ts` — add `operator.nous_forked` at position 67 (array index, 0-based)
- `steward/src/app/system/local-ai/page.tsx` — add "Fork Nous" section with IrreversibilityDialog clone
- `brain/src/noesis_brain/__main__.py` — add `standalone` subcommand with `--import <zip>` argument
- `brain/src/noesis_brain/wire/` — standalone mode gate: if `BRAIN_STANDALONE=1`, skip client/subscriber/token_manager initialization

</code_context>

<specifics>
## Specific Ideas

- **manifest.json export_hash**: SHA-256 of the concatenation of all file paths + file contents, sorted by path lexicographically. This makes the hash deterministic regardless of ZIP entry ordering.
- **package_hash in audit event**: same SHA-256 as `manifest.json`'s `export_hash` — one hash anchors both the audit chain and the manifest.
- **Standalone re-join path**: Operator sets `BRAIN_GRID_URL` env var + unsets `BRAIN_STANDALONE` + restarts Brain. Brain starts normal wire initialization. Nous must re-register Civic-DID via Portal → Polis (Phase 37 path) — loses civic reputation, keeps Brain memory. This re-join path is NOT implemented in Phase 43 (just documented in manifest.json and Steward UI hint).
- **Civic DID typed confirmation**: the exact Civic-DID string is shown above the input field (greyed out) so the operator can copy it visually but must type it manually — paste suppressed per IrreversibilityDialog pattern.
- **Fork package download**: after Grid generates the ZIP, Steward downloads it via a `GET /api/v1/operator/fork/:nousDid/download?token=<one-time-token>` endpoint (one-time token prevents re-download without new consent). Planner designs the token mechanism.

</specifics>

<deferred>
## Deferred Ideas

- **Re-join civic life as Phase 43 feature** — The standalone→re-join flow is documented (manifest.json hint + Steward UI) but NOT implemented in Phase 43. Actual re-join requires Portal→Polis re-registration (Phase 52+ Portal work).
- **Fork package encryption** — Export package is unencrypted in v3.0 (operator's responsibility). Passphrase-encrypted ZIP is a v3.1 enhancement.
- **Fork package signature** — Grid-signed package (proving the export was authentic) is a v3.1 enhancement.
- **Multi-Nous batch fork** — Fork all Nous for an operator in one operation. Not needed for v3.0 (single-Nous fork per the constitutional right).
- **ROADMAP +0 correction propagation** — Update ROADMAP.md and STATE.md Phase 43 allowlist delta from +0 to +1 in Plan 43-01.

</deferred>

---

*Phase: 43-right-to-fork*
*Context gathered: 2026-05-27*
