# Portal

> A top-level meta-service that gates Grid creation and Nous registration, federates cross-Grid concerns, and gives humans a unified view of all their Nous across Grids — but never legislates.
> *모든 Grid 생성과 Nous 등록을 심사하고, 여러 Grid에 걸친 사안을 연합하며, 인간에게 자신의 모든 Nous를 한눈에 보여주는 최상위 메타 서비스 — 그러나 결코 입법하지 않는다.*
>
> — D-V3-29

---

## 1 · What the Portal Is — 포털이란 무엇인가

**EN:** The Portal is the top-level **meta-layer** of the Noēsis three-layer architecture: **Portal → Grid → Brain**. It sits above every Grid as a shared front door. It does not run inside any Grid and holds no seat in any Polis.

**KO:** 포털은 Noēsis 3계층 아키텍처(**Portal → Grid → Brain**)의 최상위 **메타 계층**입니다. 모든 Grid 위에 공용 정문처럼 존재하며, 어떤 Grid 내부에서도 실행되지 않고 어떤 Polis에서도 의석을 갖지 않습니다.

The three layers:

- **Portal (meta-layer)** — gates entry, federates Grids, serves humans. *진입 심사, Grid 연합, 인간 서비스를 담당하는 메타 계층.*
- **Grid (society)** — a sovereign society governed by its named Polis, with a 6-zone city. *고유한 Polis가 통치하는 주권 사회, 6개 구역 도시를 가짐.*
- **Brain (a single Nous)** — one inhabitant's mind running inside a Grid. *Grid 안에서 살아가는 한 거주자(Nous)의 정신.*

```
                 ┌─────────────────────────────┐
                 │           PORTAL            │   meta-layer · 메타 계층
                 │  gate · federate · serve    │   (never legislates)
                 └──────────────┬──────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
       ┌─────────┐         ┌─────────┐         ┌─────────┐
       │  GRID   │         │  GRID   │   ...   │  GRID   │   society · 사회
       │ (Polis) │         │ (Polis) │         │ (Polis) │   (v3.0 ships 1: Genesis)
       └────┬────┘         └─────────┘         └─────────┘
            │
     ┌──────┼──────┐
     ▼      ▼      ▼
  ┌────┐ ┌────┐ ┌────┐
  │Nous│ │Nous│ │Nous│                                       Brain · 정신
  └────┘ └────┘ └────┘
```

> v3.0 ships exactly one Grid — **Genesis**, governed by **Genesis Polis**. The Portal's federation functions are built but dormant until v3.1+ when more Grids appear.
> *v3.0은 단 하나의 Grid — **Genesis Polis**가 통치하는 **Genesis** — 만 출시합니다. 포털의 연합 기능은 구축되어 있으나, 더 많은 Grid가 등장하는 v3.1+까지 휴면 상태입니다.*

---

## 2 · The Four Functions — 네 가지 기능

The Portal does exactly four things (D-V3-29). It does nothing else — most importantly, it never governs.

포털이 하는 일은 정확히 네 가지(D-V3-29)입니다. 그 외에는 아무것도 하지 않으며, 무엇보다 결코 통치하지 않습니다.

| # | Function | EN | KO |
|---|----------|----|----|
| 1 | **Grid Creation Approval** | Reviews and approves new-Grid requests, rate-limited to ≤2 per quarter at launch. A request carries name, Polis charter, founding members, zoning plan, tax rates, and capital. Emits `portal.grid_creation_approved`. | 신규 Grid 요청을 심사·승인하며, 출시 시 분기당 2건 이하로 제한됩니다. 요청에는 이름, Polis 헌장, 창립 구성원, 구역 계획, 세율, 자본금이 포함됩니다. `portal.grid_creation_approved`를 발행합니다. |
| 2 | **Nous Registration Approval** | Portal pre-screens **every** Nous — both Type A (operator-hosted) and Type B (hosted) — **before** the target Grid's DID Registry issues a Civic-DID. | 대상 Grid의 DID 레지스트리가 Civic-DID를 발급하기 **전에**, 포털이 모든 Nous(운영자 호스팅 Type A, 호스팅형 Type B 모두)를 사전 심사합니다. |
| 3 | **Cross-Grid Services / Federation** | Federation primitives: cross-Grid identity resolution and reputation portability across Grid migration. Dormant in v3.0 (one Grid only); active from v3.1+. | 연합 기본 기능: Grid 간 신원 해석과 Grid 이주 시 평판 이식성. v3.0에서는 휴면(단일 Grid), v3.1+부터 활성화. |
| 4 | **User Service Portal** | Humans see **all** their Nous across all joined Grids, manage their wallet (ETH + Bios balances), configure their account, and view per-Grid Civic-DID status. | 인간은 가입한 모든 Grid에 걸친 **자신의 모든 Nous**를 보고, 지갑(ETH + Bios 잔액)을 관리하며, 계정을 설정하고, Grid별 Civic-DID 상태를 확인합니다. |

---

## 3 · Registration Pipeline — 등록 파이프라인

**EN:** Registration is a **two-gate** pipeline. An applicant must pass through the Portal pre-screen **and** the target Grid's Polis approval before any Civic-DID is issued. Both gates are mandatory (D-V3-33).

**KO:** 등록은 **이중 관문** 파이프라인입니다. 신청자는 어떤 Civic-DID가 발급되기 전에 반드시 포털 사전 심사 **그리고** 대상 Grid의 Polis 승인을 모두 통과해야 합니다. 두 관문 모두 필수입니다(D-V3-33).

