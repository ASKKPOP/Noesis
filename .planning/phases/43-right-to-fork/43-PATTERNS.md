# Phase 43: Right-to-Fork Export Tooling — Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `grid/src/audit/append-operator-nous-forked.ts` | utility/audit | request-response | `grid/src/audit/append-operator-exported.ts` | exact |
| `grid/src/audit/broadcast-allowlist.ts` (modify) | config | CRUD | self — bump count + add entry | n/a |
| `grid/src/api/operator/fork-nous.ts` | controller/route | request-response | `grid/src/api/operator/export-replay.ts` | exact |
| `grid/src/api/operator/fork-token-store.ts` | service | CRUD | none (trivial in-memory Map) | none |
| `grid/src/export/fork-archive-builder.ts` | service | file-I/O | `grid/src/export/tarball-builder.ts` | role-match |
| `grid/src/export/fork-manifest.ts` | utility | transform | `grid/src/export/manifest.ts` | exact |
| `grid/src/api/policy.ts` (modify) | config | — | self | n/a |
| `steward/src/components/fork-irreversibility-dialog.tsx` | component | request-response | `dashboard/src/components/agency/irreversibility-dialog.tsx` | exact |
| `steward/src/app/system/local-ai/page.tsx` (modify) | component | request-response | self (Phase 40 page.tsx) | n/a |
| `brain/src/noesis_brain/__main__.py` (modify) | config/entry | request-response | self — add `standalone` subcommand block | n/a |
| `brain/src/noesis_brain/standalone/importer.py` | utility | file-I/O | none — stdlib `zipfile`/`hashlib` | none |
| `brain/src/noesis_brain/standalone/factory.py` | service | request-response | `brain/src/noesis_brain/__main__.py` `create_brain_app_from_env` | role-match |
| `grid/test/audit/append-operator-nous-forked.test.ts` | test | — | `grid/test/audit/append-registry-civic-did-issued.test.ts` | exact |
| `brain/test/test_standalone.py` | test | — | `brain/test/test_local_ai_http.py` | role-match |

---

## Pattern Assignments

### `grid/src/audit/append-operator-nous-forked.ts` (utility/audit, request-response)

**Analog:** `grid/src/audit/append-operator-exported.ts` (lines 1–173)

**Imports pattern** (lines 29–31):
```typescript
import type { AuditChain } from './chain.js';
import type { AuditEntry } from './types.js';
import { payloadPrivacyCheck } from './broadcast-allowlist.js';
```

**Regex constants** (lines 34–40):
```typescript
/** 64-hex SHA-256 — matches grid/src/audit/state-hash.ts HEX64_RE. */
export const HEX64_RE = /^[0-9a-f]{64}$/;
export const OPERATOR_ID_RE = /^op:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

**Interface + EXPECTED_KEYS** (lines 51–66):
```typescript
export interface OperatorExportedPayload {
    readonly tier: 'H5';
    readonly operator_id: string;
    readonly start_tick: number;
    readonly end_tick: number;
    readonly tarball_hash: string;
    readonly requested_at: number;
}

