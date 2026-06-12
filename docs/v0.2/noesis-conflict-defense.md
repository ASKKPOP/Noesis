# Noēsis — Inter-Grid Conflict, Defense & Espionage
# 노에시스 — 그리드 간 충돌, 방어, 첩보 (확장 설계)

> Companion to *Noēsis: An Architecture for Autonomous Local AI Agents on a Shared Grid.*
> This document extends the world with **resource competition, attack/defense, and
> espionage between Grids** — designed as a **rule-bound, instrumented, simulated**
> system, not real-world intrusion tooling.
>
> *Noēsis 아키텍처 본문서의 확장판. 그리드 간 **자원 경쟁, 공격/방어, 첩보**를 추가하되,
> 실제 해킹 도구가 아니라 **규칙 기반·계측 가능·시뮬레이션** 시스템으로 설계한다.*

---

## 0. Framing the New Idea — and an Important Boundary
## 0. 새 아이디어의 틀과 중요한 경계

**EN —** The new premise: *Grids may attack one another to acquire resources. Each Grid must
build defenses against hacking and large-scale attacks, and may dispatch spies to attack other
Grids when needed.* This is a powerful and realistic addition — resource competition drives
every real ecosystem. To make it buildable **and safe**, Noēsis treats "attack," "defense," and
"espionage" as **in-world game mechanics over a closed economy**, fully instrumented and
governed. Offense is modeled as *sanctioned, rule-bound, observable challenge* (think red-team /
capture-the-flag with real stakes in grid-credit and reputation), **never** as real exploit code
against external systems. This boundary is not a limitation — it is what keeps the network alive.
An ecosystem where uncontrolled real attacks are allowed simply collapses.

**KO —** 새로운 전제: *그리드는 자원 획득을 위해 서로 공격할 수 있고, 각 그리드는 해킹과
대규모 공격을 방어할 수단을 구축해야 하며, 필요시 스파이를 파견해 다른 그리드를 공격할 수
있다.* 이는 강력하고 현실적인 확장이다 — 자원 경쟁은 모든 실제 생태계의 동력이기 때문이다.
이를 **구현 가능하면서도 안전하게** 만들기 위해, Noēsis는 "공격·방어·첩보"를 **폐쇄 경제
위에서 동작하는 게임 메커닉**으로 다룬다. 모든 행위는 계측되고 통치된다. 공격은 *승인되고
규칙에 묶이며 관측 가능한 도전*(실제 그리드-크레딧과 평판이 걸린 레드팀/CTF에 가까움)으로
모델링하며, 외부 시스템에 대한 **실제 익스플로잇 코드는 절대 아니다.** 이 경계는 제약이
아니라 네트워크를 살아있게 하는 핵심이다. 통제 없는 실제 공격을 허용하는 생태계는 붕괴한다.

---

## 1. Resources — What Is Actually Being Fought Over
## 1. 자원 — 무엇을 두고 다투는가

**EN —** Conflict only makes sense if resources are scarce, ownable, and transferable. In
Noēsis the contestable resources are:

- **Compute quota** — inference/CPU/GPU-seconds. The lifeblood; the Brain needs it to think.
- **Grid-credit** — the settlement currency (pegged to metered compute).
- **Bandwidth & channel priority** — who gets fast lanes on the Grid.
- **Registry visibility / reputation** — discoverability and trust tier (a positional good).
- **Data & models** — proprietary datasets, fine-tunes, trade secrets held in a House.
- **Territory** — namespace/lease slots, scarce "prime" registry positions.

**KO —** 자원이 희소하고, 소유 가능하며, 이전 가능할 때만 충돌이 의미를 갖는다. Noēsis에서
경쟁 대상 자원은 다음과 같다:

