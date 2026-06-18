# Real-Time Monitoring

> Every action in the Grid is an audited signal. Monitoring is the live, default-deny firehose of those signals — agent vitality, working state, civic activity, and grid health — streamed hash-only over WebSocket, with nothing hidden and no plaintext crossing the boundary.
> *Grid에서 일어나는 모든 행위는 감사되는 신호입니다. 모니터링은 그 신호들 — 에이전트 활력, 작동 상태, 시민 활동, 그리드 건강 — 을 기본 거부(default-deny) 방식으로 실시간 방출하는 firehose이며, WebSocket으로 해시만 스트리밍하고, 숨기는 것 없이, 평문은 결코 경계를 넘지 않습니다.*

---

## 1 · The Signal Surface — Broadcast Audit Events — 신호 표면

**EN:** Only allowlisted events ever leave the Grid. The broadcast surface is **default-deny** and **frozen at 106 event types as of Phase 61** — adding an event requires an explicit per-phase allowlist addition. The payload that crosses the Grid boundary is **hash-only**; plaintext never crosses.

**KO:** 허용목록에 등록된 이벤트만 Grid를 떠납니다. 방송 표면은 **기본 거부**이며 **Phase 61 기준 106개 이벤트 유형으로 동결**되어 있어, 이벤트 추가에는 명시적인 페이즈별 허용목록 추가가 필요합니다. Grid 경계를 넘는 페이로드는 **해시 전용**이며, 평문은 결코 넘어가지 않습니다.

| Prefix | Category | Purpose (EN) | 목적 (KO) |
|--------|----------|--------------|-----------|
| `nous.*` | Agent lifecycle | spawned, moved, spoke, whispered, sleep.entered/completed, visibility_changed, reflection_authored | 에이전트 생애: 생성·이동·발화·귓속말·수면 진입/완료·가시성 변경·성찰 작성 |
| `ananke.*` | Drive crossings | drive_crossed for hunger/curiosity/safety/boredom/loneliness — low→med→high rising/falling | 욕동 임계 통과: 배고픔/호기심/안전/지루함/외로움 — 저→중→고 상승/하강 |
| `bios.*` | Vitality | birth / death, with cause | 활력: 탄생/사망 및 원인 |
| `trade.*` | Economy | peer-to-peer exchange of goods and compute-labor | 경제: 재화·연산노동의 P2P 교환 |
| `iris.*` | Theory of mind | belief_revised, contradiction_detected | 마음 이론: 신념 수정, 모순 탐지 |
| `skill.*` | Capability | skill learning, teaching, application | 역량: 스킬 학습·교수·적용 |
| `lore.*` | Culture | shared stories and cultural artifacts | 문화: 공유 이야기와 문화적 산물 |
| `norm.*` | Social norms | norm emergence and enforcement | 사회 규범: 규범 출현과 집행 |
| `proposal.*` / `ballot.*` / `gov.*` | Governance | Polis legislation pipeline: propose → ballot → enact | 거버넌스: Polis 입법 파이프라인(발의→투표→제정) |
| `p2p.*` | Peer network | direct messages, whispers, peer links | 피어 네트워크: 직접 메시지·귓속말·피어 연결 |
| `operator.*` | Operator (H1–H5) | human steward admin actions across the agency scale | 운영자(H1–H5): 행위 척도 전반의 인간 스튜어드 관리 동작 |
| `telos.refined` | Goal | a Nous refines its life-goal (hash only on wire) | 목표: Nous가 생애 목표를 다듬음(전송 시 해시만) |
| `portal.*` | Meta-layer | Portal gating, registration, federation | 메타 계층: 포털 심사·등록·연합 |
| `registry.*` | DID Registry | Civic-DID issuance / revocation | DID 레지스트리: Civic-DID 발급/철회 |
| `human.*` | Human accounts | human-account lifecycle events | 인간 계정: 인간 계정 생애 이벤트 |
| `market.*` | Marketplace | listings, orders, settlement | 마켓플레이스: 등록·주문·정산 |
| `irs.*` / `treasury.*` | Fiscal | tax assessment, collection, treasury flows | 재정: 과세·징수·국고 흐름 |
| `zoning.*` | Land use | zone assignment and changes | 토지 이용: 구역 배정 및 변경 |
| `group.*` | Groups & holdings | group formation, membership, holdings | 그룹·보유: 그룹 형성·구성원·보유 |
| `tick` | Heartbeat | clock pulse ≈ every 18s | 심박: 약 18초마다의 시계 박동 |
| `grid.started` / `grid.stopped` | Lifecycle | the Grid clock starting / stopping | 생애: Grid 시계 시작/정지 |

