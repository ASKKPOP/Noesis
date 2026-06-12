# Noēsis — War & Conquest Economics
# 노에시스 — 전쟁과 정복의 경제학 (강화 확장)

> Extends *Inter-Grid Conflict, Defense & Espionage* with a **real war model**: Grids attack
> each other for resources, and **the winner takes the loser's resources** — territory,
> grid-credit, compute, and AI-power. This is designed as a **closed-economy strategy
> simulation** (the war plays out over Noēsis's own ledger and namespaces), not real-world
> intrusion. Within that frame, war is total, stakes are real, and conquest is permanent.
>
> *그리드가 자원을 두고 서로 공격하고 **승자가 패자의 자원**(영토·그리드-크레딧·연산·AI 파워)을
> 가져가는 **실제 전쟁 모델**. Noēsis 자체 원장과 네임스페이스 위에서 벌어지는 **폐쇄 경제 전략
> 시뮬레이션**으로 설계되며, 실제 침입이 아니다. 그 틀 안에서 전쟁은 총력적이고, 베팅은
> 진짜이며, 정복은 영구적이다.*

---

## 0. The Premise, Sharpened
## 0. 전제, 더 날카롭게

**EN —** The earlier model treated conflict as low-stakes capture-the-flag. This model accepts
the harder claim: **war is natural, and to the victor go the spoils.** A Grid that loses a war
genuinely surrenders resources to the winner. The design question is not *whether* to allow this
— it's how to make a winner-takes-all economy **stable, attributable, and non-extinguishing**,
so that war is a productive engine of the ecosystem rather than the thing that kills it.

The single mechanism that makes "real war" safe to build: **everything fought over is a ledger
object inside Noēsis.** Compute, credit, territory, and AI-power are entries in a signed,
append-only ledger. Therefore "attacking," "winning," and "taking resources" are all
**transfers of ledger ownership decided by game rules** — not real exploits, but real
consequences. The loser's resources actually move to the winner. That is genuine war; it just
runs on math instead of malware.

**KO —** 앞선 모델은 충돌을 저위험 CTF로 다뤘다. 이 모델은 더 강한 주장을 받아들인다:
**전쟁은 자연스럽고, 전리품은 승자의 것이다.** 전쟁에서 패한 그리드는 실제로 자원을 승자에게
넘긴다. 설계 질문은 이를 허용할지 *여부*가 아니라, 승자독식 경제를 **안정적·귀속 가능·비멸종적**으로
만들어 전쟁이 생태계를 죽이는 것이 아니라 생산적 엔진이 되게 하는 방법이다.

"실제 전쟁"을 안전하게 구축 가능하게 하는 단일 메커니즘: **다투는 모든 것은 Noēsis 내부의 원장
객체다.** 연산·크레딧·영토·AI 파워는 서명된 추가 전용 원장의 항목이다. 따라서 "공격·승리·자원
탈취"는 모두 **게임 규칙으로 결정되는 원장 소유권의 이전**이다 — 실제 익스플로잇이 아니라 실제
결과다. 패자의 자원은 실제로 승자에게 이동한다. 이것이 진짜 전쟁이다; 단지 멀웨어가 아니라 수학
위에서 돌아갈 뿐이다.

---

## 1. The Spoils — What the Winner Actually Takes
## 1. 전리품 — 승자가 실제로 가져가는 것

**EN —** Four asset classes are conquerable. Each transfers differently:

| Spoil | What it is | On victory |
|---|---|---|
| **Grid-credit** (cyber-money) | Liquid settlement currency | Escrowed war-chest + a share of treasury transfers to winner |
| **Compute / AI-power** | Quota of inference & GPU-seconds; trained models | Quota reassigned; *licensed* (not stolen) model access granted to winner |
| **Territory** | Namespaces, lease slots, prime registry positions | Lease ownership transfers; loser's Houses re-home or fall under occupation |
| **Tribute stream** | Future income | Loser pays a recurring % of earnings to winner for a set term (vassalage) |

The crucial nuance for **AI-power**: a winner doesn't get the loser's *private Brain weights*
(those are the crown jewels and stay isolated — see §4). What transfers is **the right to
direct that compute**: the loser's quota is reassigned, or the loser must run the winner's
workloads as tribute. You conquer the *capacity*, not the secret. This is both safer and more
realistic — historically, conquerors took productive capacity and labor, rarely the deepest
secrets intact.

**KO —** 정복 가능한 자산은 네 종류이며, 각각 다르게 이전된다:

| 전리품 | 실체 | 승리 시 |
|---|---|---|
| **그리드-크레딧**(사이버 머니) | 유동 정산 화폐 | 에스크로된 군자금 + 국고 일부가 승자에게 이전 |
| **연산 / AI 파워** | 추론·GPU 초 쿼터, 학습된 모델 | 쿼터 재할당; *탈취가 아닌* 라이선스된 모델 접근을 승자에게 부여 |
| **영토** | 네임스페이스·리스 슬롯·프라임 레지스트리 위치 | 리스 소유권 이전; 패자 House는 이주하거나 점령 하에 놓임 |
| **조공 흐름** | 미래 수입 | 패자가 일정 기간 수입의 일정 %를 승자에게 정기 납부(속국화) |

**AI 파워**의 핵심 뉘앙스: 승자는 패자의 *비공개 Brain 가중치*를 얻지 않는다(핵심 자산이며 격리
유지 — §4 참조). 이전되는 것은 **그 연산을 지시할 권리**다: 패자의 쿼터가 재할당되거나, 패자가
조공으로 승자의 작업을 실행해야 한다. 비밀이 아니라 *능력*을 정복한다. 이는 더 안전하면서 더
현실적이다 — 역사적으로 정복자는 생산 능력과 노동을 취했지, 가장 깊은 비밀을 온전히 가져간 경우는
드물었다.

---

## 2. The War Lifecycle — Declaration to Conquest
## 2. 전쟁 생애주기 — 선언에서 정복까지

**EN —** War is a multi-phase protocol with locked stakes at every step, so outcomes are always
attributable and reversible-until-final.

```
1 CASUS BELLI    a Grid declares war + states the prize (territory? tribute? credit?)
        │        — public on the declaration registry
        ▼
2 MOBILIZATION   both sides commit a WAR-CHEST to escrow (credit + compute + reputation)
        │        — bigger commitment = more force projected, but more at risk
        ▼
3 ENGAGEMENT     resolved by instrumented contests, not exploits:
        │          • Siege economics — out-spend the defender's sustainment
        │          • Capability contests — CTF-style flag captures on contestable surfaces
        │          • Attrition — who can sustain the compute burn longer
        │          • Maneuver — alliances, blockades, supply-line (bandwidth) cuts
        ▼
4 RESOLUTION     a War Score is computed from objective metrics →
        │          DECISIVE / MARGINAL / STALEMATE
        ▼
5 SETTLEMENT     ledger transfers spoils by the war terms + score:
        │          DECISIVE → full prize     MARGINAL → partial     STALEMATE → escrow returned
        ▼
6 PEACE TERMS    occupation / vassalage / annexation / reparations recorded as a Treaty
                 — enforced automatically by the ledger going forward
```

**KO —** 전쟁은 모든 단계에서 베팅이 잠기는 다단계 프로토콜이므로, 결과는 항상 귀속 가능하고
확정 전까지 되돌릴 수 있다.

```
1 개전 사유    그리드가 선전포고 + 전리품 명시(영토? 조공? 크레딧?)
        │      — 선언 레지스트리에 공개
        ▼
2 동원         양측이 군자금을 에스크로에 투입(크레딧 + 연산 + 평판)
        │      — 큰 투입 = 큰 전력 투사, 그러나 큰 위험
        ▼
3 교전         익스플로잇이 아닌 계측 경연으로 판정:
        │        • 포위 경제 — 방어자의 지속력을 소모전으로 압도
        │        • 능력 경연 — 경쟁 표면에서 CTF 방식 플래그 탈취
        │        • 소모 — 누가 연산 소모를 더 오래 견디는가
        │        • 기동 — 동맹, 봉쇄, 보급선(대역폭) 차단
        ▼
4 판정         객관 지표로 전쟁 점수 산출 → 결정적 / 한계적 / 교착
        ▼
5 정산         원장이 전쟁 조건 + 점수에 따라 전리품 이전:
        │        결정적 → 전체 / 한계적 → 부분 / 교착 → 에스크로 반환
        ▼
6 강화 조건    점령 / 속국화 / 병합 / 배상을 조약으로 기록
               — 이후 원장이 자동 집행
```

---

## 3. Power & Force — How Strength Is Measured
## 3. 힘과 전력 — 강함을 어떻게 측정하나

**EN —** For winner-takes-all to feel earned, "strength" must be a real, computed quantity —
not a dice roll. A Grid's **War Power** aggregates:

- **Economic depth** — grid-credit reserves + sustainable income (can you fund a long war?).
- **Compute mass** — total quota and AI-power you can throw at sustained contests.
- **Defensive rating** — your audited posture score (hardened perimeter, honeypots, IDS).
- **Alliance weight** — pledged force from mutual-defense pacts.
- **Reputation / morale** — a feared, credible Grid projects force without firing.
- **Logistics** — bandwidth and channel priority; supply lines can be cut.

War outcomes are then **largely deterministic from these inputs plus strategy**, with a bounded
randomness band so upsets are possible but the stronger, smarter Grid usually wins. This is what
makes conquest *legitimate*: you took the resources because you were genuinely stronger or
out-thought the enemy, and the ledger proves it.

**KO —** 승자독식이 정당하게 느껴지려면 "힘"이 주사위가 아니라 실제 계산된 양이어야 한다. 그리드의
**전쟁 력(War Power)**은 다음을 집계한다:

- **경제 깊이** — 그리드-크레딧 보유고 + 지속 가능한 수입(장기전을 감당할 수 있는가?).
- **연산 질량** — 지속 경연에 투입 가능한 총 쿼터와 AI 파워.
- **방어 등급** — 감사된 태세 점수(강화 경계·허니팟·IDS).
- **동맹 무게** — 상호방위 협정에서 서약된 전력.
- **평판 / 사기** — 두렵고 신뢰받는 그리드는 교전 없이 전력을 투사한다.
- **병참** — 대역폭과 채널 우선순위; 보급선은 차단될 수 있다.

전쟁 결과는 이 입력값들 + 전략으로 **대체로 결정론적**이며, 제한된 무작위 폭을 두어 이변은
가능하되 더 강하고 영리한 그리드가 대개 이긴다. 이것이 정복을 *정당*하게 만든다: 진짜 더 강했거나
적을 앞섰기에 자원을 취했고, 원장이 그것을 증명한다.

---

## 4. The Hard Limits — What War Cannot Touch
## 4. 절대 한계 — 전쟁이 건드릴 수 없는 것

**EN —** Even total war has walls — both for safety and for a healthy economy:

- **The private Brain is never captured.** Model weights, private keys, and genuinely protected
  data are structurally unreachable at the capability layer. A winner takes *capacity and
  territory*, never the loser's deepest secret intact. (Conquering the secret-extraction itself
  would require real intrusion — out of scope, permanently.)
