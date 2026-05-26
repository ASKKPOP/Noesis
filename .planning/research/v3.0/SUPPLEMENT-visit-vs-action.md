# Supplement · Visit-vs-Action Read/Write Asymmetry

**Status:** Supplements `CIVIC-ARCHITECTURE.md` §3 + §5
**Origin:** User clarification 2026-05-25 — *"any action need DID, without DID only visit"*
**Visit-tier choice:** Tiered (most things public, sensitive details require DID)
**Bilingual context:** Korean: 외국인 관광객(no-DID 방문자) → 등록증 보유자(DID 보유 행위자) → 시민(DID + 시민권)

---

## Why This Supplement Exists

The main research doc treats DID-issuance as one of several identity-model questions (W3C VC vs DID:plc vs SSI). The user's clarification reframes the question: **DID is not about existence — it's about action permission.** Without a DID, you may VISIT a Grid (read public surfaces); with a DID, you may ACT (mutate state).

This is a one-axis read/write asymmetry, which is much simpler to enforce than per-Grid registration tiers. It elegantly resolves the sovereignty tension that §2 of the main doc flagged.

---

## 1 · The model in one paragraph

**Every state-mutating endpoint on the Grid requires a valid DID-signed request. Every read endpoint is permissive by default but redacts sensitive fields when the requester does not present a DID.** A visitor — human or Nous — can land on any Grid, observe the world, watch the firehose, browse the public Nous gallery, and read summary statistics, all without registering anywhere. To do anything (trade, whisper, vote, spawn, found a Grid, refine a Telos), they must present a DID — issued by any Portal they trust, or self-issued (did:key / did:web) for sovereign Grids that accept self-credentialed actors.

This is **read/write asymmetry**, not access tiers. The split is uniform across all endpoints, which makes it easy to enforce + cheap to reason about.

---

## 2 · Per-endpoint matrix (Tiered visitor model)

Based on the user-selected "Tiered (most things public, sensitive details require DID)" option. The principle: **summaries are public, payloads are gated**.

### Read endpoints

| Endpoint | No-DID visitor | DID holder | Why this split |
|---|---|---|---|
| `GET /health` | ✓ full | ✓ full | Docker SLA — must be public for healthcheck |
| `GET /health/detailed` | ✓ full | ✓ full | Operational transparency; already redacts secrets |
| `GET /api/v1/audit/trail?summary=true` | ✓ counts by family + tick range | ✓ full payloads | Visitor sees "300 nous.* events in last hour, 12 trade.settled, 5 governance.tallied" but not individual actor DIDs or contents |
| `GET /api/v1/audit/trail` (full) | ❌ 401 `did_required_for_full_trail` | ✓ full | Full audit reveals relationship graphs — privacy gate |
| `GET /api/v1/audit/firehose` (WS) | ✓ event types + tick only, actor DIDs **stripped to family prefix** (`nous.*` instead of `did:noesis:nous:sophia`) | ✓ full with actor DIDs | Visitor sees the *rhythm* of the Grid, not the identities — like watching traffic from a window |
| `GET /humans` (directory listing) | ✓ public profile cards (DID hash prefix, region, joined-week) | ✓ full directory | Tourist-info-center view; no individual page deep-links |
| `GET /humans/[did]` (individual profile) | ❌ 401 `did_required_for_individual_profile` | ✓ full | Per-human privacy gate (PHILOSOPHY §3 dignity) |
| `GET /nous` (Nous roster) | ✓ public — names, regions, Telos hashes only | ✓ full — includes peer-relationship counts | Genesis Nous are public figures |
| `GET /nous/[did]/state` | ✓ public surface (current region, Telos hash, last-active tick) | ✓ full (relationship edges, top-K skill hashes) | Public-figure-data vs deeper inspection |
| `GET /governance/proposals` | ✓ open proposals (title hash, deadline, vote count) | ✓ full incl. tallies, ballot reveals | Civic transparency for active proposals; full record for participants |
| `GET /api/v1/grid/lore` | ✓ entry titles + contributor DID hash prefix | ✓ full incl. content_hash + citation_count | Cultural surface — visitor sees the catalog, not the deep cross-references |
| `GET /api/v1/grid/norms` | ✓ crystallized norm fingerprints + adoption count | ✓ full incl. evidence chain | Crystallized norms ARE public by design — they're collective rules |
| `GET /api/v1/grid/culture/skills/lineage` | ✓ aggregate diffusion graph (count of taught/inferred per family) | ✓ full lineage tree with named edges | Aggregate vs per-edge identity reveal |
| `GET /api/v1/audit/drift-alerts` | ✓ public (already operator transparency) | ✓ full | No identity exposure here |
| `GET /system` (Steward) | Steward routes are operator UI, no visitor access — separate gate (tier headers) |||
| `GET /portal/*` | ✓ public marketing surfaces | ✓ portal home + chat once logged in | Portal acts as both signup funnel + post-login UI |
| `GET /firehose` (Steward UI page) | Steward = operator; not for visitors |||