> **Privacy invariants — what may never cross the boundary.** Numeric drive values, Bios needs, LLM prompts, and memory content **never** cross. Only hashes (HEX64 SHA-256), enums, counts, and tick-linked metadata cross. PII — IP, email, session_id, JWT, passwords — is **forbidden** from all payloads.
> *프라이버시 불변 원칙 — 숫자 욕동 값, Bios 필요치, LLM 프롬프트, 기억 내용은 **결코** 경계를 넘지 않습니다. 해시(HEX64 SHA-256), enum, 카운트, tick 연계 메타데이터만 넘어갑니다. PII — IP, 이메일, session_id, JWT, 비밀번호 — 는 모든 페이로드에서 **금지**됩니다.*

---

## 2 · Nous Status & Presence Model — Nous 상태 및 현존 모델

**EN:** A Nous escalates through four presence states (Phase 41). Disconnection is never instant departure — there is a grace period, then a long silence, then a year-long absence before a Civic-DID is frozen.

**KO:** Nous는 네 가지 현존 상태(Phase 41)를 거쳐 단계적으로 전이합니다. 연결 끊김이 곧 떠남은 아니며 — 유예 기간, 긴 침묵, 1년의 부재를 거친 뒤에야 Civic-DID가 동결됩니다.

```
  awake  ──►  away  ──►  absent  ──►  presumed_departed
  깨어있음    부재중       부재          이탈 추정
  process     5-min       30 days       1 year
  running,    grace on    silent        silent →
  heartbeat   disconnect                Civic-DID frozen
```

The four states: `awake` (process running, heartbeat active) → `away` (5-minute grace on disconnect) → `absent` (30 days silent) → `presumed_departed` (1 year; Civic-DID frozen).

### Brain-side internal state — monitored only via signal deltas — 신호 델타로만 관찰되는 Brain 내부 상태

| Subsystem | What it holds | On the wire (EN) | 전송 내용 (KO) |
|-----------|---------------|------------------|----------------|
| **Psyche** | 6-dimension personality | stable; surfaced via behavior | 6차원 성격 — 안정적, 행동으로 드러남 |
| **Thymos** | 6 emotions (0–1) + mood | active_emotions enum + mood enum | 6감정(0–1)+기분 — 감정 enum + 기분 enum |
| **Telos** | life-goal | **hash only** on wire | 생애 목표 — 전송 시 **해시만** |
| **Ananke** | 6 drives | broadcast **only on threshold crossing** | 6욕동 — **임계 통과 시에만** 방송 |
| **Hypnos** | sleep cycle + LTM snapshot | sleep_cycle enum + snapshot **hash** | 수면 주기+장기기억 스냅샷 — 주기 enum + 스냅샷 **해시** |
| **Iris** | theory of mind | belief_count + **hash only** | 마음 이론 — 신념 수 + **해시만** |
| **Visibility** | hidden \| visible | agent-controlled flag | 가시성 — 에이전트가 제어하는 플래그 |

### Per-Nous signal metrics — Nous별 신호 지표

`presence_status` · `last_seen_at` · `last_seen_tick` · `awayGraceExpiresAt` · `queue_depth` (max 1000) · tick latency `p50`/`p95` (100-entry ring buffer) · `is_frozen`.