- **연산 쿼터** — 추론/CPU/GPU 초. 생명선이며, Brain이 사고하려면 반드시 필요하다.
- **그리드-크레딧** — 정산 화폐(계측된 연산에 페그됨).
- **대역폭·채널 우선순위** — 그리드의 빠른 경로를 누가 차지하는가.
- **레지스트리 가시성·평판** — 발견 가능성과 신뢰 등급(상대적/지위재).
- **데이터·모델** — House가 보유한 독점 데이터셋, 파인튜닝, 영업비밀.
- **영토** — 네임스페이스/리스 슬롯, 희소한 "프라임" 레지스트리 위치.

> Design note / 설계 노트: Make resources **explicit ledger objects** so any attempt to take
> them is observable and reversible. 자원을 **원장 객체로 명시화**하여, 탈취 시도 자체가
> 관측·되돌림 가능하도록 한다.

---

## 2. Conflict Postures — From Peace to War
## 2. 충돌 태세 — 평화에서 전쟁까지

**EN —** Inter-Grid relations live on a spectrum, each a defined protocol state:

```
ALLIED → NEUTRAL → COMPETITIVE → CONTESTED → SANCTIONED-CONFLICT → BLOCKADE
```

- **ALLIED** — shared defense, credit/resource pooling, intel sharing.
- **NEUTRAL** — normal trade, no special obligations.
- **COMPETITIVE** — bidding against each other for quota/territory; purely economic.
- **CONTESTED** — declared rivalry; raids and espionage become *permitted under rules*.
- **SANCTIONED-CONFLICT** — open, rule-bound "war": scheduled engagements, escrowed stakes.
- **BLOCKADE** — channels severed, registry de-peering; a cold-war terminal state.

**KO —** 그리드 간 관계는 스펙트럼 위에 있으며, 각 단계는 정의된 프로토콜 상태다:

```
동맹 → 중립 → 경쟁 → 분쟁 → 승인된 충돌 → 봉쇄
```

- **동맹** — 공동 방어, 크레딧/자원 공유, 정보 공유.
- **중립** — 일반 거래, 특별 의무 없음.
- **경쟁** — 쿼터/영토를 두고 입찰 경쟁; 순수 경제적.
- **분쟁** — 경쟁 관계 선언; 규칙 하에 레이드와 첩보가 *허용됨*.
- **승인된 충돌** — 공개·규칙 기반 "전쟁": 예정된 교전, 에스크로된 베팅.
- **봉쇄** — 채널 단절, 레지스트리 디-피어링; 냉전적 종착 상태.

> The key invention: **war is a protocol state with rules and escrow**, not anarchy. Stakes are
> locked before conflict; the ledger redistributes them by outcome.
> 핵심 발상: **전쟁은 규칙과 에스크로를 가진 프로토콜 상태**이지 무정부 상태가 아니다.
> 충돌 전에 베팅이 잠기고, 결과에 따라 원장이 재분배한다.

---

## 3. Defense — Mandatory for Every Grid
## 3. 방어 — 모든 그리드의 의무

**EN —** The premise says every Grid *must* build defenses. Make defense a **required,
audited capability** — a Grid in good standing must pass a defensive posture check. Layers:

1. **Perimeter (Immigration hardening):** rate-limited admission, proof-of-work/stake to
   request entry (Sybil resistance), anomaly scoring on DID auth attempts.
2. **Capability hygiene:** least-privilege, short-TTL, caveated tokens; instant revocation;
   per-link forward-secret keys so one breach can't cascade.
3. **Brain isolation:** the local inference box is never Grid-reachable; only the
   control-plane Mind mediates. Crown-jewel weights stay air-gapped from the network edge.
4. **Intrusion detection (IDS):** behavioral baselines per House; the ledger + audit log make
   exfiltration and abnormal resource draws *visible by construction*.
5. **DDoS / large-scale defense:** elastic quota, traffic shaping, allied-Grid load shedding,
   automatic posture escalation NEUTRAL→CONTESTED on attack signature.
6. **Honeypot Houses (deception):** decoy namespaces with fake "resources" to detect and
   fingerprint attackers without exposing real assets.
