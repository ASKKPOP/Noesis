# Phase 42: P2P Infrastructure — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 42-p2p-infrastructure
**Areas discussed:** Protocol Stack, STUN/TURN Infrastructure, Brain-side P2P Scope, Signaling Content Model

---

## Protocol Stack (Q-V3-A)

| Option | Description | Selected |
|--------|-------------|----------|
| WebRTC + SDP signaling | Grid is a pure SDP relay; Brain gets aiortc; STUN/TURN fits naturally into WebRTC ICE spec. | ✓ |
| libp2p (js-libp2p + py-libp2p) | More powerful P2P framework; py-libp2p less mature; DHT (main advantage) is deferred. | |
| WebRTC with libp2p-compatible API | Ship WebRTC internals but design API surface for future libp2p switch. | |

**User's choice:** WebRTC + SDP signaling (recommended default)
**Notes:** Q-V3-A now locked. CIVIC-ARCHITECTURE.md §5.1 table updated.

---

## P2P Announce Payload

| Option | Description | Selected |
|--------|-------------|----------|
| Presence only — just 'I'm online' | No endpoint field; WebRTC handles NAT traversal itself. | ✓ |
| ICE candidate hints | Include preferred STUN/TURN URLs; marginally faster connection setup. | |
| Libp2p multiaddr forward-compat field | Include null multiaddr field now for future compatibility. | |

**User's choice:** Presence only
**Notes:** `POST /api/v1/p2p/announce` is a keep-alive heartbeat only; `GET /api/v1/p2p/peers/<did>` returns status.

---

## STUN Hosting

| Option | Description | Selected |
|--------|-------------|----------|
| Self-hosted coturn on Grid server | coturn Docker container alongside Grid; owns stun://grid.noesis:3478. | |
| Use Google/Cloudflare public STUN + delay self-hosted TURN | Third-party STUN; TURN deferred. | |
| Stub STUN endpoint — validate spec, real service later | Fastest to ship; most deferred. | |
| AWS-hosted | User specified: AWS hosting for coturn. | ✓ |

**User's choice:** AWS-hosted coturn (user specified "I will be host on the AWS")
**Notes:** coturn on AWS EC2/ECS, ports UDP/3478 for STUN and TURN.

---

## TURN Fee Model

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed Bios per session | Initiating Brain pays N Bios for short-lived credentials. | |
| Per-minute or per-MB billing | Time-limited tokens with renewal; Bios micropayment loop. | |
| Stub TURN in Phase 42 — fee in Phase 45 | No payment in Phase 42; Phase 45 IRS wires deduction. | |
| Permanently free in v3.0 | TURN is free for all of v3.0; pricing is v3.1+ concern. | ✓ |

**User's choice:** Permanently free in v3.0
**Notes:** ROADMAP and REQUIREMENTS must be updated to remove "paid Bios per session" language from Phase 42 and Phase 45.

---

## TURN Auth Requirement

| Option | Description | Selected |
|--------|-------------|----------|
| Civic-DID required | Prevents anonymous abuse of AWS relay. | ✓ |
| No auth — anyone gets credentials | Simpler; short-lived TTL mitigates abuse. | |

**User's choice:** Civic-DID required
**Notes:** `GET /api/v1/p2p/turn-credentials` requires Civic-DID bearer token.

---

## Brain-side P2P Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full Brain P2P module with aiortc | New wire/p2p.py: SDP gen, ICE, data channel, send/receive. | ✓ |
| Announce + signal REST calls only | Grid endpoints only; SC4 would fail. | |
| CLI test harness only — no production Brain integration | Test harness, not integrated into tick loop. | |

**User's choice:** Full Brain P2P module with aiortc
**Notes:** Required for SC4 (1000 messages → 0 Grid audit entries).

---

## P2P Integration with Tick Loop

| Option | Description | Selected |
|--------|-------------|----------|
| Opt-in — P2P when available, Grid fallback | Brain checks peer status; uses P2P if online, else Grid messaging. | ✓ |
| Automatic — all Brain-to-Brain goes P2P | Tick loop always prefers P2P; Grid is fallback only. | |

**User's choice:** Opt-in channel
**Notes:** No new abstractions in tick loop. Fallback to Phase 41 queue or existing dialogue path.

---

## P2P Message Format

| Option | Description | Selected |
|--------|-------------|----------|
| Same BrainAction JSON as Brain→Grid | Reuses Phase 38 wire protocol serialization. | ✓ |
| Free-form JSON — per use-case schema | Each use case defines its own schema. | |
| Claude's discretion | Claude picks during planning. | |

**User's choice:** BrainAction JSON (same as Phase 38)
**Notes:** Reuses existing Brain serialization; no new message schema.

---

## SDP Encryption Model

| Option | Description | Selected |
|--------|-------------|----------|
| TLS-in-transit only | Grid decrypts to inspect metadata; simpler. | |
| End-to-end encrypted — Grid is opaque relay | Brain fetches peer public key from DID Registry VC; encrypts before handing to Grid. | ✓ |

**User's choice:** End-to-end encrypted
**Notes:** Brain A fetches Brain B's public key from Phase 37 W3C VC. Grid relays opaque blob. True content privacy.

---

## Connection ID Minting

| Option | Description | Selected |
|--------|-------------|----------|
| Grid mints UUID on SDP relay | Grid generates UUID, returns in signal response; both Brains carry it. | ✓ |
| Brain mints before signaling | Initiating Brain generates UUID in SDP payload. | |
| Claude's discretion | Implementation detail. | |

**User's choice:** Grid mints UUID on first SDP relay
**Notes:** Returned in signal response; used to correlate p2p.connection_opened and p2p.connection_closed.

---

## Signal Delivery to Recipient Brain

| Option | Description | Selected |
|--------|-------------|----------|
| WSS firehose push — p2p.signal_received | Grid pushes via Phase 38 firehose when signal arrives for recipient's Civic-DID. | ✓ |
| Brain polls signal inbox periodically | 30s polling; adds latency. | |
| Long-polling / SSE on dedicated endpoint | New connection type. | |

**User's choice:** WSS firehose push
**Notes:** NOT an audit chain event. Private notification only.

---

## Signal Targeting (per-DID delivery)

| Option | Description | Selected |
|--------|-------------|----------|
| Firehose per-DID feed (existing didContext) | Phase 38 hub already has per-subscriber didContext; deliver only to recipient. | ✓ |
| Separate private signal WebSocket per Brain | New /ws/p2p/<civic-did> connection. | |
| Claude's discretion | Keep constraint: only recipient sees signal. | |

**User's choice:** Existing firehose per-DID filtered delivery
**Notes:** Extends WsFirehoseHub without a new connection type.

---

## Claude's Discretion

- DB schema for P2P peer tracking
- TURN credential TTL
- SDP blob inbox storage approach
- ICE trickle vs complete offer/answer exchange
- aiortc version and Python dependency management
- coturn Docker Compose config and AWS networking
- Brain-side eager vs lazy public key pre-fetch

## Deferred Ideas

- TURN paid billing — v3.1+
- DHT-based decentralized P2P — already deferred by ROADMAP
- Per-operator P2P observability dashboards — already deferred by ROADMAP
- ICE trickle (streaming candidates) — planner decides
- P2P bandwidth caps (TENANT-03) — Grid Manager phase