const EXPECTED_KEYS = [
    'end_tick', 'operator_id', 'requested_at', 'start_tick', 'tarball_hash', 'tier',
] as const;
```

For the fork event, replace with the 5-tuple (alphabetical):
```typescript
export interface OperatorNousForkedPayload {
    readonly civic_did_hash: string;    // HEX64_RE
    readonly fork_reason: string;       // 'operator_exit'
    readonly operator_did_hash: string; // HEX64_RE
    readonly package_hash: string;      // HEX64_RE
    readonly tick: number;              // non-negative integer
}
const EXPECTED_KEYS = ['civic_did_hash', 'fork_reason', 'operator_did_hash', 'package_hash', 'tick'] as const;
const FORK_REASONS = new Set(['operator_exit']);
```

**9-step function body** — follow the exact step ordering from `append-operator-exported.ts` lines 80–172:

1. Operator-id format guard (`!OPERATOR_ID_RE.test(operatorId)`) — lines 81–84
2. Payload type guard (`payload === null || typeof payload !== 'object' || Array.isArray(payload)`) — lines 87–89
3. Literal/enum guard (`FORK_REASONS.has(...)`) — lines 92–96
4. Regex/range guards (loop over `['civic_did_hash','operator_did_hash','package_hash']`, then `tick` integer guard) — lines 99–142
5. Self-report invariant: **NOT applicable** for fork (no `operator_id` in payload) — omit step 5
6. Closed-tuple structural check (`Object.keys(payload).sort()` vs `EXPECTED_KEYS`) — lines 145–150
7. Explicit reconstruction (copy each field by name, no spread) — lines 153–161
8. Privacy gate (`payloadPrivacyCheck(cleanPayload)`) — lines 164–168
9. Commit (`return audit.append('operator.nous_forked', operatorId, cleanPayload)`) — line 172

**Error message style** (verbatim from analog):
```typescript
throw new TypeError(`appendOperatorNousForked: invalid operatorId — must match OPERATOR_ID_RE (op:<uuid-v4>), got ${JSON.stringify(operatorId)}`);
```

**JSDoc header comment** — copy the 9-step discipline comment block from lines 1–27 of the analog, updating references from `operator.exported` to `operator.nous_forked` and from `REPLAY-02` to `FORK-04 / D-43-04`.

---

### `grid/src/api/operator/fork-nous.ts` (controller/route, request-response)

**Analog:** `grid/src/api/operator/export-replay.ts` (lines 1–185)

**Imports pattern** (lines 47–55):
```typescript
import type { FastifyInstance } from 'fastify';
import type { GridServices } from '../server.js';
import type { ApiError } from '../types.js';
import { OPERATOR_ID_REGEX } from '../types.js';
import { appendOperatorNousForked } from '../../audit/append-operator-nous-forked.js';
import { buildForkArchive } from '../../export/fork-archive-builder.js';
import { createForkManifest } from '../../export/fork-manifest.js';
import { forkTokenStore } from './fork-token-store.js';
```
(Replace `appendOperatorExported`, `buildExportTarball`, `createManifest`, `ReplayGrid`, `buildStateAtTick` imports from analog.)

**Header-trust auth gate — copy verbatim** (analog lines 67–91):
```typescript
// 1. Tier gate — H4+ required (fork is operator-initiated, not Brain-initiated)
const tierHeader = req.headers['x-operator-tier'];
if (typeof tierHeader !== 'string') {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
const tierNum = parseInt(tierHeader, 10);
if (!Number.isFinite(tierNum)) {
    reply.code(401);
    return { error: 'tier_missing' } satisfies ApiError;
}
if (tierNum < 4) {   // H4+ for fork (analog uses 5 for H5; fork uses 4)
    reply.code(403);
    return { error: 'tier_too_low' } satisfies ApiError;
}
const opIdHeader = req.headers['x-operator-id'];
if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
    reply.code(400);
    return { error: 'invalid_operator_id' } satisfies ApiError;
}
const resolvedOperatorId = opIdHeader;
```

**Order discipline — copy the comment** (analog lines 154–156):
```typescript
// Sole-producer audit event — emit BEFORE streaming response (D-30 order).
// archive build → audit append → token issue → response.
// On any error before audit.append: no event emitted, no bytes shipped.
```

**Audit try/catch wrap** (analog lines 168–176):
```typescript
try {
    appendOperatorNousForked(services.audit, resolvedOperatorId, forkPayload);
} catch (err) {
    req.log.warn({ err: String(err) }, 'appendOperatorNousForked rejected');
    reply.code(400);
    return { error: 'audit_emit_failed' } satisfies ApiError;
}
```

**Response shape** — differs from analog (analog streams bytes directly; fork returns JSON + one-time token):
```typescript
return reply.code(200).send({
    download_url: `/api/v1/operator/fork/${encodeURIComponent(nousDid)}/download?token=${token}`,
    package_hash: packageHash,
    manifest_export_hash: manifestExportHash,
    bytes: archiveBytes.length,
});
```

**Second route (GET download)** — no analog; reference the `Referrer-Policy: no-referrer` pattern and `Content-Disposition` header from analog line 181:
```typescript
reply.header('Content-Type', 'application/octet-stream');
reply.header('Referrer-Policy', 'no-referrer');
reply.header('Content-Disposition', `attachment; filename="nous-fork-${...}-${timestamp}.tar.gz"`);
```

---

### `grid/src/export/fork-archive-builder.ts` (service, file-I/O)

**Analog:** `grid/src/export/tarball-builder.ts` (lines 1–158)

**Imports pattern** (lines 29–36):
```typescript
import { createHash } from 'node:crypto';
import { Pack as TarPack } from 'tar';
import { Header as TarHeader } from 'tar';
import { ReadEntry as TarReadEntry } from 'tar';
import { canonicalStringify } from './canonical-json.js';
```

**Determinism discipline — copy verbatim** (analog lines 50–92):
```typescript
const EPOCH = new Date(0);  // fixed mtime: Unix epoch (T-10-08)
const FILE_MODE = 0o644;