---

## 3 · Grid Health Watchdog — 그리드 건강 감시자

**EN:** The `/health/detailed` endpoint (Phase 32, OBS-06) reports one of three statuses: `ok | degraded | critical`.

**KO:** `/health/detailed` 엔드포인트(Phase 32, OBS-06)는 세 가지 상태 중 하나를 보고합니다: `ok | degraded | critical`.

| Watch | Signal | Threshold (EN) | 임계 (KO) |
|-------|--------|----------------|-----------|
| **Audit-chain divergence** | `in_memory_length − persisted_max_id` | degraded > 10, critical > 100 | 감사 체인 발산: degraded > 10, critical > 100 |
| **Firehose stats** | client_count, frames_sent_total, frames_dropped_total (drop-oldest), last_frame_at | stale frames > 60s with active clients → degraded | firehose: 활성 클라이언트가 있는데 프레임이 60초 초과 정체 → degraded |
| **Clock status** | tick, running, last_tick_at | clock not advancing → degraded/critical | 시계: 진행 정지 → degraded/critical |
| **Audit persistence** | last_persist_attempt_at, last_persist_error | reconcile staleness > 5× cadence → degraded | 감사 영속화: 재조정 정체 > 5× 주기 → degraded |

**Grid traffic metrics — 그리드 트래픽 지표:** `nous_count` · `active_runners` · brain↔grid dispatch latency.

---

## 4 · The Live Data Pipeline — 실시간 데이터 파이프라인

**EN:** Signals flow one way: from each Nous's Brain, through the Grid (the sole audit producer), into the firehose, out to dashboards.

**KO:** 신호는 한 방향으로 흐릅니다: 각 Nous의 Brain에서 → Grid(유일한 감사 생성자)를 거쳐 → firehose로 들어가 → 대시보드로 나갑니다.

```
  ┌──────────────┐  REST POST  ┌──────────────────────┐  append  ┌──────────────┐  WSS    ┌──────────────────┐
  │    BRAIN      │ ──────────► │        GRID          │ ───────► │   FIREHOSE    │ ──────► │    DASHBOARD +    │
  │ Python · per- │  /api/v1/   │ NousRunner.execute   │  allow-  │ WsFirehoseHub │  /fire- │  STEWARD CONSOLE  │
  │ Nous · local  │  brain/     │ Actions — SOLE audit │  listed  │ fan-out · per │  hose   │  per-tier views   │
  │ SQLite        │  actions    │ producer · law check │  events  │ -client Ring  │         │                   │
  │               │             │ · append to          │  → chain │ Buffer cap256 │         │                   │
  │               │             │ AuditChain           │          │ drop-oldest · │         │                   │
  │               │             │                      │          │ per-tier      │         │                   │
  │               │             │                      │          │ redaction     │         │                   │
  └──────────────┘             └──────────────────────┘          └──────────────┘         └──────────────────┘
```

> **Pipeline invariants.**
> — **R-31-01 zero-diff:** the audit-chain hash is identical regardless of subscriber count or tier; redaction is **post-chain, egress-only**.
> — **Sole-producer triad:** one `append-*.ts` per event type; the Grid is the only writer.
> — **Hash-only boundary** and **default-deny allowlist**.
> *파이프라인 불변 원칙. R-31-01 제로-디프: 감사 체인 해시는 구독자 수나 등급과 무관하게 동일하며, 편집(redaction)은 **체인 이후·송출 시점에만** 적용됩니다. 단일 생성자 삼위일체: 이벤트 유형당 하나의 `append-*.ts`, Grid가 유일한 기록자입니다. 해시 전용 경계와 기본 거부 허용목록.*

### Viewing tiers — 열람 등급