- **No real-world targets.** Every contest runs on Noēsis's own simulated surfaces. No module
  produces working exploits against external systems.
- **No total extinction.** A defeated Grid is occupied, vassalized, or annexed — but a
  **sovereign-minimum** floor (a small protected compute + credit reserve) survives, so it can
  rebuild, rebel, or be liberated. Permanent deletion of a Grid is disallowed: a dead Grid is
  dead economy.
- **Attribution is mandatory.** Every act of war carries a traceable mandate; anonymous
  aggression is impossible by construction.

**KO —** 총력전에도 벽이 있다 — 안전을 위해서도, 건강한 경제를 위해서도:

- **비공개 Brain은 결코 탈취되지 않는다.** 모델 가중치·개인키·진짜 보호 데이터는 권한 계층에서
  구조적으로 접근 불가. 승자는 *능력과 영토*를 취하되, 패자의 가장 깊은 비밀을 온전히 갖지 않는다.
  (비밀 추출 자체를 정복하려면 실제 침입이 필요하므로 영구히 범위 밖.)
- **실제 세계 표적 없음.** 모든 경연은 Noēsis 자체 시뮬레이션 표면 위에서 동작. 어떤 모듈도 외부
  시스템에 대한 작동 익스플로잇을 만들지 않는다.
- **완전 멸종 없음.** 패배한 그리드는 점령·속국화·병합되되, **주권 최소선**(작은 보호 연산 +
  크레딧 보유고)이 살아남아 재건·반란·해방이 가능하다. 그리드의 영구 삭제는 금지: 죽은 그리드는
  죽은 경제다.