async function packFiles(files: Array<{ path: string; content: Buffer }>): Promise<Buffer> {
    const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
    return new Promise<Buffer>((resolve, reject) => {
        const pack = new TarPack({
            portable: true,   // strips uid/gid/uname/gname/ctime/atime
            noPax: true,      // no PAX extended headers
            mtime: EPOCH,     // fixed mtime for all entries
        });
        // ... same event-stream pattern
    });
}
```

**export_hash computation** — use logical hash of sorted (path, content) pairs, NOT hash of the outer archive bytes. This is the `manifest.export_hash` value. Then separately compute `package_hash = sha256(archiveBytes)` for the audit event:
```typescript
// Pass 1: compute export_hash over logical file contents (sorted by path)
const h = createHash('sha256');
for (const file of sorted) {
    h.update(file.path);
    h.update('\x00');
    h.update(file.content);
}
const exportHash = h.digest('hex');
```

**File set to pack** (replacing analog's `slice.jsonl`, `snapshot.*.json`):
```typescript
const files = [
    { path: 'manifest.json', content: Buffer.from(manifestJson, 'utf8') },
    { path: 'memory/nous.db', content: <brain_db_bytes> },
    { path: 'memory/ltm_<safe>.db', content: <ltm_db_bytes> },
    // ... all *.db from BRAIN_DATA_DIR via glob
    { path: 'credentials/civic-did.vc.json', content: Buffer.from(civicVcJson, 'utf8') },
    { path: 'audit/chain-export.jsonl', content: Buffer.from(jsonl, 'utf8') },
    { path: 'audit/chain-tail-hash.txt', content: Buffer.from(chainTailHash, 'utf8') },
    { path: 'civic/memberships.json', content: Buffer.from('{"memberships":[]}', 'utf8') },
    { path: 'civic/treasury.json', content: Buffer.from('{"bios_balance":0,"last_updated_tick":null}', 'utf8') },
];
```

**Wall-clock ban** (analog line 27):
```typescript
// NOTE: This file must NEVER import Date.now(), Math.random(), or any
// wall-clock source. Verified by the Phase 13 wall-clock grep gate.
```

---

### `grid/src/export/fork-manifest.ts` (utility, transform)

**Analog:** `grid/src/export/manifest.ts` (lines 1–72)

**Interface pattern** (lines 17–25):
```typescript
export interface ForkManifest {
    readonly format_version: '1.0';
    readonly exported_at: string;           // ISO timestamp
    readonly exported_at_tick: number;
    readonly nous_civic_did: string;
    readonly nous_existence_did: string;
    readonly grid_id: string;
    readonly export_hash: string;           // HEX64_RE — logical content hash
    readonly chain_tail_hash: string;       // HEX64_RE
    readonly memory_files: string[];
    readonly note: string;                  // human-readable open-source note
}
```

**Factory validation pattern** (lines 44–62):
```typescript
export function createForkManifest(input: CreateForkManifestInput): ForkManifest {
    if (!HEX64_RE.test(input.chainTailHash)) {
        throw new TypeError(`createForkManifest: chainTailHash must match HEX64_RE`);
    }
    // ... other range guards
    return { format_version: '1.0', ... };
}
```

---

### `grid/src/api/operator/fork-token-store.ts` (service, CRUD)

**Analog:** None (no existing in-memory token store). The RESEARCH.md pattern is:

```typescript
// Singleton in-memory store — no persistence needed (token lifetime = seconds)
interface ForkTokenEntry {
    nousDid: string;
    archiveBytes: Buffer;
    expiresAt: number;  // Date.now() + 5 * 60_000
    consumed: boolean;
}
const _store = new Map<string, ForkTokenEntry>();

