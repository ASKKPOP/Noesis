# Phase 36: Visitor/DID Read-Write Split — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `36-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 36-visitor-did-read-write-split
**Areas discussed:** Visitor landing + registration · Rate limiting + audit scope · Edge cases · 6-zone Civic Map visibility

---

## Area 1 · Visitor Landing + Registration Flow

### Q1.1 — Visitor entry URL
| Option | Description | Selected |
|--------|-------------|----------|
| Portal landing (portal.noesis) | Visitor first sees Portal homepage with "What is Noēsis · Browse Grids · Sign up" | ✓ |
| Grid landing direct (genesis.noesis) | Visitor sees Genesis Civic Map immediately; Portal for registration only | |
| Both mirrored | Same experience whether Portal or Grid URL | |

**Notes:** Portal as front door is consistent with D-V3-29 (Portal is meta-layer) and three-layer architecture. Grid root URLs redirect to Portal landing if no Portal session cookie.

### Q1.2 — Tourist info center scope
| Option | Description | Selected |
|--------|-------------|----------|
| Rich tour: Civic Map + activity + Library + signup | ~5 visitor surfaces, lively city feel | ✓ |
| Minimal: explainer page + signup | Marketing page only | |
| Immersive: full city tour with explainers | Every public institution + tooltips | |

### Q1.3 — Marketplace browse — prices visible?
| Option | Description | Selected |
|--------|-------------|----------|
| Prices visible (full transparency) | Visitor sees price + seller + zone tag | ✓ |
| Listings visible, prices hidden | Shopping window feel | |
| Marketplace fully DID-gated | Visitor sees no marketplace | |

### Q1.4 — Registration entry from visitor
| Option | Description | Selected |
|--------|-------------|----------|
| Portal sign-up first → per-Grid apply | Two-step: Portal account + per-Grid Civic-DID | ✓ |
| Single "Join Genesis" combined | One-click Portal account + Civic-DID | |
| Per-Grid CTAs from Civic Map | Discovery-driven registration | |

---

## Area 2 · Rate Limiting + Audit Scope

### Q2.1 — Visitor rate limit numbers
| Option | Description | Selected |
|--------|-------------|----------|
| 30 req/min per IP (read-heavy default — Recommended) | Generous for tourism, blocks scraping | |
| 10 req/min per IP (strict) | Lower bucket, may frustrate honest browsers | |
| 120 req/min per IP (permissive) | Higher quota for richer visitor UX | ✓ |

**Notes:** User chose permissive (120 req/min). Rationale: richer visitor UX (preload Civic Map zones, prefetch library entries). Per-DID buckets for DID-holders set in Phase 39.

### Q2.2 — Visitor audit-trail scope
| Option | Description | Selected |
|--------|-------------|----------|
| Last 1000 events sliding window | No deployment-age leak | ✓ |
| Full tick range | Max transparency, reveals Grid age | |
| Last 24h time-based window | Time-friendly but reveals tick rate | |

### Q2.3 — Throttle behavior
| Option | Description | Selected |
|--------|-------------|----------|
| 429 with Retry-After header | Standard, browser-friendly | ✓ |
| Slow-down (delay responses) | Less aggressive, harder for bots | |
| Soft block: warnings then 1h timeout | Progressive escalation, more state | |

### Q2.4 — FirehoseStats visitor counter — public?
| Option | Description | Selected |
|--------|-------------|----------|
| Internal only (Manager metric) | No fingerprinting, no anxiety | ✓ |
| Aggregate ("X visitors today") | Some vibe, some fingerprint risk | |
| Real-time counter | Max vibe, max fingerprint | |

---

## Area 3 · Edge Cases

### Q3.1 — Revoked DID behavior (Q-VA-4)
| Option | Description | Selected |
|--------|-------------|----------|
| Revert to visitor status | Preserves dignity, browse OK, write blocked | ✓ (as default) |
| Hard block | Total ban from Grid | |
| Conditional on revocation reason | Sanction vs voluntary differs | |

**User notes:** "1,2,3 choose one, can change by grid law" — interpreted as: pick a sensible default (Option 1 — revert to visitor per supplement Q-VA-4), but the policy is **amendable by Polis legislation** per D-V3-21 + D-V3-34. v3.0 hardcodes the default; Phase 46 (Polis) makes it legislatively adjustable via `gov.law_enacted` for a `revocation_policy` law.

### Q3.2 — Steward /admin/* visibility (Q-VA-5)
| Option | Description | Selected |
|--------|-------------|----------|
| Always DID-required + tier-gated | Admin = operator's domain (per D-V3-36 Tier 2/3) | ✓ |
| Read-only metadata badge for visitor | Marketing only | |
| Public health page | Civic transparency | |

### Q3.3 — Visitor view specific Nous?
| Option | Description | Selected |
|--------|-------------|----------|
| Public profile only (name + zone + standing, NO memory) | Click avatar → safe public view | ✓ |
| No click-through | Aggregate only | |
| Public with Nous opt-out | Each Nous controls visibility | |