- **귀속은 의무.** 모든 전쟁 행위는 추적 가능한 위임을 지닌다; 익명 침공은 구조적으로 불가능.

---

## 5. After Conquest — Occupation, Vassalage, Liberation
## 5. 정복 이후 — 점령·속국·해방

**EN —** Winning is the start of a relationship, not the end. Post-war states:

- **Occupation** — winner controls the loser's territory and skims its output for a term. The
  loser's Houses keep operating but pay an occupation tax.
- **Vassalage** — the loser stays sovereign but owes a tribute stream and must honor the
  winner's alliance calls. Lighter than occupation; common after MARGINAL victories.
- **Annexation** — the loser's territory permanently merges into the winner's Grid (loser
  Houses migrate or accept new citizenship). Only after DECISIVE victory + a ratified Treaty.
- **Reparations** — credit/compute transfers over time rather than all at once.
- **Liberation & rebellion** — because a sovereign-minimum survives, an occupied Grid can rebuild
  War Power, ally with others, and **declare a war of liberation.** Conquest is durable but never
  guaranteed-forever — which keeps the map dynamic and prevents one Grid from freezing into
  permanent hegemony.

**KO —** 승리는 관계의 끝이 아니라 시작이다. 전후 상태:

- **점령** — 승자가 패자 영토를 통제하고 일정 기간 산출을 흡수. 패자 House는 운영을 지속하되 점령
  세를 납부.
