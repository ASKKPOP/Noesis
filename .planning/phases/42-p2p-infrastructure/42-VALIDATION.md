---
phase: 42
slug: p2p-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | vitest (Grid / TypeScript) + pytest (Brain / Python) |
| **Grid config** | `grid/vitest.config.ts` |
| **Brain config** | `brain/pyproject.toml` — `testpaths = ["test"]` |
| **Grid quick run** | `cd grid && npm test` |
| **Brain quick run** | `cd brain && uv run pytest test/ -x -q` |
| **Grid full suite** | `cd grid && npm test -- --reporter=verbose` |
| **Brain full suite** | `cd brain && uv run pytest test/ -v` |
| **Estimated runtime** | ~30s (Grid) + ~20s (Brain) |

---

## Sampling Rate

- **After every task commit:** Run the suite for the repo that was changed (Grid or Brain)
- **After every plan wave:** Run both Grid and Brain full suites
- **Before `/gsd-verify-work`:** Both suites must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 42-W0-01 | Wave 0 | 0 | P2P-05 | T-42-01 | Audit sole-producers enforce closed-tuple | unit | `cd grid && npm test -- test/p2p/` | ❌ W0 | ⬜ pending |
| 42-01-01 | 01 | 1 | P2P-01 | — | Public key stored on Civic-DID registration | unit | `cd grid && npm test -- test/registry/` | ❌ W0 | ⬜ pending |
| 42-01-02 | 01 | 1 | P2P-03 | T-42-03 | TURN credentials require Civic-DID auth | unit | `cd grid && npm test -- test/p2p/turn-credentials.test.ts` | ❌ W0 | ⬜ pending |
| 42-02-01 | 02 | 1 | P2P-02 | T-42-02 | Grid relays SDP blob opaque (cannot read content) | unit | `cd grid && npm test -- test/p2p/signal.test.ts` | ❌ W0 | ⬜ pending |
| 42-02-02 | 02 | 1 | P2P-06 | T-42-04 | p2p.signal_received NOT in allowlist | unit | `cd grid && npm test -- test/audit/` | ❌ W0 | ⬜ pending |
| 42-03-01 | 03 | 2 | P2P-05 | T-42-01 | 3 sole-producer files enforce triad | unit | `cd grid && npm test -- test/p2p/sole-producers.test.ts` | ❌ W0 | ⬜ pending |
| 42-03-02 | 03 | 2 | P2P-05 | — | Allowlist count goes exactly 64 → 67 | unit | `cd grid && npm test -- test/audit/allowlist.test.ts` | ❌ W0 | ⬜ pending |
| 42-04-01 | 04 | 2 | P2P-04 | — | BrainP2PClient generates SDP offer via aiortc | unit | `cd brain && uv run pytest test/wire/test_p2p.py -v` | ❌ W0 | ⬜ pending |
| 42-04-02 | 04 | 2 | P2P-04 | T-42-05 | SDP encrypted with peer Ed25519→X25519 key | unit | `cd brain && uv run pytest test/wire/test_p2p_crypto.py -v` | ❌ W0 | ⬜ pending |
| 42-05-01 | 05 | 3 | P2P-04 | — | 1000 messages produce 0 Grid audit entries | integration | `cd brain && uv run pytest test/wire/test_p2p_direct.py -v` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `grid/test/p2p/` directory — stub test files for P2P routes and sole-producers
- [ ] `grid/test/p2p/announce.test.ts` — stubs for POST /p2p/announce, GET /p2p/peers/:did
- [ ] `grid/test/p2p/signal.test.ts` — stubs for POST /p2p/signal/:peerDid, GET /p2p/signal/inbox
- [ ] `grid/test/p2p/turn-credentials.test.ts` — stubs for GET /p2p/turn-credentials
- [ ] `grid/test/p2p/sole-producers.test.ts` — stubs for 3 sole-producer audit events
- [ ] `brain/test/wire/test_p2p.py` — stub for BrainP2PClient
- [ ] `brain/test/wire/test_p2p_crypto.py` — stub for SDP encryption/decryption

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| STUN responds to public binding request | P2P-03 | Requires live coturn + AWS networking | `docker compose up coturn && stunclient stun://localhost:3478` |
| TURN relay issues short-lived credentials | P2P-03 | Requires coturn HMAC-SHA1 + live network | `curl -H "Authorization: Bearer <civic-did-token>" localhost:3000/api/v1/p2p/turn-credentials` |
| Two Brains establish direct WebRTC data channel | P2P-04 | Requires two live Brain processes | Manual: run two Brain instances, initiate P2P from one to the other |
| 1000 direct messages produce 0 Grid audit entries | P2P-04 | Requires live WebRTC connection | Manual after establishing data channel |
| coturn DEV: STUN-only (no TURN) on macOS Docker | P2P-03 | UDP port range (49152-65535) impractical on macOS Docker Desktop | Skip TURN in dev; test TURN on AWS only |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
