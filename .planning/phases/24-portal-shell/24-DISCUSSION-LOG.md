# Phase 24: Portal Shell — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 24-portal-shell
**Areas discussed:** Region presence, Profile completeness, Mobile responsiveness, Portal home polish

---

## Region Presence

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only, auto-assigned | Grid places human in Agora on first sign-in. No picker. | ✓ |
| Read-only, NULL until Phase 25 | Column added but stays NULL; region shown only after onboarding. | |
| Interactive — human picks region | Dropdown on profile; PUT endpoint; human.moved audit event. | (selected then revised) |

**User's choice:** Initially chose "Interactive", then revised to recommended "Read-only, auto-assigned"
**Notes:** human.moved event deferred — no new allowlist slot in Phase 24. Allowlist stays at 45 after human.transferred.

---

## Audit Event (Region)

| Option | Description | Selected |
|--------|-------------|----------|
| No new event — pure profile update | Region is a profile field; no allowlist slot | ✓ |
| Yes — fire human.moved event | New allowlist slot; 3-key payload {human_did, region_id, tick} | (selected then revised) |

**User's choice:** Initially "Yes — human.moved", then revised to recommended "No new event"
**Notes:** If interactive region picking is added in a later phase, human.moved can earn its allowlist slot then.

---

## Profile Completeness

| Option | Description | Selected |
|--------|-------------|----------|
| Current region | Shown as read-only row from /me endpoint | ✓ |
| Wallet balance summary | ETH + USDT summary from wagmi hooks; links to wallet page | ✓ |
| Join date | created_at from human_users returned by /me | ✓ |

**User's choice:** All three rows added
**Notes:** All from existing data sources; /me endpoint extended to return region + created_at.

---

## Region Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Profile page only | Region is a profile concept | ✓ |
| In the sidebar footer | Region chip next to wallet address | |
| In the header breadcrumb | Region in top header bar | |

**User's choice:** Profile page only (recommended)

---

## Mobile Responsiveness

| Option | Description | Selected |
|--------|-------------|----------|
| Hamburger — sidebar slides in/out | Below 768px; standard mobile nav | ✓ |
| Bottom tab bar | 5-item tab bar on mobile | |
| Defer to Phase 25 | Don't tackle mobile now | |

**User's choice:** Hamburger (recommended)

**Breakpoint:**
| Option | Selected |
|--------|----------|
| 768px (md breakpoint) | ✓ |
| 640px (sm breakpoint) | |

---

## Portal Home

| Option | Description | Selected |
|--------|-------------|----------|
| Update content + live Grid stats | Fix stale labels; active Nous count + tick from API | ✓ |
| Minimal content update only | Just fix phase numbers; no live data | |
| Redesign as live event feed | Full PORTAL-06 activity stream | |

**User's choice:** Update content + live Grid stats (recommended)

**Cross-links:**
| Option | Selected |
|--------|----------|
| Keep /worldmap and /nous cross-links | ✓ |
| Remove — portal self-contained | |

---

## Claude's Discretion

- Polling interval for live stats (10s suggested)
- Region capitalization in UI (title-case: 'Agora')
- Hamburger placement in header
- Optional "coming in Phase 25" hint on region edit

## Deferred Ideas

- human.moved audit event — deferred to when region becomes interactive
- PORTAL-06 full live event feed — deferred to Phase 25+
- Bottom tab bar mobile nav — rejected for Phase 24
- Region in header/sidebar — deferred