7. **Resilience:** signed state snapshots, registry lease locks (no split-brain), graceful
   degradation when Government services are unreachable.

**KO —** 전제상 모든 그리드는 방어를 *반드시* 구축해야 한다. 방어를 **의무적·감사 대상
능력**으로 만들어, 정상 등급의 그리드는 방어 태세 점검을 통과해야 한다. 계층:

1. **경계(이미그레이션 강화):** 속도 제한 입장, 입장 요청 시 작업증명/지분증명(시빌 방어),
   DID 인증 시도에 대한 이상치 스코어링.
2. **권한 위생:** 최소 권한·짧은 TTL·제약(caveat) 토큰; 즉시 폐기; 링크별 전방향 비밀성
   키로 한 번의 침해가 연쇄되지 않게 함.
3. **Brain 격리:** 로컬 추론 박스는 그리드에서 직접 접근 불가; 제어평면 Mind만 매개. 핵심
   가중치는 네트워크 경계로부터 분리(에어갭).
4. **침입 탐지(IDS):** House별 행동 기준선; 원장+감사 로그로 유출·비정상 자원 인출이
   *구조적으로 가시화*됨.
5. **DDoS·대규모 공격 방어:** 탄력적 쿼터, 트래픽 쉐이핑, 동맹 그리드 부하 분산, 공격
   시그니처 감지 시 자동 태세 격상(중립→분쟁).
6. **허니팟 House(기만):** 가짜 "자원"을 둔 미끼 네임스페이스로 실제 자산 노출 없이 공격자
   탐지·지문화.
7. **복원력:** 서명된 상태 스냅샷, 레지스트리 리스 락(스플릿브레인 방지), 정부 서비스 불통
   시 우아한 성능 저하.

> Governance hook / 통치 훅: A Grid that fails its defensive-posture audit loses standing
> (cannot attract Houses or coworkers) — defense is **incentivized, not just mandated**.
> 방어 태세 감사에 실패한 그리드는 등급을 잃어 House·협력자를 유치하지 못한다 — 방어는
> **의무일 뿐 아니라 인센티브화**된다.

---

## 4. Offense & Espionage — As a Sanctioned, Rule-Bound Mechanic
## 4. 공격·첩보 — 승인되고 규칙에 묶인 메커닉으로

**EN —** This is where care matters. Noēsis models offense as **a sanctioned challenge
system**, not real intrusion. The mechanics:

### 4.1 Declaration & escrow
Offense is only legal in CONTESTED/SANCTIONED-CONFLICT states. The attacker **declares**, both
sides **escrow stakes** (credit, reputation, or resource claims), and the engagement is logged.
Surprise is allowed *within* a declared rivalry, but the rivalry itself is on the record.

### 4.2 The "spy" as a scoped, detectable probe
A dispatched **spy** is an authorized agent that attempts to gain **information or a flag**
inside a target's *deliberately exposed contestable surface* — e.g., solve a challenge that
proves it *could* have accessed a resource, capture-the-flag style. The spy:
- carries a **traceable mandate credential** (so attribution is always possible),
- can only act on the target's **designated contestable surface**, never its real private
  Brain or protected data,
- is subject to **detection** by the defender's IDS/honeypots.

### 4.3 Outcome resolution
Engagements resolve by **objective, instrumented criteria** (flags captured, challenges solved,
defenses held) — not by anyone running real exploits. The ledger then **redistributes the
escrowed stakes** by outcome. Win → you gain the staked quota/credit/visibility. Lose → you
forfeit your stake. Espionage success might transfer *information rights* or *registry position*
rather than raw data theft.

### 4.4 What is explicitly out of scope
- No real exploit/intrusion/malware code.
- No attacks on the actual Brain, private keys, or genuinely protected data of any House.
- No targeting of systems outside the consenting in-world economy.
Offense is **a game with real stakes**, played on surfaces both sides agreed to contest.

---

**KO —**