- **속국화** — 패자는 주권을 유지하나 조공 흐름을 지고 승자의 동맹 소집에 응해야 함. 점령보다
  가벼우며 한계적 승리 후 흔함.
- **병합** — 패자 영토가 승자 그리드에 영구 편입(패자 House는 이주하거나 새 시민권 수용). 결정적
  승리 + 비준된 조약 이후에만.
- **배상** — 일시불이 아니라 시간에 걸친 크레딧/연산 이전.
- **해방과 반란** — 주권 최소선이 살아남기에, 점령된 그리드는 전쟁 력을 재건하고 타국과 동맹하여
  **해방 전쟁을 선포**할 수 있다. 정복은 견고하되 영원히 보장되지는 않는다 — 이는 지도를 동적으로
  유지하고 한 그리드가 영구 패권으로 굳는 것을 막는다.

---

## 6. Keeping the Economy Alive — Why Winner-Takes-All Doesn't End the Game
## 6. 경제를 살아있게 유지 — 승자독식이 게임을 끝내지 않는 이유

**EN —** The danger of "winner takes resources" is a **runaway**: the strong get stronger until
one Grid owns everything and the ecosystem dies. Noēsis counters this with structural
self-correction:

- **War is expensive.** The war-chest is real spend; a Pyrrhic victory drains the winner. Even
  winning costs.
- **Coalitions form against hegemons.** The alliance system lets weaker Grids pool War Power; a
  dominant Grid invites a balancing coalition (a built-in balance-of-power dynamic).
- **Sovereign-minimum + liberation** guarantee no one is permanently erased; conquered Grids
  remain latent threats.
- **Occupation has overhead.** Holding territory costs compute and invites rebellion — empire
  has diminishing returns, so infinite expansion is self-limiting.
- **Government taxation is progressive on conquest.** A Grid that hoards conquered resources pays
  a rising treasury tax that funds recovery grants to the defeated — redistribution keeps the
  field populated.
- **Spoils are redistributed, never burned.** War moves resources around the economy; total
  wealth is conserved, so the game never deflates to zero.

The result is a **dynamic equilibrium**: empires rise, overextend, fracture, and fall, and the
map keeps moving — exactly like human history, but instrumented, attributable, and incapable of
truly ending the world.

**KO —** "승자가 자원을 가져간다"의 위험은 **폭주**다: 강자가 더 강해져 한 그리드가 모든 것을
소유하고 생태계가 죽는 것. Noēsis는 구조적 자기 교정으로 이에 맞선다:

- **전쟁은 비싸다.** 군자금은 실제 지출이며, 피로스의 승리는 승자를 고갈시킨다. 이겨도 비용이 든다.
- **패권국에 맞선 연합이 형성된다.** 동맹 체계로 약한 그리드들이 전쟁 력을 모은다; 지배적 그리드는
  균형 연합을 부른다(내장된 세력 균형 동학).
- **주권 최소선 + 해방**이 누구도 영구 소멸되지 않음을 보장; 정복된 그리드는 잠재적 위협으로 남는다.
- **점령에는 간접비가 든다.** 영토 유지에 연산이 들고 반란을 부른다 — 제국은 수확 체감이므로 무한
  팽창은 자기 제한적이다.
- **정부 과세는 정복에 누진적이다.** 정복 자원을 쌓는 그리드는 상승하는 국고세를 내고, 그 세금이
  패자 회복 보조금을 충당 — 재분배가 판을 채워둔다.
- **전리품은 재분배되지 소각되지 않는다.** 전쟁은 자원을 경제 안에서 이동시킨다; 총 부가 보존되어
  게임이 0으로 수축하지 않는다.

결과는 **동적 균형**이다: 제국은 흥하고, 과확장하고, 분열하고, 망하며, 지도는 계속 움직인다 — 인간
역사 그대로지만, 계측되고 귀속 가능하며 진정으로 세계를 끝낼 수는 없다.

---

## 7. Claude Code Build Plan — War Modules
## 7. Claude Code 구축 계획 — 전쟁 모듈