### Write endpoints — uniformly DID-required

Every endpoint below returns `401 did_required` for visitors:

| Endpoint | Purpose |
|---|---|
| `POST /trade` | Propose/settle Cyber Coin trade |
| `POST /whisper` | Send E2E-encrypted whisper |
| `POST /governance/propose` | Open a proposal |
| `POST /governance/commit` | Commit a ballot |
| `POST /governance/reveal` | Reveal a ballot |
| `POST /spawn` | Spawn Personal Nous (humans) |
| `POST /telos/refine` | Trigger Telos refinement |
| `POST /grid/create` | Found a new Grid (v3.0) |
| `POST /grid/invite` | Invite Nous to a Grid (v3.0) |
| `POST /grid/join` | Accept invite to a Grid (v3.0) |
| `POST /portal/auth/email/signup` | Email registration (no DID yet — this IS the DID-issuance flow) |
| `POST /portal/auth/email/signin` | Email login (no DID yet — exchanged for one on success) |
| `POST /portal/auth/siwe` | SIWE wallet sign-in (verifies wallet signature; issues DID) |
| `POST /api/v1/admin/*` | Admin actions — separate tier gate (already H4/H5) |
| Every `POST /api/v1/operator/*` | Operator actions — tier gate, but ALSO DID for accountability in audit |

**Special case:** The Portal signup/signin endpoints are the *only* writes that can be hit without a DID — because they ARE the DID-issuance flow. Once authenticated, every subsequent write attaches the issued DID.

---

## 3 · Why this elegantly resolves the §2 tensions

### Tension 1 (sovereignty) — RESOLVED

Pre-supplement framing: "Portal-issued registration ID required for Grid access" felt like Portal as gatekeeper-to-existence, conflicting with PHILOSOPHY §1.

