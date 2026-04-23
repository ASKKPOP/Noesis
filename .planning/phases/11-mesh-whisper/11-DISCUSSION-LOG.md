# Phase 11 Discussion Log (`--auto` mode)

**Date:** 2026-04-23
**Mode:** `--auto` — all gray areas auto-resolved with recommended defaults, no user prompts.

## Context inputs loaded

- `.planning/ROADMAP.md` §Phase 11 (Mesh Whisper goal, requirements, success criteria, threats, allowlist addition)
- `.planning/REQUIREMENTS.md` WHISPER-01..06
- `.planning/STATE.md` Accumulated Context (21-event allowlist enumeration, Phase 10b ship decisions, carry-forward invariants)
- `.planning/PHILOSOPHY.md` §1 (hash-only cross-boundary), §6 (economy must be free), §7 (copy-verbatim), and the body/mood separation sealed in 10b
- `.planning/phases/10b-*/10b-CONTEXT.md` (bios lifecycle, keyring seeding precedent, 3-tier grep gates, zero-diff discipline)
- `.planning/phases/10a-*/10a-CONTEXT.md` (per-Nous seeding SHA256(DID)[:32] pattern, dashboard mirror protocol)
- `.planning/phases/09-*/09-CONTEXT.md` (D-9-05 sole-producer, D-9-12 wall-clock grep ban patterns cloned forward)
- `grid/src/audit/broadcast-allowlist.ts` (authoritative 21-entry state)
- `grid/package.json` (confirmed `@fastify/rate-limit` already installed; `libsodium-wrappers` and PyNaCl are new)

## Gray areas identified

1. Allowlist growth shape (payload tuple, position, sole-producer file)
2. libsodium binding choice (JS side) + Python side
3. Keypair generation trigger, seed source, determinism
4. Keyring storage location (Brain vs Grid; in-memory vs disk)
5. Ciphertext storage (Grid MySQL vs in-memory + TTL)
6. Envelope shape / wire metadata / action-type contract
7. Recipient-pull mechanism (poll endpoint shape, ack semantics, duplicate delivery)
8. Rate-limit implementation (tick-indexed vs seconds; queue behavior; metric endpoint)
9. Three-tier plaintext CI gate scope (file trees + forbidden-keys set + runtime monkey-patch)
10. Privacy matrix size + structure (≥10 required; chose 16)
11. Producer-boundary grep gate structure (clone Phase 10b pattern)
12. DialogueAggregator extension (new channel vs new event type)
13. `telos.refined` provenance from whispered dialogue (new field vs reuse `triggered_by_dialogue_id`)
14. Determinism & zero-diff regression test shape
15. T-10-06 whisper-as-trade bypass defense depth
16. UI surface at H1+ tiers (what to render; explicit H5 exclusion)
17. Dashboard protocol mirror — fourth use and consolidation decision
18. Tombstone-respect gate (inherit Phase 10b D-10b-04)
19. Out-of-scope list (forward secrecy, sealed-sender, H5 whisper-read, group chat)

All 19 areas auto-resolved to D-11-01 … D-11-18 in `11-CONTEXT.md`. See that file for the authoritative decisions and rationale.

## Rationale shortlist (brief — full reasoning in CONTEXT)

- **Cryptographic primitive:** `libsodium-wrappers` chosen over `sodium-native` for universal Node/browser/WASM coverage (Phase 14 researcher rigs and any future Dashboard test fixture reuse the same package). PyNaCl on Python side is byte-for-byte compatible.
- **Key seeding:** SHA256(DID)[:32] seed → `crypto_box_seed_keypair` gives deterministic replay — mirrors Phase 10a AnankeRuntime per-Nous seeding exactly.
- **Storage:** Ciphertext in Grid in-memory Map, deleted on ack. Audit chain keeps hash forever (first-life). No MySQL persistence of ciphertext — reduces T-10-01 surface area and matches "recipient-pull then delete" requirement literally.
- **Rate-limit:** Tick-indexed as primary (zero-wall-clock invariant); `@fastify/rate-limit` seconds-based only as DDoS belt-and-suspenders. Queue-length metric endpoint (counts-only) satisfies "observable via operator-side metric" without new allowlist pressure.
- **DialogueAggregator extension:** Reuse existing aggregator with a new `channel='whisper'` axis — no new event type, no new allowlist member, hash-only ingestion preserves Phase 6/7 cross-boundary discipline.
- **UI:** Read-only counts panel only. H5 whisper-inspect RPC is an anti-feature this phase — even a visible-disabled button would leak signal value (T-10-03), so it does not ship.
- **Consolidation of protocol mirrors:** Fourth mirror triggers "future consolidation into `@noesis/protocol-types`" note per Phase 10a prior decision, but consolidation is OUT of scope for Phase 11 — ship the fourth mirror with strict SYNC discipline, log the refactor as deferred.

## Next action

`/gsd-plan-phase 11 --auto`