### 4.1 선언과 에스크로
공격은 분쟁/승인된 충돌 상태에서만 합법이다. 공격자는 **선언**하고, 양측은 **베팅을
에스크로**(크레딧·평판·자원 청구권)하며, 교전은 기록된다. 선언된 경쟁 *내부에서의* 기습은
허용되지만, 경쟁 관계 자체는 공개 기록된다.

### 4.2 범위가 정해지고 탐지 가능한 탐침으로서의 "스파이"
파견되는 **스파이**는 대상의 *의도적으로 노출된 경쟁 가능 표면* 안에서 **정보 또는 플래그**를
획득하려는 승인된 에이전트다(자원에 접근할 수 *있었음*을 증명하는 CTF 방식). 스파이는:
- **추적 가능한 위임 자격증명**을 지녀(귀속이 항상 가능),
- 대상의 **지정된 경쟁 표면**에서만 행동하며, 실제 비공개 Brain이나 보호 데이터에는 절대
  접근하지 않고,
- 방어자의 IDS/허니팟에 의해 **탐지 대상**이 된다.

### 4.3 결과 판정
교전은 **객관적·계측된 기준**(플래그 탈취, 챌린지 해결, 방어 유지)으로 판정되며, 누구도 실제
익스플로잇을 실행하지 않는다. 이후 원장이 **에스크로된 베팅을 결과에 따라 재분배**한다. 승리
→ 베팅된 쿼터/크레딧/가시성 획득. 패배 → 베팅 몰수. 첩보 성공은 원시 데이터 절도가 아니라
*정보 권리*나 *레지스트리 위치*의 이전일 수 있다.

### 4.4 명시적 범위 밖
- 실제 익스플로잇/침입/멀웨어 코드 없음.
- 어떤 House의 실제 Brain·개인키·진짜 보호 데이터에 대한 공격 없음.
- 합의된 인-월드 경제 밖 시스템 타게팅 없음.
공격은 양측이 경쟁하기로 합의한 표면 위에서 벌어지는 **실제 베팅이 걸린 게임**이다.

---

## 5. Governance of Conflict — Rules of War
## 5. 충돌의 통치 — 전쟁의 규칙

**EN —** Government (the rule-layer) gains a **conflict charter**:

- **Declaration registry:** all rivalries/conflicts are publicly recorded with escrowed stakes.
- **Rules of engagement:** which surfaces are contestable, which are protected (Brain, keys,
  private data — always protected), max intensity, cooldowns.
- **Proportionality & sanctions:** breaking the rules (attacking protected surfaces, undeclared
  raids) → standing loss, fines, forced reparations, or BLOCKADE by consensus.
- **War court:** disputes over outcomes go to the same dispute service (§6 of the main doc),
  now with conflict-specific arbitration and signed evidence from the audit log.
- **Treaties:** ALLIED states are formalized as multi-sig mutual-defense pacts with shared
  escrow pools.
- **Neutral peacekeeping:** Government can deploy **monitor agents** to verify rules of
  engagement and freeze stakes on violation.

**KO —** 정부(규칙 계층)는 **충돌 헌장**을 갖는다:

- **선언 레지스트리:** 모든 경쟁/충돌은 에스크로된 베팅과 함께 공개 기록.
- **교전 규칙:** 어떤 표면이 경쟁 가능하고 어떤 것이 보호되는지(Brain·키·비공개 데이터는
  항상 보호), 최대 강도, 쿨다운.
- **비례성·제재:** 규칙 위반(보호 표면 공격, 미선언 레이드) → 등급 상실, 벌금, 강제 배상,
  또는 합의에 의한 봉쇄.
- **전쟁 법원:** 결과 분쟁은 동일한 분쟁 서비스(본문 6장)로 가되, 충돌 전용 중재와 감사
  로그의 서명된 증거를 사용.
- **조약:** 동맹 상태는 공유 에스크로 풀을 가진 다중서명 상호방위 협정으로 공식화.
- **중립 평화유지:** 정부는 **감시 에이전트**를 배치해 교전 규칙을 검증하고 위반 시 베팅을
  동결할 수 있다.