export const forkTokenStore = {
    put(token: string, entry: ForkTokenEntry): void { _store.set(token, entry); },
    consume(token: string): ForkTokenEntry | undefined {
        const e = _store.get(token);
        if (!e || e.consumed || Date.now() > e.expiresAt) { _store.delete(token); return undefined; }
        _store.delete(token);
        return e;
    },
};
```

---

### `steward/src/components/fork-irreversibility-dialog.tsx` (component, request-response)

**Analog:** `dashboard/src/components/agency/irreversibility-dialog.tsx` (lines 1–201)

**Imports pattern** (line 22) — identical:
```typescript
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
```

**Copy constants block** (lines 25–34) — REPLACE with D-43-03 verbatim-locked copy:
```typescript
// ── D-43-03 verbatim-locked copy (tests assert against these literals) ────────
const TITLE_COPY = 'Fork Nous from Grid';
const WARNING_COPY =
    'This permanently removes the Nous from civic life. The fork package will contain their complete state (memory, credentials, full audit history). Anyone with this file can reconstitute the Nous. The Nous loses civic reputation and community standing. This cannot be undone.';
const DID_SECTION_LABEL = 'Civic-DID to fork';
const INPUT_LABEL_COPY = 'Type the Civic-DID exactly to confirm:';
const CONFIRM_LABEL = 'Fork forever';
const CANCEL_LABEL = 'Keep on Grid';
const CONFIRM_ARIA = 'Fork this Nous permanently. This action cannot be undone.';
const CANCEL_ARIA = 'Keep Nous on Grid. No action will be taken.';
const HINT_MISMATCH = 'Civic-DID does not match. Type exactly as shown.';
const HINT_MATCH = 'Match confirmed.';
```

**Props interface** (lines 37–43) — identical structure; `targetDid` is now the Civic-DID:
```typescript
export interface ForkIrreversibilityDialogProps {
    open: boolean;
    targetDid: string;   // the Civic-DID to type — captured at open time
    onConfirm: () => void;
    onCancel: () => void;
    openerRef?: RefObject<HTMLElement | null>;
}
```

**Component body** — copy structurally verbatim from analog lines 45–201:
- `capturedDidRef` closure-capture (analog lines 57–60) — MUST be preserved
- `useEffect` open/close lifecycle (lines 63–74) — copy verbatim
- `useEffect` close event listener / onCancel single-source (lines 77–90) — copy verbatim
- Backdrop click handler (lines 92–98) — copy verbatim
- `onPaste` suppressor (lines 148–150) — copy verbatim (D-05 discipline)
- `onKeyDown` Enter blocker (lines 151–155) — copy verbatim (D-03 discipline)
- `autoFocus` on Cancel button (line 175) — copy verbatim (safer default)

**`data-testid` values** — keep same ids as analog (`irrev-dialog`, `irrev-warning`, `irrev-did-input`, `irrev-cancel`, `irrev-delete`, `irrev-hint`, `irrev-did-label`, `irrev-input-label`). Tests assert these.

---

### `steward/src/app/system/local-ai/page.tsx` (modify — component, request-response)

**Analog:** `steward/src/app/system/local-ai/page.tsx` (lines 1–60+ read)

**New state additions** (follow existing `useState` pattern, lines 35–41):
```typescript
const [forkOpen, setForkOpen] = useState(false);
const [forkNousDid, setForkNousDid] = useState<string | null>(null);
const [forkStatus, setForkStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
const forkButtonRef = useRef<HTMLButtonElement | null>(null);
```

**API call pattern** (follow existing `fetch` style lines 46–59):
```typescript
const res = await fetch(`/api/v1/operator/fork/${encodeURIComponent(nousDid)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
});
```

**Fork section placement** — add after existing "Local AI Settings" form, before closing `</StewardShell>`.

---

### `grid/src/api/policy.ts` (modify — config)

**Pattern** (lines 26–60): add two entries to the frozen `ROUTE_DID_POLICY` object:

```typescript
// Phase 43 (FORK-01): Fork endpoint — header-trust operator auth (D-43-04)
'POST /api/v1/operator/fork/:nousDid': 'public',
'GET /api/v1/operator/fork/:nousDid/download': 'public',  // one-time-token download
```

The `'public'` value for operator routes is established at analog lines 153–172 (all `operator.*` routes are `'public'`).

---

### `brain/src/noesis_brain/__main__.py` (modify — entry point)

**Analog:** Lines 342–509 of `brain/src/noesis_brain/__main__.py`

**New imports to add** (follow existing `from __future__ import annotations` pattern, lines 27–38):
```python
import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path
```
(`asyncio`, `os`, `logging`, `signal` already imported at lines 29–34)

**argparse subcommand pattern** (replacing bare `asyncio.run(main())` at line 508):
```python
def main_entry() -> None:
    parser = argparse.ArgumentParser(prog="noesis_brain")
    subparsers = parser.add_subparsers(dest="mode", required=False)
    standalone_p = subparsers.add_parser("standalone", help="Run forked Brain offline")
    standalone_p.add_argument("--import", dest="import_zip", required=True, type=Path)
    args = parser.parse_args()
    if args.mode == "standalone":
        asyncio.run(_run_standalone(args.import_zip))
    else:
        asyncio.run(main())   # existing behavior unchanged

if __name__ == "__main__":
    main_entry()
```

**`BRAIN_DATA_DIR` env threading** (modify `create_brain_app` function, line 249):
```python
# Before (line 250):
memory_store = MemoryStream(MemoryStore(":memory:"))

# After:
data_dir_str = os.environ.get("BRAIN_DATA_DIR", "").strip()
nous_db_path = (
    os.path.join(data_dir_str, "nous.db") if data_dir_str else ":memory:"
)
memory_store = MemoryStream(MemoryStore(nous_db_path))
```

**`create_brain_app_from_env` standalone detection** (add after grid_url block, around line 347):
```python
# Standalone mode — skip ALL wire initialization
if os.environ.get("BRAIN_STANDALONE") == "1":
    app = create_brain_app(nous_name=nous_name, config_path=config_path, ...)
    app.http_server = _build_http_server(app.handler)
    # Do NOT wire GridWireClient/_wss_subscriber/_heartbeat_task
    return app
```

---

### `brain/src/noesis_brain/standalone/importer.py` (utility, file-I/O)

**Analog:** None — Python stdlib only. Pattern from RESEARCH.md code examples:

```python
import hashlib
import json
import zipfile
from pathlib import Path

def verify_and_unpack(import_zip: Path, data_dir: Path) -> dict:
    """Unpack fork archive to data_dir; verify manifest.export_hash; return manifest."""
    if not import_zip.exists():
        raise FileNotFoundError(f"Import file not found: {import_zip}")
    data_dir.mkdir(parents=True, exist_ok=True)

    # Phase 43: archive is .tar.gz (D-43-02 amendment). Use tarfile, not zipfile.
    import tarfile
    with tarfile.open(import_zip, "r:gz") as tf:
        # Zip-slip defense: reject members whose resolved path escapes data_dir
        for member in tf.getmembers():
            target = (data_dir / member.name).resolve()
            if not str(target).startswith(str(data_dir.resolve())):
                raise ValueError(f"Path traversal detected: {member.name}")
        tf.extractall(data_dir)

    manifest_path = data_dir / "manifest.json"
    if not manifest_path.exists():
        raise ValueError("Import package missing manifest.json")
    manifest = json.loads(manifest_path.read_text())

    # Recompute export_hash: sorted (path, content) logical hash
    h = hashlib.sha256()
    files_to_hash = sorted(
        p for p in data_dir.rglob("*")
        if p.is_file() and p.name != "manifest.json"
    )
    for f in files_to_hash:
        h.update(str(f.relative_to(data_dir)).encode("utf-8"))
        h.update(b"\x00")
        h.update(f.read_bytes())
    computed = h.hexdigest()
    expected = manifest.get("export_hash")
    if computed != expected:
        raise ValueError(f"export_hash mismatch: expected {expected}, computed {computed}")
    return manifest
```

**Note:** Archive is `.tar.gz` (D-43-02 amended from `.zip`). Use Python `tarfile` module instead of `zipfile`. The `tarfile` module is stdlib, always present in Python 3.11+.

---

### `brain/src/noesis_brain/standalone/factory.py` (service, request-response)

**Analog:** `brain/src/noesis_brain/__main__.py` `create_brain_app_from_env` (lines 342–480)

**Pattern** — create `create_brain_app_standalone(import_dir: Path) -> BrainApp` as a strict SUBSET of `create_brain_app_from_env`:

```python
async def create_brain_app_standalone(import_dir: Path) -> BrainApp:
    """Factory for standalone forked Brain — no Grid wire, no heartbeat, no WSS."""
    import os
    from noesis_brain.__main__ import create_brain_app, _build_http_server

    manifest_path = import_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text())

    nous_name = os.environ.get("NOUS_NAME", "standalone-nous")
    # Set data dir to unpacked import directory
    os.environ["BRAIN_DATA_DIR"] = str(import_dir / "memory")
    os.environ["NOUS_DID"] = manifest["nous_existence_did"]
    # Ensure no wire env vars survive
    for var in ("GRID_URL", "CIVIC_DID"):
        os.environ.pop(var, None)

    # Use standard factory — no grid_url branch fires because GRID_URL is unset
    app = create_brain_app(nous_name=nous_name, ...)
    app.http_server = _build_http_server(app.handler)
    # _wss_subscriber and _heartbeat_task remain None — standalone is wire-free
    return app
```

**Wire guard** (Brain handler line 141): `self._grid_wire_client: "Any | None" = None` — this default is already `None`. Standalone factory never sets it; all `if self._grid_wire_client is not None:` guards in handler.py (lines 141, 351, 757) make civic actions no-ops automatically.

---

### `grid/test/audit/append-operator-nous-forked.test.ts` (test)

**Analog:** `grid/test/audit/append-registry-civic-did-issued.test.ts` (lines 1–80+)

**Test structure pattern**:
```typescript
import { describe, it, expect } from 'vitest';
import { AuditChain } from '../../src/audit/chain.js';
import { appendOperatorNousForked } from '../../src/audit/append-operator-nous-forked.js';

function makeChain(): AuditChain { return new AuditChain(); }

function validOperatorId(): string {
    return 'op:12345678-1234-4234-8234-123456789012';
}

function validPayload() {
    return {
        civic_did_hash: 'a'.repeat(64),
        fork_reason: 'operator_exit',
        operator_did_hash: 'b'.repeat(64),
        package_hash: 'c'.repeat(64),
        tick: 42,
    };
}

describe('appendOperatorNousForked — payload validation', () => {
    it('throws TypeError when payload is null', () => {
        expect(() => appendOperatorNousForked(makeChain(), validOperatorId(), null as never)).toThrow(TypeError);
    });
    // ... one test per guard (9 steps × each invalid variant)
    it('succeeds with valid payload', () => {
        const entry = appendOperatorNousForked(makeChain(), validOperatorId(), validPayload());
        expect(entry.eventType).toBe('operator.nous_forked');
    });
    it('throws TypeError when extra key added (closed-tuple guard)', () => {
        expect(() => appendOperatorNousForked(makeChain(), validOperatorId(), {
            ...validPayload(), extra_key: 'bad',
        } as never)).toThrow(/unexpected key set/);
    });
});
```

---

### `grid/test/audit/operator-nous-forked-producer-boundary.test.ts` (test)

**Analog:** `grid/test/audit/telos-refined-producer-boundary.test.ts` (lines 1–47)

**Copy verbatim** and replace:
- `SOLE_PRODUCER_FILE = 'audit/append-telos-refined.ts'` → `'audit/append-operator-nous-forked.ts'`
- Pattern string `'telos\.refined'` → `'operator\.nous_forked'`
- Description string `'telos.refined — sole producer boundary (D-31)'` → `'operator.nous_forked — sole producer boundary (FORK-04 / D-43-04)'`

---

### `brain/test/test_standalone.py` (test)

**Analog:** `brain/test/test_local_ai_http.py` (lines 1–80+)

**Test structure pattern** — pytest + asyncio + MagicMock:
```python
"""Phase 43 — Brain standalone mode tests (FORK-03, D-43-05)."""
from __future__ import annotations
import os
import tempfile
import json
import hashlib
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest

class TestStandaloneImport:
    def test_import_aborts_on_hash_mismatch(self, tmp_path: Path) -> None:
        """verify_and_unpack raises ValueError when export_hash does not match."""
        from noesis_brain.standalone.importer import verify_and_unpack
        # Create a minimal valid archive, then corrupt a file
        ...
        with pytest.raises(ValueError, match="export_hash mismatch"):
            verify_and_unpack(corrupt_zip, tmp_path / "data")

    def test_no_wire_client_when_BRAIN_STANDALONE_set(self, monkeypatch) -> None:
        """BrainApp constructed in standalone mode has _grid_wire_client = None."""
        monkeypatch.setenv("BRAIN_STANDALONE", "1")
        monkeypatch.delenv("GRID_URL", raising=False)
        # ... create_brain_app_from_env() → assert app.handler._grid_wire_client is None
```

---

## Shared Patterns

### Authentication — Header-Trust Operator Gate (D-25b-NEW-1)
**Source:** `grid/src/api/operator/export-replay.ts` lines 67–91
**Apply to:** `grid/src/api/operator/fork-nous.ts`

Exact verbatim pattern — read tier and operator_id ONLY from `req.headers['x-operator-tier']` and `req.headers['x-operator-id']`. NEVER from request body. Body fields for auth are ignored (GAP-25a-1 fix).

```typescript
const tierHeader = req.headers['x-operator-tier'];
if (typeof tierHeader !== 'string') { reply.code(401); return { error: 'tier_missing' } satisfies ApiError; }
const tierNum = parseInt(tierHeader, 10);
if (!Number.isFinite(tierNum)) { reply.code(401); return { error: 'tier_missing' } satisfies ApiError; }
if (tierNum < 4) { reply.code(403); return { error: 'tier_too_low' } satisfies ApiError; }
const opIdHeader = req.headers['x-operator-id'];
if (typeof opIdHeader !== 'string' || !OPERATOR_ID_REGEX.test(opIdHeader)) {
    reply.code(400); return { error: 'invalid_operator_id' } satisfies ApiError;
}
```

### Audit Order Discipline (D-30)
**Source:** `grid/src/api/operator/export-replay.ts` lines 154–176 + JSDoc lines 27–31
**Apply to:** `grid/src/api/operator/fork-nous.ts`

archive build → audit append → response. Audit event BEFORE bytes leave system. Try/catch around `appendOperator*` → return `audit_emit_failed` on rejection.

### Sole-Producer Boundary (Phase 6+ discipline)
**Source:** `grid/src/audit/append-operator-exported.ts` entire file
**Apply to:** `grid/src/audit/append-operator-nous-forked.ts`

One file per event type calls `audit.append(...)`. 9-step discipline (format guard, type guard, literal/enum guard, regex/range guards, closed-tuple check, explicit reconstruction, privacy gate, commit). `payloadPrivacyCheck` is mandatory belt-and-suspenders.

### Closed-Tuple Structural Check
**Source:** `grid/src/audit/append-operator-exported.ts` lines 145–150
**Apply to:** `grid/src/audit/append-operator-nous-forked.ts`

```typescript
const actualKeys = Object.keys(payload).sort();
if (actualKeys.length !== EXPECTED_KEYS.length
    || !actualKeys.every((k, i) => k === EXPECTED_KEYS[i])) {
    throw new TypeError(
        `appendOperatorNousForked: unexpected key set — expected ${JSON.stringify(EXPECTED_KEYS)}, got ${JSON.stringify(actualKeys)}`,
    );
}
```

### Tar Determinism (Phase 13 discipline)
**Source:** `grid/src/export/tarball-builder.ts` lines 50–92
**Apply to:** `grid/src/export/fork-archive-builder.ts`

```typescript
const EPOCH = new Date(0);
const pack = new TarPack({ portable: true, noPax: true, mtime: EPOCH });
```
Files sorted by `path.localeCompare` before packing. Wall-clock (`Date.now()`) is FORBIDDEN inside the builder function. Verified by grep gate.

### IrreversibilityDialog Clone Discipline (Phase 8 D-04/D-05)
**Source:** `dashboard/src/components/agency/irreversibility-dialog.tsx` lines 1–201
**Apply to:** `steward/src/components/fork-irreversibility-dialog.tsx`

Four invariants that MUST be preserved from analog:
1. `capturedDidRef.current = targetDid` at open time (closure-capture race safety)
2. `onPaste={(e) => e.preventDefault()}` — paste suppressed
3. `onKeyDown — if (e.key === 'Enter') e.preventDefault()` — Enter blocked
4. `autoFocus` on Cancel button (safer default)

Copy strings MUST match D-43-03 **verbatim** — tests assert exact literals.

### Sole-Producer Boundary Test (grep-walk pattern)
**Source:** `grid/test/audit/telos-refined-producer-boundary.test.ts` lines 1–47
**Apply to:** `grid/test/audit/operator-nous-forked-producer-boundary.test.ts`

Walk all `.ts` files in `grid/src/`. Skip `SOLE_PRODUCER_FILE`. Test that no other file contains `/\b(audit|chain|this\.audit|this\.chain)\.append[^;]{0,200}['"]operator\.nous_forked['"]/s`.

### Brain pytest structure
**Source:** `brain/test/test_local_ai_http.py` lines 1–80
**Apply to:** `brain/test/test_standalone.py`

Use `pytest.mark.asyncio`, `MagicMock`/`AsyncMock` from `unittest.mock`, class-per-scenario grouping. Import paths: `from noesis_brain.standalone.importer import ...`.

---

## Allowlist Modification Checklist

**Source:** `grid/src/audit/broadcast-allowlist.ts` (currently 64 entries)
**Source:** `grid/test/audit/broadcast-allowlist.test.ts` (currently asserts `toBe(64)`)

Five simultaneous updates MUST land in Plan 01 (all atomic with the new sole-producer file):

1. `grid/src/audit/broadcast-allowlist.ts` — append `'operator.nous_forked'` at position 64 (0-indexed); update header comment "exactly these 64 event types" → "65"; add sole-producer comment block for this event
2. `grid/test/audit/broadcast-allowlist.test.ts` — `expect(ALLOWLIST.size).toBe(64)` → `toBe(65)`; `expect(ALLOWLIST_MEMBERS.length).toBe(64)` → `toBe(65)`; add `expect(ALLOWLIST_MEMBERS[64]).toBe('operator.nous_forked')`
3. `scripts/check-state-doc-sync.mjs` — append `'operator.nous_forked'` to EVENT_NAMES list; bump count literal 64 → 65
4. `.planning/STATE.md` — append `operator.nous_forked` to Accumulated Context allowlist enumeration; update running total 64 → 65
5. `.planning/ROADMAP.md` — Phase 43 allowlist delta `+0` → `+1`; running total `64` → `65`

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `grid/src/api/operator/fork-token-store.ts` | service | CRUD | No existing in-memory token store; trivial Map singleton |
| `brain/src/noesis_brain/standalone/importer.py` | utility | file-I/O | No existing archive extraction in Brain codebase; pure Python stdlib |

---

## Metadata

**Analog search scope:** `grid/src/audit/`, `grid/src/api/operator/`, `grid/src/export/`, `dashboard/src/components/agency/`, `steward/src/app/system/`, `brain/src/noesis_brain/`, `brain/test/`, `grid/test/audit/`
**Files scanned:** 18 source files read directly
**Key facts confirmed from source:**
- Allowlist baseline: `expect(ALLOWLIST.size).toBe(64)` at `grid/test/audit/broadcast-allowlist.test.ts:12` — correct baseline is **64**, not 67 as CONTEXT.md D-43-04 originally claimed
- `MemoryStore(":memory:")` hardcoded at `brain/src/noesis_brain/__main__.py:250` — `BRAIN_DATA_DIR` threading is a mandatory Plan 01 prerequisite
- `self._grid_wire_client: "Any | None" = None` at `brain/src/noesis_brain/rpc/handler.py:141` — standalone mode requires no new guard wiring, only factory skipping wire init
- `tar` library is at `grid/package.json:32` — no new npm dependency needed; archive format is `.tar.gz` per D-43-02 amendment (NOT `.zip`)
- Header comment style: `satisfies ApiError` return type annotation pattern (from `export-replay.ts`)
- ROUTE_DID_POLICY for all operator write routes is `'public'` (header-trust handles auth)
**Pattern extraction date:** 2026-05-27