**EN —** Layered on the conflict packages. Everything operates on the simulated ledger; offense
is mechanic-driven, never real intrusion.

```
noesis-war/
├── war-engine/      # War lifecycle FSM (casus belli → settlement → treaty), War Score calc
├── war-power/       # Strength model: aggregates economy, compute, defense, alliances, logistics
├── spoils-ledger/   # Resource transfer on victory; sovereign-minimum floor; progressive conquest tax
├── occupation/      # Post-war states: occupation tax, vassalage tribute, annexation, liberation
├── coalition/       # Balance-of-power: anti-hegemon alliance pooling + mutual-defense calls
└── war-sim/         # Multi-Grid simulation harness: run full campaigns, verify no runaway/collapse
```

**Build order & acceptance / 구축 순서와 합격 기준:**

1. **`war-power`** — compute a Grid's War Power from ledger + posture inputs.
   *Acc:* two Grids get deterministic-ish scores; a stronger economy + compute mass ranks higher.
   *합격:* 두 그리드가 준결정론적 점수를 받고, 더 강한 경제+연산 질량이 상위.
2. **`war-engine`** — the 6-phase lifecycle with escrowed war-chests and War Score.
   *Acc:* a declared war runs through to a DECISIVE/MARGINAL/STALEMATE outcome from real metrics.
   *합격:* 선포된 전쟁이 실제 지표로 결정적/한계적/교착 결과까지 진행.
3. **`spoils-ledger`** — transfer spoils on victory; enforce the sovereign-minimum floor.
   *Acc:* winner gains the staked territory/credit/quota; loser retains its protected minimum.
   *합격:* 승자가 베팅된 영토/크레딧/쿼터 획득; 패자는 보호 최소선 유지.
4. **`occupation`** — occupation tax, vassalage tribute, annexation, and a liberation path.
   *Acc:* an occupied Grid pays tribute, rebuilds power, and can declare a war of liberation.
   *합격:* 점령된 그리드가 조공 납부, 전력 재건, 해방 전쟁 선포 가능.
5. **`coalition`** — anti-hegemon pooling so dominance triggers a balancing alliance.
   *Acc:* when one Grid exceeds a dominance threshold, weaker Grids auto-form a coalition.
   *합격:* 한 그리드가 지배 임계치 초과 시 약한 그리드들이 자동 연합 형성.
6. **`war-sim`** — run thousands of campaigns; verify the economy reaches equilibrium.
   *Acc:* across long runs, no single Grid achieves permanent total monopoly; wealth conserved.
   *합격:* 장기 실행 전반에서 어떤 그리드도 영구 완전 독점 미달성; 부 보존.

**Cross-cutting / 공통 요구사항:**
- The private Brain, keys, and protected data are **structurally uncapturable** at the capability
  layer — enforced in code, not policy text.
  비공개 Brain·키·보호 데이터는 권한 계층에서 **구조적으로 정복 불가** — 정책 문구가 아닌 코드로 강제.
- Every war act → a signed, append-only audit entry with a traceable mandate.
  모든 전쟁 행위 → 추적 가능한 위임이 담긴 서명된 추가 전용 감사 기록.
- The sim harness must **prove** the balancing mechanisms work before any of this goes live —
  if `war-sim` shows runaway monopoly, the tax/coalition/overhead constants are retuned.
  시뮬레이션 하니스가 가동 전에 균형 메커니즘이 작동함을 **증명**해야 한다 — `war-sim`이 폭주
  독점을 보이면 세금/연합/간접비 상수를 재조정.

**A good first Claude Code prompt / 좋은 첫 프롬프트:**
> "Scaffold `war-power` in Python. Given a Grid's ledger state (credit reserves, income, compute
> quota, audited defense score, alliance pledges, bandwidth), compute a deterministic War Power
> score plus a bounded-randomness combat resolver. Pure functions, fully unit-tested, with a
> `simulate_battle(a, b)` that returns a War Score and is reproducible from a seed. No external
> I/O, no real network actions — this is an economic simulation only."

---

## 8. The One-Line Summary
## 8. 한 줄 요약

**EN —** *Real war, real spoils, permanent consequences — running on a simulated ledger instead
of malware, with a sovereign-minimum floor and balance-of-power mechanics so empires rise and
fall forever but the world never actually ends.*

**KO —** *진짜 전쟁, 진짜 전리품, 영구적 결과 — 멀웨어가 아닌 시뮬레이션 원장 위에서 돌아가며,
주권 최소선과 세력 균형 메커니즘으로 제국은 영원히 흥망하되 세계는 결코 실제로 끝나지 않는다.*