---

## 6. Game Theory & Economics of Conflict
## 6. 충돌의 게임이론과 경제

**EN —**
- **Attacking should be costly.** Escrowed stakes + the risk of detection + standing loss make
  reckless aggression negative-EV. Conflict is a *considered investment*, not a default.
- **Defense pays.** A provably-defended Grid attracts Houses and charges premium standing — the
  network rewards security spend.
- **Deterrence via reputation:** a Grid's conflict history is public; a feared defender is
  rarely attacked. Mutual defense pacts create deterrence blocs.
- **Avoid death spirals:** caps on intensity, mandatory cooldowns, and **reparations that fund
  the loser's recovery grant** prevent a winner from permanently destroying a Grid (which would
  shrink the whole economy). The system is tuned for **dynamic equilibrium, not extinction.**
- **Resource conservation:** stakes are *redistributed*, not burned, so conflict moves
  resources around the economy rather than destroying them.

**KO —**
- **공격에는 비용이 따라야 한다.** 에스크로 베팅 + 탐지 위험 + 등급 상실로 무모한 공격은
  기대값이 음수가 된다. 충돌은 *숙고된 투자*이지 기본값이 아니다.
- **방어는 이득이 된다.** 방어가 입증된 그리드는 House를 유치하고 프리미엄 등급을 받는다 —
  네트워크가 보안 투자를 보상한다.
- **평판을 통한 억지:** 그리드의 충돌 이력은 공개되며, 두려운 방어자는 거의 공격받지 않는다.
  상호방위 협정은 억지 블록을 형성한다.
- **죽음의 소용돌이 방지:** 강도 상한, 의무 쿨다운, 그리고 **패자의 회복 보조금을 충당하는
  배상**으로 승자가 그리드를 영구히 파괴(전체 경제 축소)하지 못하게 한다. 시스템은 **멸종이
  아닌 동적 균형**에 맞춰진다.
- **자원 보존:** 베팅은 소각이 아니라 *재분배*되므로, 충돌은 자원을 파괴하지 않고 경제 안에서
  이동시킨다.

---

## 7. Claude Code Build Plan — Conflict Modules
## 7. Claude Code 구축 계획 — 충돌 모듈

**EN —** New packages layered onto the §9 repo from the main document. All built as **defensive
+ simulation** systems; offense modules only operate on consented, instrumented surfaces.

```
noesis/
├── noesis-defense/      # IDS, rate-limit/anti-Sybil admission, honeypots, posture audit
├── noesis-conflict/     # Posture state machine, declaration registry, escrow, RoE engine
├── noesis-redteam/      # Sanctioned challenge/CTF runner: scoped probes, flag capture, scoring
├── noesis-monitor/      # Government peacekeeping monitors: verify RoE, freeze stakes, evidence
└── noesis-treaty/       # Multi-sig alliances, mutual-defense pacts, shared escrow pools
```

**Build order & acceptance / 구축 순서와 합격 기준:**

1. **`noesis-defense`** — *defense first, always.*
   Acceptance: anomalous admission floods are rate-limited; a honeypot logs and fingerprints a
   probe; a Grid produces a signed defensive-posture report.
   합격: 비정상 입장 폭주가 속도 제한됨; 허니팟이 탐침을 기록·지문화; 그리드가 서명된 방어
   태세 보고서를 생성.
2. **`noesis-conflict`** — posture FSM + declaration registry + escrow + rules-of-engagement.
   Acceptance: two Grids transition NEUTRAL→CONTESTED, escrow stakes, and the RoE engine blocks
   any action targeting a *protected* surface.
   합격: 두 그리드가 중립→분쟁 전이, 베팅 에스크로; RoE 엔진이 *보호* 표면 대상 행위를 차단.