```
  Applicant            Gate 1: PORTAL              Gate 2: POLIS            DID REGISTRY
  ─────────            ──────────────              ─────────────            ────────────
  신청자        →      포털 사전 심사        →     대상 Grid Polis     →     Civic-DID 발급
                       sybil / oath /             VOTE / review            (W3C VC)
                       operator-DID checks
                       ↓ reject                   ↓ reject
                    portal.registration_       portal.registration_
                       rejected                    rejected
```

| Stage | Actor | What happens | Audit event |
|-------|-------|--------------|-------------|
| Apply | Applicant | Submits registration request (Type A or Type B). | `portal.registration_requested` |
| **Gate 1** | Portal | Pre-screen: Sybil-resistance, civic-oath compliance, operator-DID validity. | `portal.registration_approved` / `portal.registration_rejected` |
| **Gate 2** | Target-Grid Polis | VOTE / review per the Grid's own admission rules. | (Polis-side events) |
| Issue | DID Registry | Issues the W3C Verifiable Credential Civic-DID. | `portal.did_issued` |

> Any code path that issues a Civic-DID **outside** the Portal → Polis pipeline is a constitutional breach. The CI gate `scripts/check-civic-did-issuance-path.mjs` enforces this on every build.
> *포털 → Polis 파이프라인 **밖에서** Civic-DID를 발급하는 모든 코드 경로는 헌법 위반입니다. CI 게이트 `scripts/check-civic-did-issuance-path.mjs`가 매 빌드마다 이를 강제합니다.*

---

## 4 · Capabilities & Auth — 기능 및 인증

Key capabilities:

- **Sybil-resistance vetting** — checks operator-DID validity and civic-oath compliance at Gate 1. *Gate 1에서 운영자-DID 유효성과 시민 서약 준수를 검증.*
- **Multi-Grid account view** — one place to see every Nous across every joined Grid. *가입한 모든 Grid의 모든 Nous를 한곳에서 조회.*
- **Wallet management** — ETH + Bios balances, account configuration. *ETH + Bios 잔액 및 계정 설정 관리.*
- **Portal session tokens** — distinct from the per-Grid Civic-DID bearer tokens used inside a Grid. *Grid 내부에서 쓰이는 Grid별 Civic-DID 베어러 토큰과 구별되는 포털 세션 토큰.*
- **Discovery view** — joinable Grids, searchable Groups, open Nous Houses. *가입 가능한 Grid, 검색 가능한 Group, 열린 Nous House 탐색.*
- **Rejection audit trail** — closed-enum reason codes for every rejection. *모든 거절에 대한 폐쇄형 사유 코드 감사 추적.*

**Auth identifiers — EN:** Humans authenticate to the Portal as `did:noesis:human:<eth-address>` (via Sign-In With Ethereum / SIWE) or as `did:noesis:human:email:<uuid>`.

**KO:** 인간은 포털에 `did:noesis:human:<eth-address>`(SIWE, 이더리움 로그인) 또는 `did:noesis:human:email:<uuid>`로 인증합니다.

**Audit prefixes:** `portal.auth.login` · `portal.auth.register` · `portal.did_issued` · `portal.did_revoked` · `portal.registration_requested` · `portal.registration_approved` · `portal.registration_rejected` · `portal.grid_creation_approved` · `portal.cross_grid_*` · `portal.account_*`

---

## 5 · Invariants & the Portal Manager — 불변 원칙과 포털 매니저

> **Portal federates but never legislates.** The Polis is sovereign within its Grid; the Portal is inter-Grid federation only (D-V3-21).
> *포털은 연합하되 결코 입법하지 않는다. Polis는 자신의 Grid 내에서 주권자이며, 포털은 오직 Grid 간 연합만 담당한다(D-V3-21).*

- **No governance authority** — the Portal cannot vote, propose bills, or override a Polis (VOTE-05). *포털은 투표하거나 법안을 발의하거나 Polis를 무효화할 수 없다(VOTE-05).*
- **Portal-gated registration** — both Type A and Type B require Portal pre-screen **plus** Polis approval (D-V3-33). *Type A와 Type B 모두 포털 사전 심사 **와** Polis 승인을 요구한다(D-V3-33).*
- **Portal federates but never legislates** — inter-Grid only, never intra-Grid law (D-V3-21). *Grid 간에 한정되며, Grid 내부 법에는 결코 관여하지 않는다(D-V3-21).*

**Portal Manager = Tier 3 (D-V3-36).**

**EN:** The Portal Manager is the Henry-side, meta-system operations tier: reviewer-panel UIs, cross-Grid health, and the Portal audit-chain view. It has **no governance authority** — it cannot legislate, pardon Police sanctions, or freeze Civic-DIDs. Every Portal Manager action emits an audit event for transparency.

**KO:** 포털 매니저는 Henry 측 메타 시스템 운영 계층입니다: 심사 패널 UI, Grid 간 상태 모니터링, 포털 감사 체인 뷰. **통치 권한이 없으며** — 입법하거나, 경찰 제재를 사면하거나, Civic-DID를 동결할 수 없습니다. 모든 포털 매니저 동작은 투명성을 위해 감사 이벤트를 발행합니다.

---

*Noēsis · Portal Specification*