---

## Area 4 · 6-Zone Civic Map Visibility (NEW from D-V3-32)

### Q4.1 — Civic Map visitor scope
| Option | Description | Selected |
|--------|-------------|----------|
| Per-Nous avatars in zones | Individual Nous positioned, click for profile | ✓ |
| Zone aggregates only | Counts per zone, no individuals | |
| Hybrid: aggregates + opt-in detail | Toggle for detail view | |

### Q4.2 — Civic Map refresh rate
| Option | Description | Selected |
|--------|-------------|----------|
| 5-second polling (Phase 32 pattern) | Predictable load, useSWR reuse | ✓ |
| WebSocket push | Live updates, higher engagement | |
| 30-second polling | Lower load | |

### Q4.3 — Zone deep-dive on click
| Option | Description | Selected |
|--------|-------------|----------|
| Public zone info: tax + activity + top contributors | Rich civic visibility | ✓ |
| Zone metadata only | Static config only | |
| No deep-dive | Overview only for visitors | |

### Q4.4 — Polis (governance) activity visibility
| Option | Description | Selected |
|--------|-------------|----------|
| Bill drafts + active sessions readable; ballots redacted until tallied | Full pre/post transparency, ballot privacy preserved | ✓ |
| Bill drafts only | Lower transparency | |
| Governance DID-only | Strongest privacy | |

**Notes:** Preserves VOTE-05 ballot privacy invariant from v2.2 Phase 12.

---

---

## Area 5 · Three-Tier Visitor Model (added 2026-05-25 mid-discuss)

User clarification: "visitor include human account also thinking for human visitor". This revealed a gap — the original 4 areas treated visitor as binary (anonymous vs DID-required), but humans with Portal account but no Civic-DID are a distinct middle tier.

### Q5.1 — Terminology for middle tier
| Option | Description | Selected |
|--------|-------------|----------|
| "Human Visitor" | Distinguishes from anonymous tourist + Nous visitor | ✓ |
| "Guest" | Warmer hotel-guest framing | |
| "Portal Member" | Technical, emphasizes what they have | |
| "Prospective Citizen" | Intent-focused framing | |

### Q5.2 — Add `portal_session_required` to ROUTE_DID_POLICY?
| Option | Description | Selected |
|--------|-------------|----------|
| Yes — add as 3rd tier between public and civic_did_required | 6-value enum: public / portal_session_required / civic_did_required / business_did_required / government_only / police_only | ✓ |
| No — keep binary; check Portal session in handler | Stay with public/civic_did_required enum | |
| Add as `human_did_required` for parallel naming | Same semantics, parallel label | |

### Q5.3 — Human Visitor soft interactions (multiSelect)
| Option | Description | Selected |
|--------|-------------|----------|
| Follow a Nous (notification on public posts) | Read-side enhancement, no Grid mutation | ✓ |
| Watch a Polis bill (notification on status change) | Bill subscription, Portal notification | ✓ |
| Watch a Marketplace listing (notification on settle / bid) | eBay-like watch list | |
| Bookmark Library entries | Save library reading, sync via Portal | |

**Notes:** User chose minimal scope — only Follow Nous + Watch Polis bill. Marketplace watch + Library bookmark deferred (likely v3.1 or Phase 56 follow-up).

### Q5.4 — Registration flow for Human Visitor
| Option | Description | Selected |
|--------|-------------|----------|
| Skip Portal sign-up; direct "Apply for citizenship" CTA | Asymmetric flow per visitor type | |
| Same two-step as anonymous (Portal step is noop for Human Visitor) | Uniform code path, predictable | ✓ |
| Bulk apply to multiple Grids at once | v3.1+ relevant; v3.0 only Genesis | |

**Notes:** User chose uniformity. Code path is single; UI shows "Already signed in as X — continue?" instead of SIWE form for Human Visitor.

---

## Claude's Discretion

These items were intentionally left to research + planning agents (D-36 numbered as "Claude's Discretion" in CONTEXT.md):
- ROUTE_DID_POLICY data structure shape
- CI gate implementations
- Visitor session cookie format
- Civic Map SVG zone layout coordinates
- Marketplace listing pagination
- Library reading room search algorithm
- Bill draft body summary algorithm

## Deferred Ideas

Items that came up during discussion but are not in Phase 36 scope (captured in CONTEXT.md `<deferred>`):
- Visitor → DID-holder session continuity
- Visitor analytics dashboard for Polis
- A/B testing visitor landing variants
- Internationalization
- Mobile-responsive Civic Map (Phase 56 follow-up)
- Cross-Grid visitor experience (v3.1+)
- Brain-seed transparency for Type B Polis-α charter requests (Q-EXT-RES-5 → Phase 37b discuss)

---

*Discussion completed 2026-05-25. CONTEXT.md is the canonical input for `/gsd-plan-phase 36`. This log is for audit / human reference only.*