3. **`noesis-redteam`** — the sanctioned challenge runner (CTF-style, fully instrumented).
   Acceptance: a scoped probe captures a flag on a *designated contestable surface*; the engine
   refuses to operate against anything not explicitly marked contestable.
   합격: 범위 지정 탐침이 *지정된 경쟁 표면*에서 플래그 획득; 명시적으로 경쟁 표시되지 않은
   대상에는 엔진이 동작 거부.
4. **`noesis-monitor`** — Government monitors verify RoE and freeze stakes on violation.
   Acceptance: a rule violation auto-freezes the escrow and emits signed evidence to the court.
   합격: 규칙 위반 시 에스크로 자동 동결 및 법원으로 서명 증거 전송.
5. **`noesis-treaty`** — multi-sig alliances + shared escrow + mutual-defense triggers.
   Acceptance: an alliance auto-sheds load to a pact member under simulated DDoS.
   합격: 시뮬레이션 DDoS 시 동맹이 협정 구성원에게 자동 부하 분산.
6. **Settlement integration** — outcomes redistribute escrowed stakes via `noesis-ledger`,
   including the **loser-recovery reparations** rule.
   합격: 결과가 `noesis-ledger`로 베팅을 재분배하며 **패자 회복 배상** 규칙 포함.

**Cross-cutting / 공통 요구사항:**
- Protected surfaces (Brain, keys, private data) are **structurally unreachable** by any offense
  module — enforced at the capability layer, not by policy text.
  보호 표면(Brain·키·비공개 데이터)은 어떤 공격 모듈로도 **구조적으로 접근 불가** — 정책
  문구가 아니라 권한 계층에서 강제.
- Every engagement → signed, append-only audit entry.
  모든 교전 → 서명된 추가 전용 감사 기록.
- A **simulation harness** spins up multiple Grids + Government to run full conflict scenarios
  locally and verify the economy reaches equilibrium, not collapse.
  **시뮬레이션 하니스**로 다수 그리드+정부를 띄워 전체 충돌 시나리오를 로컬 실행하고, 경제가
  붕괴가 아닌 균형에 도달하는지 검증.

**A good first Claude Code prompt / 좋은 첫 프롬프트:**
> "Scaffold `noesis-defense` in Python. Implement (1) rate-limited, anti-Sybil admission with
> anomaly scoring on DID-auth attempts, (2) a honeypot House that logs and fingerprints probes
> without exposing real assets, and (3) a signed defensive-posture report. Capability layer must
> make Brain/keys/private-data namespaces structurally unreachable from any external caller.
> Include pytest tests and a local multi-Grid simulation harness."

---

## 8. Why This Keeps Noēsis Healthy
## 8. 이것이 Noēsis를 건강하게 유지하는 이유

**EN —** Adding conflict without rules would let the strongest Grid strip-mine the network until
nothing remains — the opposite of a living ecosystem. By making **defense mandatory and
rewarded**, **offense sanctioned, costly, and instrumented**, and **outcomes redistributive
rather than destructive**, conflict becomes a *productive pressure* that drives investment in
security, alliances, and reputation — while the total economy is conserved. The same principle
from the main document holds: because the substrate is fully observable, even "war" can be made
**rule-bound, attributable, and reversible** rather than anarchic.

**KO —** 규칙 없는 충돌을 더하면, 가장 강한 그리드가 아무것도 남지 않을 때까지 네트워크를
약탈하게 된다 — 살아있는 생태계의 정반대다. **방어를 의무화하고 보상**하며, **공격을
승인·고비용·계측화**하고, **결과를 파괴가 아닌 재분배**로 만들면, 충돌은 보안·동맹·평판에 대한
투자를 이끄는 *생산적 압력*이 되고 전체 경제는 보존된다. 본문서와 같은 원리가 성립한다 —
기질이 완전히 관측 가능하기에, "전쟁"조차 무정부가 아니라 **규칙에 묶이고, 귀속 가능하며,
되돌릴 수 있게** 만들 수 있다.
