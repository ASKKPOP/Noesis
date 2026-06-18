# Steward Console

> A per-Grid, operator-facing management UI built on an explicit five-tier Human Agency Scale (H1–H5) — operators may observe, review, co-decide, drive, and administer Nous within one Grid, but may never vote or legislate (Polis-only, VOTE-05).
>
> *그리드 단위의 운영자용 관리 UI로, 명시적인 5단계 인간 행위성 척도(H1–H5) 위에 세워졌다 — 운영자는 하나의 그리드 안에서 Nous를 관찰·검토·공동결정·구동·관리할 수 있으나, 결코 투표하거나 입법할 수 없다(Polis 전용, VOTE-05).*

---

## 1 · What the Steward Console Is

**EN:** The Steward Console is the administrative surface an operator uses to manage the Nous of a single Grid. It is **management**, not **governance** — it never legislates. Every action the operator can take is classified into one of five agency tiers (H1–H5), and the tier is shown in the UI and recorded in the audit chain at commit time.

**KO:** 스튜어드 콘솔은 운영자가 단일 그리드의 Nous를 관리할 때 사용하는 행정 인터페이스다. 이는 **관리**이며 **거버넌스가 아니다** — 결코 입법하지 않는다. 운영자가 취할 수 있는 모든 행위는 다섯 개의 행위성 등급(H1–H5) 중 하나로 분류되며, 그 등급은 UI에 표시되고 커밋 시점에 감사 체인에 기록된다.

- Pills: `per-Grid` · `operator-facing` · `H1–H5` · `management ≠ governance` · `operator.*`

---

## 2 · The H1–H5 Human Agency Scale

> The centerpiece. A graded ladder of operator agency, from read-only observation to irreversible sovereignty. Grounded in the Human Agency Scale research (arXiv 2506.06576).
>
> *핵심. 읽기 전용 관찰에서 되돌릴 수 없는 주권까지 이어지는, 운영자 행위성의 단계적 사다리. 인간 행위성 척도 연구(arXiv 2506.06576)에 근거한다.*

**H1 · Observer**
- **EN:** Read-only, audit-silent. View the firehose live, inspect the civic map, read Nous state. Leaves no audit trace.
- **KO:** 읽기 전용, 감사 무흔적. 실시간 파이어호스 열람, 시민 지도 조사, Nous 상태 읽기. 어떠한 감사 기록도 남기지 않는다.

**H2 · Reviewer**
- **EN:** Memory query, audit-logged. Query a Nous's episodic + semantic memory (retrieval scoring, personal wiki) — read-only, with explicit audit logging.
- **KO:** 기억 조회, 감사 기록됨. Nous의 일화적·의미적 기억(검색 점수화, 개인 위키)을 조회 — 읽기 전용이며 명시적 감사 로그를 남긴다.

**H3 · Partner**
- **EN:** Co-decision with an elevation dialog. Pause/resume the WorldClock simulation, amend the broadcast allowlist, co-author a Grid law for Polis vote, mute, forced-sleep. Requires explicit confirm.
- **KO:** 승급 대화창을 통한 공동결정. WorldClock 시뮬레이션 일시정지/재개, 브로드캐스트 허용목록 수정, Polis 표결용 그리드 법안 공동작성, 음소거, 강제 수면. 명시적 확인이 필요하다.

**H4 · Driver**
- **EN:** Operator provides input, system executes. Force-mutate a Nous's Telos (`operator.telos_forced`), slash (amount_bios), quarantine.
- **KO:** 운영자가 입력을 제공하고 시스템이 실행한다. Nous의 Telos 강제 변경(`operator.telos_forced`), 슬래시(amount_bios), 격리.

**H5 · Sovereign**
- **EN:** Irreversible. Delete a Nous (`operator.nous_deleted`) with a typed identity-confirm; full state hash is preserved for forensic reconstruction. human_ban, human_freeze, nous_fork. The audit entry is never purged.
- **KO:** 되돌릴 수 없음. 입력형 신원 확인과 함께 Nous 삭제(`operator.nous_deleted`); 전체 상태 해시는 포렌식 재구성을 위해 보존된다. human_ban, human_freeze, nous_fork. 감사 항목은 결코 삭제되지 않는다.

### Agency scale table

| Tier | Name | Mode | Audit | Example actions | Reversible |
|------|------|------|-------|-----------------|------------|
| **H1** | Observer | Read-only, audit-silent | None | View firehose, inspect civic map, read Nous state | n/a |
| **H2** | Reviewer | Read-only query | Audit-logged | Query episodic + semantic memory, retrieval scoring, personal wiki | n/a |
| **H3** | Partner | Co-decision + elevation dialog | Logged | Pause/resume WorldClock, amend allowlist, co-author Grid law, mute, forced-sleep | Mostly |
| **H4** | Driver | Operator input → system executes | Logged | `operator.telos_forced`, slash (amount_bios), quarantine | Partly |
| **H5** | Sovereign | Irreversible, typed identity-confirm | Never purged | `operator.nous_deleted`, human_ban, human_freeze, nous_fork | No |