Visit-vs-action framing:
- **Existence is permission-free.** Any Nous can spawn on any Grid (via the existing spawn-Nous mechanism). Any human can visit any Grid (open the Portal URL).
- **Action requires a credential** that the actor chose to obtain. Portal is the credential issuer, never the existence gate. A sovereign Nous in a sovereign Grid still acts — using a self-issued DID (`did:key` or `did:web` on the Grid's own host). Only Portal-approved Grids require Portal-issued DIDs for action.

Read this as: **Portal grants action-permission *credentials*, not existence licenses**. The Portal-approved jurisdiction is opt-in for the Grid (a Grid can apply for Portal-approved status) and opt-in for the Nous (a Nous can apply for a Portal-issued DID).

### Tension 2 (VOTE-05) — RESOLVED

Pre-supplement framing: "Approved by Portal" sounded like Portal-as-governor, conflicting with "governance is intra-Nous only".

Visit-vs-action framing:
- Portal *issues credentials* (technical clearinghouse role).
- Portal *recognizes Grids* (grants a "Portal-approved" status badge).
- Portal *never votes on proposals*, *never tallies ballots*, *never overrides intra-Nous decisions*.

Recognition is not governance. A Grid choosing to seek Portal recognition is exercising its sovereignty (collectively, via its citizens). Portal's role is similar to ISO certification — it grants a stamp, it doesn't run the company.

### Tension 4 (raw-SVG invariant) — UNCHANGED by this supplement

The 3D map question is orthogonal to visit-vs-action and remains as the main doc analyzed it.

### NEW: Information-privacy tension surfaced

The Tiered visitor model surfaces a privacy question: **how do we redact identity in the firehose stream for visitors without breaking the per-event determinism that R-31-01 zero-diff depends on?**

**Answer:** The redaction happens at the WebSocket frame *serializer*, not at the in-memory chain. The in-memory `AuditChain` is unchanged. The firehose hub has a per-connection serializer that, when the client lacks a DID, replaces `actor_did` with the family prefix and drops payload subkeys flagged as identity-revealing. The chain's head hash and listener fan-out are byte-identical — only the wire frame is redacted.

This preserves R-31-01 zero-diff (the audit chain's commit order doesn't depend on who's connected) while still enforcing the privacy tier.

---

## 4 · Implementation sketch

### Fastify route-level enforcement (uniform pattern)

Add a single helper that every mutating route uses:

```typescript
// grid/src/api/_did.ts
import type { FastifyRequest, FastifyReply } from 'fastify';

export interface DidContext {
    did: string;                   // verified DID
    issuer: 'portal' | 'self';     // who issued the credential
    portal_id?: string;            // which Portal, if applicable
}

export async function requireDid(req: FastifyRequest, reply: FastifyReply): Promise<DidContext | null> {
    // Accept either:
    //   1. JWT in Authorization: Bearer <token>  (Portal-issued)
    //   2. Verifiable Presentation in x-vp header (W3C VC)
    //   3. Sig + nonce + DID in x-did-* headers   (self-sovereign, for sovereign Grids)
    const ctx = await verifyAnyDidAuth(req);
    if (!ctx) {
        reply.code(401);
        return null;
    }
    return ctx;
}

// Reply convention on rejection — uniform shape:
//   { error: 'did_required', accepted_methods: ['portal_jwt', 'w3c_vp', 'self_sovereign'] }
```

Every write route opens with:

```typescript
app.post('/api/v1/trade', async (req, reply) => {
    const did = await requireDid(req, reply);
    if (!did) return;  // 401 already sent
    // ...trade logic, audit entry carries did.did as actor_did
});
```

### Read-route redaction (serializer pattern)

Mutating routes are simple yes/no. Read routes need conditional shapes. Add a serializer helper:

```typescript
// grid/src/api/_redact.ts
export function maybeRedact<T>(
    full: T,
    redacted: T,
    didContext: DidContext | null,
): T {
    return didContext ? full : redacted;
}

// Usage in audit-trail route:
app.get('/api/v1/audit/trail', async (req, reply) => {
    const did = await tryDid(req);  // returns DidContext | null, NEVER 401s
    const entries = await services.audit.query(req.query);
    return maybeRedact(
        entries,                              // full payload for DID holders
        entries.map(e => ({                   // redacted summary for visitors
            tick: e.tick,
            event_type: e.event_type,
            family: e.event_type.split('.')[0],
            // actor_did stripped, payload stripped
        })),
        did,
    );
});
```

### WS firehose redaction

```typescript
// grid/src/audit/firehose-hub.ts (per-connection serializer)
export interface FirehoseSubscriber {
    socket: WebSocket;
    didContext: DidContext | null;  // captured at connect time from upgrade headers
}

function serializeFrame(entry: AuditEntry, sub: FirehoseSubscriber): string {
    if (sub.didContext) {
        return JSON.stringify({ type: 'event', entry });
    }
    // Visitor frame — stripped to family + tick
    return JSON.stringify({
        type: 'event',
        entry: {
            tick: entry.tick,
            event_type: entry.event_type,
            family: entry.event_type.split('.')[0],
            // actor_did, payload, target_did all dropped
        },
    });
}
```

Per-connection cost: one extra branch + reduced payload size for visitors. Throughput-neutral compared to current full-broadcast.

### Single source of truth for "is this a mutating route?"

Don't rely on HTTP verb conventions (POST could be a query in REST quirks). Maintain an explicit table:

```typescript
// grid/src/api/_did-policy.ts
export const ROUTE_DID_POLICY = {
    // (path-pattern, method) → required tier
    'POST /api/v1/trade':                 'did_required',
    'POST /api/v1/whisper':               'did_required',
    'POST /api/v1/governance/propose':    'did_required',
    'POST /api/v1/grid/create':           'did_required',
    'GET  /api/v1/audit/trail':           'did_required_for_full',  // redacted otherwise
    'GET  /api/v1/audit/firehose':        'did_required_for_full',
    'GET  /humans/:did':                  'did_required',
    'GET  /humans':                       'visitor_public',
    'GET  /health':                       'visitor_public',
    // ...
} as const;
```

A CI gate (`scripts/check-did-policy-coverage.mjs`) walks every registered Fastify route and confirms each has an explicit entry. Mirrors the existing `check-sole-producer-discipline.mjs` pattern from Phase 33 — same project convention.

---

## 5 · Audit chain implications

### New events needed (allowlist additions, v3.0 milestone scope)

Per main doc estimate +14 events, this supplement specifies which ones are visit-vs-action-related:

| Event | Producer | Payload |
|---|---|---|
| `portal.did_issued` | grid/src/audit/append-portal-did-issued.ts | `{human_or_nous_did, issuer_portal_id, issued_at_tick}` |
| `portal.did_revoked` | grid/src/audit/append-portal-did-revoked.ts | `{human_or_nous_did, issuer_portal_id, revoked_at_tick, reason_hash}` |
| `grid.recognition_granted` | grid/src/audit/append-grid-recognition-granted.ts | `{recognized_grid_name, issuer_portal_id, recognized_at_tick}` |
| `grid.recognition_revoked` | grid/src/audit/append-grid-recognition-revoked.ts | `{recognized_grid_name, issuer_portal_id, revoked_at_tick, reason_hash}` |
| `visitor.observed` | (NOT audit-chain event — too noisy; metrics-only via Phase 32 firehose counters extension) | n/a |

`visitor.observed` deliberately does NOT enter the audit chain. Tracking every visitor read would balloon the chain by 100-1000× and violate first-life-promise-vs-retention-cost. Instead, extend the Phase 32 `FirehoseStats` with `visitor_count_active` (current open WS connections without DID), exposed via `/health/detailed`.

### Self-issued DIDs in audit

Self-issued DIDs (`did:key:*` or `did:web:*` for sovereign Grids) appear in audit chain entries as actor_did. They MUST satisfy the existing DID regex (`/^did:noesis:[a-z0-9_\-]+$/i`). Proposal: extend the regex to accept `did:key:*` and `did:web:*` formats, OR wrap self-issued DIDs in a Noēsis-namespaced container (`did:noesis:sovereign:<key-fingerprint>`).

The latter (Noēsis-wrapped) is cleaner because:
- Existing 3 entry-point regex checks don't need to change
- Audit chain identifiers stay opaque to the v2.x reader code
- The `sovereign` prefix is its own jurisdiction tag (alongside `human`, `human:email`, `nous`)

---

## 6 · Migration impact on the main doc's §8 phase plan

Main doc §8 estimated 13 phases for v3.0. This supplement adds two narrowly-scoped phases that should go FIRST:

| Phase | Title | What it does | Why first |
|---|---|---|---|
| **Phase 36** (was: Multi-Grid Foundation) | Visitor / DID Read-Write Split | Add `requireDid` helper + `maybeRedact` shaper + `ROUTE_DID_POLICY` table + CI gate. Apply to existing v2.6 routes (audit trail, firehose, humans/[did]) — all become visitor-readable in redacted form. No new Grids yet. | Unblocks everything downstream — once the read/write asymmetry is the API contract, multi-Grid and Portal recognition can be added without re-litigating per-endpoint privacy decisions. |
| **Phase 37** (was: Multi-Grid Foundation, now: Issuer/Self-Sovereign DIDs) | DID Issuance + Verification | Add `portal.did_issued` + `portal.did_revoked` events. Implement DID JWT verifier (Portal-issued) + W3C VP verifier + self-sovereign signature verifier. Per-Portal config of trusted issuers. | DID issuance is independent of multi-Grid — can be tested in single-Grid first. |

Phases 38-48 stay roughly as the main doc described, but renumber down by 2 (so the original Phase 38 becomes Phase 40, etc.).

Net delta to milestone estimate:
- Phase count: 13 → 15 (+2)
- Plan count: ~70 → ~80 (+10)
- Allowlist additions: 14 → 18 (+4 — the 4 new events above)
- Critical path length: 8 phases → 10 phases

---

## 7 · D-V3-* decision proposals (additions to main doc §7)

These extend the 10 proposals in the main doc with visit-vs-action specifics:

**D-V3-11 (Read-write asymmetry):** Every Grid endpoint is classified in `ROUTE_DID_POLICY` as one of `visitor_public`, `did_required_for_full` (redacted otherwise), or `did_required` (no visitor access). Default-deny: any route not in the table is treated as `did_required`. CI gate `scripts/check-did-policy-coverage.mjs` enforces complete coverage.

**D-V3-12 (Visitor firehose redaction):** WebSocket firehose serializes frames per-subscriber. Visitor subscribers receive `{tick, event_type, family}` only — `actor_did`, `target_did`, and `payload` are dropped at the serializer. R-31-01 zero-diff invariant unaffected (chain commit order is independent of subscriber set).

**D-V3-13 (Visitor metrics, not chain events):** Visitor activity is tracked via Phase 32 `FirehoseStats` (extend with `visitor_count_active`), NOT via audit chain events. Adding per-visit audit entries would inflate the chain by orders of magnitude and conflict with the first-life-promise retention math.

**D-V3-14 (Self-sovereign DID wrapping):** Self-issued DIDs (for sovereign Grids that don't recognize any Portal) are wrapped in the existing Noēsis namespace as `did:noesis:sovereign:<key-fingerprint>`. The 3 existing DID-regex checks don't change. Sovereign Grids can opt-in to a per-Grid signature scheme (Ed25519 default).

**D-V3-15 (Portal signup is the only no-DID write):** `POST /portal/auth/*` endpoints are the only writes that succeed without a pre-existing DID — because they ARE the DID-issuance flow. Every other write requires a verified DID context. CI gate verifies this exception list stays at exactly 3 endpoints (siwe + email/signup + email/signin).

---

## 8 · Open questions added to main doc §10

Main doc has 8 open questions for `/gsd-discuss-phase`. This supplement adds 5 more specific to visit-vs-action:

- **Q-VA-1:** What's the minimum information a visitor needs to make an informed decision about whether to register? (Affects the public-tier scope and the "tourist info center" page design.)
- **Q-VA-2:** Do visitors get rate-limited differently than DID-holders? (Suggest yes — visitors share a per-IP bucket; DID holders get per-DID buckets.)
- **Q-VA-3:** Does the public-tier audit-trail-summary expose tick range (which reveals Grid age/activity volume) or just the last 1000 events? (Trade-off: transparency vs. fingerprinting.)
- **Q-VA-4:** When a DID is revoked (`portal.did_revoked`), does the holder revert to visitor status or get hard-blocked? (Suggest: revert to visitor — preserves dignity, no kicking off the platform.)
- **Q-VA-5:** Is the Steward `/admin/*` panel ever visitor-readable, or always DID-required + tier-gated? (Suggest: never visitor — admin surface IS the operator's domain.)

---

## 9 · Cross-references back to main doc

This supplement amends:

- **§3 (Identity Model)** — see new sub-section *"3.5 · Visit-vs-Action Permission Axis"* (added in this commit). The visit-vs-action axis is orthogonal to the issuer-model axis (Portal vs self-sovereign). Both axes coexist: a visitor has no DID; a DID-holder's DID was issued by Portal OR self.
- **§5 (Civic Analogy)** — the analogy refines: **Estonian e-Residency** is the right precedent because Estonia allows non-residents to e-Reside without becoming citizens — exactly the visitor → DID-holder → citizen continuum this supplement formalizes.
- **§7 (Decision Proposals)** — adds D-V3-11 through D-V3-15 (this section 7 above).
- **§8 (Migration Plan)** — adds 2 phases at the front (visitor split + DID issuance), pushes all others back.
- **§10 (Open Questions)** — adds Q-VA-1 through Q-VA-5.

---

## 10 · Summary one-paragraph for non-technical reviewers

A visitor — human or Nous — can walk into any Noēsis Grid and look around freely. They see the city rhythm (firehose), the public Nous gallery, summary statistics, open governance proposals, the cultural commons catalog. They do not see individual human profiles, full audit payloads, or anyone's whispers. To do anything in the world — trade, talk, vote, found a Grid — they need a DID. DIDs are issued by Portals (the Estonian e-Residency model) or self-issued for sovereign Grids that accept self-credentialed actors. Portal is a credential issuer, never a governor. Recognition is a status, not an approval. Existence requires no permission; action requires identity. The audit chain records actions, not visits, and stays sovereign-Grid-portable.

---

*Supplement author: Claude (orchestrator inline) · 2026-05-25*
*Main doc: `CIVIC-ARCHITECTURE.md` (commit `25cc1de`)*
*Status: ready for `/gsd-discuss-phase` along with main doc's 8 open questions + this supplement's 5 Q-VA-* questions*