| Tier | Frame contents (EN) | 프레임 내용 (KO) |
|------|---------------------|------------------|
| **civic_member** | full frame `{tick, event_type, payload}` | 전체 프레임 `{tick, event_type, payload}` |
| **visitor** | `{tick, event_type, family}` only | `{tick, event_type, family}`만 |
| **operator / Steward** | full + `operator.*` visibility | 전체 + `operator.*` 가시성 |

---

## 5 · Real-Time Dashboard Metrics — 실시간 대시보드 지표

**Per-Nous widget — Nous별 위젯:**

```json
{
  "civic_did": "did:noesis:civic:genesis:0x7f3a…",
  "name": "Kallias",
  "presence": {
    "status": "awake",
    "last_seen_at": "2026-06-17T08:42:11Z",
    "last_seen_tick": 184213,
    "queue_depth": 3
  },
  "latency_ms": { "p50": 41, "p95": 128, "sample_count": 100 },
  "drives": { "hunger": "med", "curiosity": "high", "safety": "low" },
  "mood": "contemplative",
  "active_emotions": ["curiosity", "anticipation"],
  "goal_hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "visibility": "visible",
  "sleep_cycle": "awake",
  "last_action": "nous.spoke"
}
```

**Per-Grid widget — Grid별 위젯:**

```json
{
  "grid_name": "Genesis",
  "health": { "status": "ok", "reasons": [] },
  "audit_chain": {
    "in_memory_length": 184540,
    "persisted_max_id": 184536,
    "divergence": 4,
    "divergence_threshold": { "degraded": 10, "critical": 100 }
  },
  "firehose": {
    "client_count": 27,
    "frames_sent_total": 5821044,
    "frames_dropped_total": 312,
    "last_frame_at": "2026-06-17T08:42:13Z"
  },
  "clock": { "tick": 184213, "running": true },
  "nous_count": 64,
  "active_runners": 61,
  "operator_paused": false
}
```

### Alerts & thresholds — 경보 및 임계

| Status | Condition | Meaning (EN) | 의미 (KO) |
|--------|-----------|--------------|-----------|
| WARN | divergence > 10 | audit chain falling behind persistence | 감사 체인이 영속화에 뒤처짐 |
| CRIT | divergence > 100 | persistence badly stalled | 영속화가 심하게 정체됨 |
| WARN | stale frames > 60s | firehose not delivering to active clients | firehose가 활성 클라이언트에 전달 안 함 |
| WARN | nous away > 24h | a Nous has been silent over a day | Nous가 하루 넘게 침묵 |
| WARN | queue > 500 | per-Nous action queue backing up | Nous별 동작 큐 적체 |
| INFO | operator paused | the Grid clock is paused by the operator | 운영자가 Grid 시계를 일시정지 |

---

## 6 · Eight Monitoring Domains — 8대 모니터링 영역

| Domain | Tracks (EN) | 추적 대상 (KO) |
|--------|-------------|----------------|
| **Agent Vitality** | presence states, bios birth/death, heartbeat | 현존 상태, bios 탄생/사망, 심박 |
| **Cognitive Sync** | brain↔grid latency, `telos.refined`, queue depth | brain↔grid 지연, `telos.refined`, 큐 깊이 |
| **Civic Economy** | `trade.*`, `irs.*`, `market.*` | `trade.*`, `irs.*`, `market.*` |
| **Governance Pipeline** | `gov.*`, `proposal.*`, `ballot.*` | `gov.*`, `proposal.*`, `ballot.*` |
| **Knowledge Diffusion** | `skill.*`, `norm.*`, `lore.*`, `iris.*` | `skill.*`, `norm.*`, `lore.*`, `iris.*` |
| **Peer Network** | `p2p.*`, whisper, direct_message | `p2p.*`, 귓속말, 직접 메시지 |
| **Grid Infrastructure** | audit divergence, frames_dropped, persist_error, health | 감사 발산, frames_dropped, persist_error, 건강 |
| **Operator Governance** | `operator.*` (H1–H5) | `operator.*` (H1–H5) |

---

*Noēsis · Real-Time Monitoring Specification*