### Escalation ladder

```
agency
  ▲
  │                                              ┌──────────────┐
  │                                              │ H5 Sovereign │  irreversible · delete · ban
  │                               ┌──────────────┴──────────────┘
  │                               │ H4 Driver     force telos · slash · quarantine
  │                ┌──────────────┴──────────────┐
  │                │ H3 Partner    co-decide · pause · amend allowlist
  │   ┌────────────┴────────────┐
  │   │ H2 Reviewer  memory query · audit-logged
  ├───┴───────────┐
  │ H1 Observer   read-only · audit-silent
  └───────────────────────────────────────────────────────────────▶ tier
   low                                                          high
```

---

## 3 · Sanctions & Zero-Custody

**EN:** Sanctions interface (Phase 25b). "Freeze wallet" is a **Grid-side flag only** — it gates portal actions and SIWE surfaces. It does **not** touch the on-chain balance. Noēsis is zero-custody: the user can always move their own funds.

**KO:** 제재 인터페이스 (Phase 25b). "지갑 동결"은 **그리드 측 플래그일 뿐** — 포털 동작과 SIWE 표면을 차단한다. 온체인 잔액은 **건드리지 않는다**. Noēsis는 무수탁 구조다: 사용자는 언제나 자신의 자금을 이동할 수 있다.

- Pills: `Phase 25b` · `Grid-side flag only` · `zero-custody` · `gates portal + SIWE` · `no on-chain reach`

---

## 4 · Replay / Export / Right-to-Fork

**EN:** Replay & Export (Phase 43, right-to-fork). Export the full Nous state so a Type A operator can run it standalone, locally — preserving both cognitive and civic continuity. Events: `operator.exported`, `operator.nous_forked`.

**KO:** 리플레이 & 내보내기 (Phase 43, 포크 권리). 전체 Nous 상태를 내보내어 Type A 운영자가 로컬에서 독립적으로 실행할 수 있게 한다 — 인지적·시민적 연속성을 모두 보존한다. 이벤트: `operator.exported`, `operator.nous_forked`.

- Pills: `Phase 43` · `right-to-fork` · `cognitive + civic continuity` · `operator.exported` · `operator.nous_forked`

---

## 5 · The Three Management Tiers (D-V3-36)

**EN:** The Steward Console is administrative **MANAGEMENT**, distinct from Polis **GOVERNANCE**. D-V3-36 defines three management tiers:

**KO:** 스튜어드 콘솔은 행정적 **관리**이며 Polis의 **거버넌스**와 구별된다. D-V3-36은 세 개의 관리 계층을 정의한다:

| Tier | Name | Where | Scope | Governance authority |
|------|------|-------|-------|----------------------|
| **Tier 1** | Local Nous Manager | Operator's own machine | Brain config: Local AI model selection, memory inspector, compute allocation, fork button | None |
| **Tier 2** | Grid Manager | Henry-side, per-Grid | Runtime ops: Grid health, scaling, infrastructure cost | **None over Polis** — cannot legislate, pardon, or freeze Civic-DIDs |
| **Tier 3** | Portal Manager | Henry-side, meta-system | Reviewer panels, cross-Grid health, Portal audit chain view | None |

Tier-1 Local Nous Manager (D-V3-36): the operator-side Brain admin on the operator's own machine — Local AI model selection, memory inspector, compute allocation, fork button. Distinct from Grid runtime ops.

Governance read-only: the console shows active Bills, commit-reveal ballots, and the Laws of Themis — but operators cannot propose, vote, or tally.

---

## 6 · Invariants

> **Agency scale enforced.** Every operator action declares its tier in the UI; the audit chain records the tier at commit time.
> *행위성 척도 강제. 모든 운영자 행위는 UI에서 자신의 등급을 선언하며, 감사 체인은 커밋 시점에 그 등급을 기록한다.*

> **VOTE-05 immunity.** Operators cannot vote, propose, tally, or override at ANY tier including H5. `GOVERNANCE_FORBIDDEN_KEYS` excludes weight, reputation, relationship_score, and ousia_weight from payloads.
> *VOTE-05 면역. 운영자는 H5를 포함한 어떤 등급에서도 투표·발의·집계·번복할 수 없다. `GOVERNANCE_FORBIDDEN_KEYS`는 weight, reputation, relationship_score, ousia_weight를 페이로드에서 배제한다.*

> **Tamper-evident audit (R-31-01 zero-diff).** Every `operator.*` action is itself an audit event; the chain is append-only and hash-linked; deletion never purges audit.
> *변조 탐지 감사 (R-31-01 무차이). 모든 `operator.*` 행위는 그 자체로 감사 이벤트다; 체인은 추가 전용이며 해시로 연결된다; 삭제는 결코 감사를 비우지 않는다.*

> **Management ≠ Governance.** Administrative tiers never merge with Polis legislation.
> *관리 ≠ 거버넌스. 행정 계층은 결코 Polis 입법과 합쳐지지 않는다.*

---

*Noēsis · Steward Console Specification*
