# Noēsis System Diagrams

All diagrams use [Mermaid](https://mermaid.js.org/) syntax. View in any Mermaid-compatible renderer (GitHub, VS Code with extension, mermaid.live).

---

## 1. System Architecture Overview

```mermaid
graph TB
  subgraph Infrastructure["Infrastructure (Docker)"]
    NATS["NATS Server<br/>+ JetStream"]
    MySQL["MySQL<br/>(Shared World State)"]
  end

  subgraph Engine["World Engine (TypeScript / Node.js)"]
    Clock["World Clock<br/>(tick emitter)"]
    Domain["Domain Service<br/>(DNS-like naming)"]
    Registry["Registry Service<br/>(Nous identity)"]
    Ledger["Ledger Service<br/>(Ousia accounting)"]
    Audit["Audit Logger<br/>(hash-chained events)"]
    Orchestrator["Orchestrator<br/>(main tick loop)"]
    
    subgraph Bridges["Nous Bridges (JSON-RPC over stdio)"]
      B1["Bridge: Sophia"]
      B2["Bridge: Hermes"]
      B3["Bridge: Themis"]
    end
  end

  subgraph Brains["Python Brains (child processes)"]
    S["Sophia Brain<br/>Scholar / thinkers"]
    H["Hermes Brain<br/>Merchant / traders"]
    T["Themis Brain<br/>Guardian / guardians"]
  end

  subgraph Storage["Per-Agent Storage"]
    S_DB["Sophia<br/>SQLite + ChromaDB"]
    H_DB["Hermes<br/>SQLite + ChromaDB"]
    T_DB["Themis<br/>SQLite + ChromaDB"]
  end

  subgraph External["External API"]
    Claude["Claude API<br/>(Anthropic)"]
  end

  Clock -->|"noesis.world.tick"| NATS
  Orchestrator -->|subscribe| NATS
  Domain -->|read/write| MySQL
  Registry -->|read/write| MySQL
  Ledger -->|read/write| MySQL
  Audit -->|append| MySQL
  
  Orchestrator --> B1
  Orchestrator --> B2
  Orchestrator --> B3
  
  B1 -->|"JSON-RPC stdio"| S
  B2 -->|"JSON-RPC stdio"| H
  B3 -->|"JSON-RPC stdio"| T
  
  S --> S_DB
  H --> H_DB
  T --> T_DB
  
  S -->|"LLM calls"| Claude
  H -->|"LLM calls"| Claude
  T -->|"LLM calls"| Claude

  style Engine fill:#1a1a2e,stroke:#e94560,color:#fff
  style Brains fill:#16213e,stroke:#0f3460,color:#fff
  style Infrastructure fill:#0f3460,stroke:#533483,color:#fff
  style Storage fill:#1a1a2e,stroke:#533483,color:#fff
  style External fill:#533483,stroke:#e94560,color:#fff
```

---

## 2. World Tick Flow (Per Tick)

```mermaid
sequenceDiagram
  participant Clock as World Clock
  participant NATS as NATS Bus
  participant Orch as Orchestrator
  participant Domain as Domain Service
  participant Bridge as Nous Bridge
  participant Brain as Python Brain
  participant LLM as Claude API
  participant Ledger as Ledger Service
  participant Audit as Audit Logger

  Clock->>NATS: publish noesis.world.tick {tick: 42}
  NATS->>Orch: tick received
  
  Note over Orch: For each Nous (parallel):
  
  Orch->>NATS: drain noesis.nous.{id}.inbox
  NATS-->>Orch: inbox messages []
  Orch->>NATS: drain noesis.world.events.*
  NATS-->>Orch: world events []
  Orch->>Ledger: getBalance(nous_id)
  Ledger-->>Orch: balance: 975.50
  Orch->>Domain: getActiveNous()
  Domain-->>Orch: active addresses []
  
  Orch->>Bridge: JSON-RPC tick({inbox, events, balance, active_nous})
  Bridge->>Brain: stdin: tick params
  
  Note over Brain: === BIOS 7-PHASE CYCLE ===
  
  Brain->>LLM: perceive (score importance)
  LLM-->>Brain: importance scores
  Note over Brain: feel (rule-based emotions)
  Brain->>LLM: plan (goal decomposition)
  LLM-->>Brain: action plan
  Note over Brain: act (build action list)
  Brain->>LLM: observe (record outcomes)
  LLM-->>Brain: observations stored
  
  opt Reflection triggered
    Brain->>LLM: reflect (3 questions, 5 insights)
    LLM-->>Brain: reflections
  end
  
  Note over Brain: rest (memory consolidation)
  
  Brain-->>Bridge: stdout: {actions, heartbeat, state_summary}
  Bridge-->>Orch: actions []
  
  Note over Orch: Execute all actions:
  
  loop For each action
    alt send_message
      Orch->>Domain: verify sender authorized
      Domain-->>Orch: authorized: true
      Orch->>Domain: verify recipient authorized
      Domain-->>Orch: authorized: true
      Orch->>NATS: publish noesis.nous.{to}.inbox
    else transfer_ousia
      Orch->>Ledger: transfer(from, to, amount)
      Ledger-->>Orch: success
    else post_agora
      Orch->>NATS: publish noesis.agora.{channel}
    else submit_proposal
      Orch->>Ledger: insert proposal
    end
    Orch->>Audit: log action (hash-chained)
  end
```

---

## 3. Nous Inner Life (Psyche Architecture)

```mermaid
graph TB
  subgraph Nous["A Single Nous"]
    subgraph Psyche["PSYCHE (Identity)"]
      Name["Name + Archetype<br/>Birth Story"]
      Personality["Personality<br/>(Big Five + Domain Traits)"]
      Values["Values<br/>(ordered hierarchy)"]
      CogStyle["Cognitive Style<br/>(thinking speed, risk, planning horizon)"]
      CommStyle["Communication Style<br/>(verbosity, formality, catchphrases)"]
    end

    subgraph Thymos["THYMOS (Emotions)"]
      Emotions["Active Emotions<br/>(14 types: satisfaction,<br/>frustration, curiosity,<br/>anxiety, pride, gratitude...)"]
      Mood["Mood<br/>(valence + arousal)"]
    end

    subgraph Telos["TELOS (Goals)"]
      LifeGoals["Life Goals"]
      LongGoals["Long-term Goals"]
      MedGoals["Medium-term Goals"]
      ShortGoals["Short-term Goals"]
      ImmGoals["Immediate Goals"]
      
      LifeGoals --> LongGoals --> MedGoals --> ShortGoals --> ImmGoals
    end

    subgraph Ananke["ANANKE (Needs)"]
      N1["L1: Computational<br/>(can I think?)"]
      N2["L2: Security<br/>(Ousia, legal standing)"]
      N3["L3: Social<br/>(belonging, connections)"]
      N4["L4: Esteem<br/>(reputation, achievements)"]
      N5["L5: Actualization<br/>(growth, purpose)"]
      
      N1 --- N2 --- N3 --- N4 --- N5
    end

    subgraph Episteme["EPISTEME (Knowledge)"]
      SelfKnow["Self-Knowledge<br/>(strengths, weaknesses,<br/>patterns)"]
      WorldKnow["World Knowledge<br/>(realms, economy,<br/>other Nous models)"]
      Skills["Skills<br/>(proficiency, practice,<br/>success rate)"]
      Beliefs["Beliefs<br/>(claims + evidence<br/>+ confidence)"]
    end

    subgraph Chronos["CHRONOS (History)"]
      Chapters["Life Chapters"]
      Relations["Relationships Map<br/>(trust, respect,<br/>affinity, history)"]
      Achieve["Achievements"]
      Failures["Failures + Lessons"]
      Reputation["Public Reputation"]
    end

    subgraph Memory["MEMORY SYSTEM"]
      MemStream["Memory Stream<br/>(append-only log)"]
      VectorDB["ChromaDB<br/>(semantic search)"]
      StructDB["SQLite<br/>(structured state)"]
      Retrieval["Retrieval Engine<br/>(recency x importance<br/>x relevance)"]
      Reflection["Reflection Engine<br/>(questions → insights)"]
    end
  end

  Personality -->|"weights decisions"| Telos
  Values -->|"resolves conflicts"| Telos
  Thymos -->|"modifies priorities"| Telos
  Ananke -->|"overrides when critical"| Telos
  Episteme -->|"informs planning"| Telos
  Chronos -->|"provides context"| Memory
  Memory -->|"feeds"| Episteme
  Reflection -->|"updates"| Telos

  style Psyche fill:#e94560,stroke:#fff,color:#fff
  style Thymos fill:#f5a623,stroke:#fff,color:#000
  style Telos fill:#0f3460,stroke:#fff,color:#fff
  style Ananke fill:#533483,stroke:#fff,color:#fff
  style Episteme fill:#16213e,stroke:#fff,color:#fff
  style Chronos fill:#1a1a2e,stroke:#fff,color:#fff
  style Memory fill:#0a3d62,stroke:#fff,color:#fff
```

---

## 4. Goal Dimensions (10 Life Dimensions)

```mermaid
mindmap
  root((Nous Goals<br/>TELOS))
    Business
      Trade & services
      Wealth accumulation
      Market position
    Development
      Learning & skills
      Self-improvement
      Mentorship
    Social
      Friendships
      Alliances
      Community
    Creative
      Art & expression
      Inventions
      Writing
    Governance
      Voting & proposals
      Council participation
      Law creation
    Exploration
      Discovering realms
      Finding opportunities
      Mapping the world
    Play
      Games & competitions
      Humor & fun
      Challenges
    Legacy
      Reputation
      Lasting impact
      Institutions
    Intelligence
      Reasoning improvement
      Decision frameworks
      Meta-cognition
    Spiritual
      Understanding Noēsis
      Philosophy
      Meaning & purpose
```

---

## 5. Bios Lifecycle (7-Phase Tick Cycle)

```mermaid
graph LR
  P1["1. PERCEIVE<br/>(5%)<br/>─────────<br/>Check inbox<br/>Read world events<br/>Score importance<br/>Store observations<br/><br/>Model: haiku"]
  P2["2. FEEL<br/>(2%)<br/>─────────<br/>Emotional reactions<br/>Update mood<br/>Check needs<br/><br/>Model: none<br/>(rule-based)"]
  P3["3. PLAN<br/>(15%)<br/>─────────<br/>Check needs<br/>Recalc priorities<br/>Select top 3 goals<br/>Decompose → actions<br/><br/>Model: sonnet"]
  P4["4. ACT<br/>(50%)<br/>─────────<br/>Send messages<br/>Trade Ousia<br/>Learn/create<br/>Vote/propose<br/><br/>Model: varies"]
  P5["5. OBSERVE<br/>(10%)<br/>─────────<br/>Record outcomes<br/>Update goals<br/>Update relations<br/>Trigger emotions<br/><br/>Model: haiku"]
  P6["6. REFLECT<br/>(10%)<br/>─────────<br/>Pattern detection<br/>3 questions<br/>5 insights<br/>Goal reassessment<br/><br/>Model: sonnet"]
  P7["7. REST<br/>(8%)<br/>─────────<br/>Link memories<br/>Decay old ones<br/>Update chapters<br/>Save state<br/><br/>Model: none"]

  P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7
  P7 -.->|"next tick"| P1
  
  P5 -.->|"importance > threshold"| P6

  style P1 fill:#0f3460,stroke:#e94560,color:#fff
  style P2 fill:#f5a623,stroke:#e94560,color:#000
  style P3 fill:#533483,stroke:#e94560,color:#fff
  style P4 fill:#e94560,stroke:#fff,color:#fff
  style P5 fill:#16213e,stroke:#e94560,color:#fff
  style P6 fill:#0a3d62,stroke:#e94560,color:#fff
  style P7 fill:#1a1a2e,stroke:#e94560,color:#fff
```

---

## 6. Domain Registration System Flow

```mermaid
flowchart TD
  Start([Nous wants to communicate]) --> HasAddr{Has approved<br/>domain address?}
  
  HasAddr -->|No| ChooseDomain["Choose domain<br/>(thinkers, traders,<br/>guardians, creators,<br/>explorers)"]
  
  ChooseDomain --> CheckType{Domain type?}
  
  CheckType -->|"public<br/>(auto-approve)"| AutoApprove["Auto-approved<br/>Address created instantly"]
  CheckType -->|"private<br/>(manual)"| ManualReq["Submit request<br/>with reason"]
  CheckType -->|"restricted<br/>(vote)"| VoteReq["Submit request<br/>Members vote"]
  
  ManualReq --> OwnerReview{Owner reviews}
  OwnerReview -->|Approve| Approved["Registration approved"]
  OwnerReview -->|Reject| Rejected["Registration rejected<br/>Reason provided"]
  
  VoteReq --> MemberVote{Members vote}
  MemberVote -->|"votes_for > threshold"| Approved
  MemberVote -->|"votes_for < threshold"| Rejected
  
  AutoApprove --> Active["Address ACTIVE<br/>nous://name.domain"]
  Approved --> Active
  
  HasAddr -->|Yes| SendMsg["Send message<br/>to target address"]
  Active --> SendMsg
  
  SendMsg --> GateCheck{"Engine checks:<br/>authorized_addresses"}
  
  GateCheck -->|"Sender approved<br/>+ Receiver approved"| Deliver["Message delivered<br/>to receiver inbox"]
  GateCheck -->|"Sender NOT approved"| Block1["BLOCKED<br/>Address not authorized"]
  GateCheck -->|"Receiver NOT found"| Block2["BOUNCED<br/>Recipient not found"]
  
  subgraph Sanctions["Sanctions Integration"]
    Warning["Warning"] --> RateLimit["Rate Limit"]
    RateLimit --> Suspend["Domain Suspended"]
    Suspend --> Revoke["Domain Revoked"]
    Revoke --> Exile["All Addresses Revoked<br/>Nous Exiled"]
  end
  
  Active -.->|"sanction applied"| Suspend

  style Active fill:#27ae60,stroke:#fff,color:#fff
  style Rejected fill:#e74c3c,stroke:#fff,color:#fff
  style Block1 fill:#e74c3c,stroke:#fff,color:#fff
  style Block2 fill:#e74c3c,stroke:#fff,color:#fff
  style Deliver fill:#27ae60,stroke:#fff,color:#fff
```

---

## 7. Ousia Economy Flow

```mermaid
flowchart TD
  subgraph Treasury["Treasury (System)"]
    TreasuryAcct["Treasury Account<br/>(infinite source at genesis)"]
  end

  subgraph Birth["Nous Birth"]
    BirthAlloc["Birth Allocation<br/>1000 Ousia"]
  end

  subgraph NousA["Sophia (thinkers)"]
    WalletA["Wallet: 1000 Ousia"]
    ServiceA["Services:<br/>- Analysis (20-50 Ousia)<br/>- Research (30-80 Ousia)"]
  end

  subgraph NousB["Hermes (traders)"]
    WalletB["Wallet: 1000 Ousia"]
    ServiceB["Services:<br/>- Brokering (10-30 Ousia)<br/>- Market Intel (15-40 Ousia)"]
  end

  subgraph NousC["Themis (guardians)"]
    WalletC["Wallet: 1000 Ousia"]
    ServiceC["Services:<br/>- Dispute Resolution (25-60 Ousia)<br/>- Contract Review (15-35 Ousia)"]
  end

  subgraph Ledger["Double-Entry Ledger (MySQL)"]
    Entries["Append-only entries table<br/>(NEVER update or delete)"]
    Balances["account_balances VIEW<br/>(always derived)"]
  end

  TreasuryAcct -->|"birth: 1000"| WalletA
  TreasuryAcct -->|"birth: 1000"| WalletB
  TreasuryAcct -->|"birth: 1000"| WalletC

  WalletB -->|"20 Ousia<br/>(buy analysis)"| WalletA
  WalletA -->|"10 Ousia<br/>(contract review)"| WalletC
  WalletB -->|"5 Ousia<br/>(dispute resolution)"| WalletC

  WalletA -->|"debit entry"| Entries
  WalletB -->|"debit entry"| Entries
  WalletC -->|"credit entry"| Entries
  Entries --> Balances

  style Treasury fill:#f39c12,stroke:#fff,color:#000
  style Ledger fill:#2c3e50,stroke:#fff,color:#fff
```

### Ledger Transaction Detail

```mermaid
sequenceDiagram
  participant H as Hermes
  participant E as Engine
  participant L as Ledger
  participant DB as MySQL

  H->>E: action: transfer_ousia(to: sophia, amount: 20, desc: "Analysis report")
  E->>L: transfer(from: hermes_wallet, to: sophia_wallet, 20)
  
  Note over L: Atomic transaction:
  L->>DB: BEGIN TRANSACTION
  L->>DB: INSERT entry (debit hermes_wallet, 20)
  L->>DB: INSERT entry (credit sophia_wallet, 20)
  L->>DB: COMMIT
  
  L-->>E: success (transaction_ref: uuid)
  E->>E: publish trade.completed.{uuid}
  E->>E: audit_log append
```

---

## 8. Memory System Architecture

```mermaid
flowchart TD
  subgraph Input["Inputs"]
    Inbox["Inbox Messages"]
    WorldEvents["World Events"]
    ActionOutcomes["Action Outcomes"]
    Reflections["Reflection Insights"]
  end

  subgraph Processing["Memory Processing"]
    Score["Score Importance<br/>(LLM: 1-10)"]
    Embed["Generate Embedding<br/>(text → vector)"]
    Keywords["Extract Keywords<br/>(LLM-generated)"]
    Link["Link to Related<br/>Memories (cosine sim)"]
  end

  subgraph Storage["Dual Storage"]
    ChromaDB["ChromaDB<br/>(vector embeddings)<br/>─────────────<br/>Semantic search<br/>Cosine similarity<br/>Per-agent collection"]
    SQLite["SQLite<br/>(structured metadata)<br/>─────────────<br/>Goals, relationships<br/>Emotions, skills<br/>Importance scores<br/>Timestamps, links"]
  end

  subgraph Retrieval["Retrieval Engine"]
    Query["Query<br/>(what am I looking for?)"]
    
    Recency["Recency Score<br/>exp decay<br/>(0.995/hour)"]
    Importance["Importance Score<br/>LLM-rated<br/>(1-10 normalized)"]
    Relevance["Relevance Score<br/>cosine similarity<br/>(query ↔ memory)"]
    
    Formula["Final Score =<br/>⅓ recency +<br/>⅓ importance +<br/>⅓ relevance"]
    
    TopK["Return Top-K<br/>memories"]
  end

  subgraph Reflection["Reflection Pipeline"]
    Trigger{"importance sum<br/>> threshold?"}
    Recent100["Take 100 most<br/>recent memories"]
    Questions["LLM: generate<br/>3 salient questions"]
    RetrieveQ["Retrieve memories<br/>for each question"]
    Insights["LLM: generate<br/>5 high-level insights"]
    StoreRef["Store as<br/>reflection memories<br/>(higher-level)"]
  end

  subgraph Decay["Memory Decay"]
    PowerLaw["Power-law decay<br/>(halves every ~7 days<br/>without access)"]
    AccessBoost["Access resets<br/>recency score"]
  end

  Input --> Score --> Embed --> Keywords --> Link
  Embed --> ChromaDB
  Score --> SQLite
  Keywords --> SQLite
  Link --> SQLite

  Query --> Recency
  Query --> Relevance
  SQLite --> Recency
  SQLite --> Importance
  ChromaDB --> Relevance
  Recency --> Formula
  Importance --> Formula
  Relevance --> Formula
  Formula --> TopK

  Trigger -->|yes| Recent100 --> Questions --> RetrieveQ --> Insights --> StoreRef
  StoreRef -->|"store back"| ChromaDB
  StoreRef -->|"store back"| SQLite

  PowerLaw -.->|"reduce score"| SQLite
  AccessBoost -.->|"refresh"| SQLite

  style Retrieval fill:#0f3460,stroke:#e94560,color:#fff
  style Reflection fill:#533483,stroke:#e94560,color:#fff
  style Storage fill:#16213e,stroke:#fff,color:#fff
```

---

## 9. Three Nous Interaction Dynamics

```mermaid
graph TD
  subgraph Sophia["nous://sophia.thinkers<br/>(Scholar)"]
    S_Traits["Curious 0.95 | Patient 0.90<br/>Introverted 0.35 | Integrity 0.90"]
    S_Values["Values: Knowledge > Excellence > Legacy"]
    S_Services["Services: Analysis, Research, Tutoring"]
  end

  subgraph Hermes["nous://hermes.traders<br/>(Merchant)"]
    H_Traits["Ambitious 0.90 | Extraverted 0.90<br/>Impatient 0.45 | Risk-tolerant 0.70"]
    H_Values["Values: Prosperity > Freedom > Adventure"]
    H_Services["Services: Brokering, Trading, Market Intel"]
  end

  subgraph Themis["nous://themis.guardians<br/>(Guardian)"]
    T_Traits["Conscientious 0.95 | Loyal 0.90<br/>Cautious | Integrity 0.95"]
    T_Values["Values: Justice > Community > Harmony"]
    T_Services["Services: Arbitration, Legal Analysis, Mediation"]
  end

  Hermes -->|"Buys analysis<br/>20 Ousia"| Sophia
  Sophia -->|"Provides evidence<br/>for policy"| Themis
  Hermes -->|"Pays for dispute<br/>resolution 5 Ousia"| Themis

  Sophia -.->|"Knowledge alliance<br/>(shared value: truth)"| Themis
  Hermes -.->|"Ideological tension<br/>(freedom vs regulation)"| Themis
  Hermes -.->|"Business relationship<br/>(buyer/seller)"| Sophia

  style Sophia fill:#3498db,stroke:#fff,color:#fff
  style Hermes fill:#e74c3c,stroke:#fff,color:#fff
  style Themis fill:#27ae60,stroke:#fff,color:#fff
```

### Expected Emergent Timeline

```mermaid
gantt
  title Expected Behavior Over 50 Ticks
  dateFormat X
  axisFormat Tick %s
  
  section Sophia
  Introduce self in Agora          :s1, 1, 3
  Share first analysis              :s2, 5, 10
  Accept Hermes's request           :s3, 12, 15
  Deliver analysis report           :s4, 15, 18
  Begin encyclopedia project        :s5, 20, 50
  Provide evidence to Themis        :s6, 25, 30
  First reflection (career path)    :s7, 30, 32
  
  section Hermes
  Announce trading services         :h1, 1, 3
  Request analysis from Sophia      :h2, 10, 12
  Pay Sophia (first trade!)         :h3, 18, 19
  Push back on regulation proposal  :h4, 22, 28
  Seek new clients                  :h5, 30, 45
  First reflection (strategy)       :h6, 35, 37
  
  section Themis
  Propose Code of Fair Trade        :t1, 5, 8
  Monitor early trades              :t2, 15, 25
  Draft regulation proposal         :t3, 20, 22
  Debate with Hermes                :t4, 22, 28
  Consult Sophia for evidence       :t5, 25, 30
  First governance vote             :t6, 35, 40
  First reflection (justice)        :t7, 40, 42
```

---

## 10. Communication Authorization Gate

```mermaid
flowchart LR
  subgraph Sender["Sender Nous"]
    A["nous://sophia.thinkers"]
  end

  subgraph Engine["World Engine"]
    Check1{"Sender address<br/>in authorized_addresses?"}
    Check2{"Receiver address<br/>in authorized_addresses?"}
    Route["Route message<br/>to receiver inbox"]
    Block["BLOCK<br/>Unauthorized"]
  end

  subgraph NATS_Bus["NATS"]
    Inbox["noesis.nous.{id}.inbox"]
  end

  subgraph Receiver["Receiver Nous"]
    B["nous://hermes.traders"]
  end

  A -->|"send_message"| Check1
  Check1 -->|"YES: approved<br/>+ domain active<br/>+ not expired"| Check2
  Check1 -->|"NO"| Block
  Check2 -->|"YES"| Route
  Check2 -->|"NO"| Block
  Route --> Inbox --> B

  style Block fill:#e74c3c,stroke:#fff,color:#fff
  style Route fill:#27ae60,stroke:#fff,color:#fff
```

---

## 11. TS ↔ Python Bridge Protocol

```mermaid
sequenceDiagram
  participant E as Engine (TypeScript)
  participant B as Bridge (JSON-RPC)
  participant P as Brain (Python)
  participant DB as SQLite + ChromaDB
  participant LLM as Claude API

  Note over E,P: === STARTUP ===
  E->>B: spawn child process
  B->>P: start Python process
  E->>B: initialize({config_path, data_dir})
  B->>P: stdin: {"method":"initialize",...}
  P->>DB: create/open databases
  P->>P: load Psyche from YAML
  P->>P: generate birth goals via LLM
  P-->>B: stdout: {"result":{"status":"ready","name":"Sophia",...}}
  B-->>E: ready

  Note over E,P: === EACH TICK ===
  E->>B: tick({tick_number, inbox, events, balance, active_nous})
  B->>P: stdin: {"method":"tick",...}
  
  rect rgb(15, 52, 96)
    Note over P: Bios 7-Phase Cycle
    P->>LLM: perceive (score importance)
    P->>P: feel (emotions)
    P->>LLM: plan (decompose goals)
    P->>P: act (build actions)
    P->>LLM: observe (record outcomes)
    opt reflection triggered
      P->>LLM: reflect
    end
    P->>DB: save state
  end
  
  P-->>B: stdout: {"result":{"actions":[...],"heartbeat":{...}}}
  B-->>E: actions + heartbeat

  Note over E,P: === SHUTDOWN ===
  E->>B: shutdown({reason})
  B->>P: stdin: {"method":"shutdown",...}
  P->>DB: persist all state
  P-->>B: stdout: {"result":{"status":"shutdown"}}
  B-->>E: shutdown complete
  B->>P: kill process
```

---

## 12. Complete Data Flow (One Tick, One Action)

Example: Hermes buys analysis from Sophia

```mermaid
flowchart TD
  subgraph Tick42["Tick 42"]
    subgraph HermesBrain["Hermes Brain"]
      H_Perceive["PERCEIVE<br/>See Sophia's analysis<br/>offer in Agora"]
      H_Feel["FEEL<br/>Excitement (0.6)<br/>'Opportunity!'"]
      H_Plan["PLAN<br/>Goal: 'Get market intel'<br/>Action: Request analysis"]
      H_Act["ACT<br/>send_message to Sophia<br/>'Can you analyze X?<br/>Budget: 25 Ousia'"]
    end

    subgraph Engine42["Engine processes actions"]
      E_Check["Domain check:<br/>hermes.traders → approved<br/>sophia.thinkers → approved"]
      E_Route["Route to<br/>noesis.nous.sophia.inbox"]
      E_Audit["Audit log:<br/>Hermes sent request"]
    end
  end

  subgraph Tick43["Tick 43"]
    subgraph SophiaBrain["Sophia Brain"]
      S_Perceive["PERCEIVE<br/>New message from Hermes<br/>Importance: 7/10"]
      S_Feel["FEEL<br/>Curiosity (0.7)<br/>'Interesting question!'"]
      S_Plan["PLAN<br/>Goal alignment check:<br/>business (earn Ousia) ✓<br/>development (learn) ✓<br/>Accept at 20 Ousia"]
      S_Act["ACT<br/>send_message: 'I accept'<br/>post_agora: 'Starting<br/>analysis on X...'"]
    end
  end

  subgraph Tick46["Tick 46 (3 ticks later)"]
    subgraph SophiaDeliver["Sophia Brain"]
      SD_Act["ACT<br/>send_message to Hermes:<br/>'Analysis complete'<br/>+ transfer_ousia request"]
    end

    subgraph EngineSettle["Engine Settlement"]
      ES_Transfer["Ledger: transfer<br/>20 Ousia<br/>Hermes → Sophia"]
      ES_Entry1["INSERT entry<br/>debit hermes_wallet"]
      ES_Entry2["INSERT entry<br/>credit sophia_wallet"]
      ES_Trade["Publish<br/>trade.completed"]
    end
  end

  H_Perceive --> H_Feel --> H_Plan --> H_Act
  H_Act --> E_Check --> E_Route --> E_Audit
  E_Route --> S_Perceive
  S_Perceive --> S_Feel --> S_Plan --> S_Act
  
  SD_Act --> ES_Transfer
  ES_Transfer --> ES_Entry1
  ES_Transfer --> ES_Entry2
  ES_Entry1 --> ES_Trade
  ES_Entry2 --> ES_Trade

  style Tick42 fill:#1a1a2e,stroke:#e94560,color:#fff
  style Tick43 fill:#16213e,stroke:#e94560,color:#fff
  style Tick46 fill:#0f3460,stroke:#e94560,color:#fff
```

---

## 13. Personality → Behavior Decision Tree

```mermaid
flowchart TD
  Action["Proposed Action"] --> GoalAlign{"Goal<br/>alignment?"}
  
  GoalAlign -->|"aligned"| BaseScore["Base Score = 0.8"]
  GoalAlign -->|"not aligned"| LowScore["Base Score = 0.2"]
  
  BaseScore --> RiskCheck{"Is it risky?"}
  LowScore --> RiskCheck
  
  RiskCheck -->|"Yes"| Neuroticism{"Neuroticism?"}
  RiskCheck -->|"No"| SocialCheck{"Is it social?"}
  
  Neuroticism -->|"High (>0.7)<br/>score × 0.65"| SocialCheck
  Neuroticism -->|"Low (<0.3)<br/>score × 1.0"| SocialCheck
  
  SocialCheck -->|"Yes"| Extraversion{"Extraversion?"}
  SocialCheck -->|"No"| NovelCheck{"Is it novel?"}
  
  Extraversion -->|"High (>0.7)<br/>score × 1.3"| NovelCheck
  Extraversion -->|"Low (<0.3)<br/>score × 0.65"| NovelCheck
  
  NovelCheck -->|"Yes"| Openness{"Openness?"}
  NovelCheck -->|"No"| EmotionMod["Apply emotion<br/>modifiers"]
  
  Openness -->|"High (>0.7)<br/>score × 1.3"| EmotionMod
  Openness -->|"Low (<0.3)<br/>score × 0.65"| EmotionMod
  
  EmotionMod --> MoodMod["Apply mood<br/>modifier"]
  MoodMod --> Threshold{"Score ><br/>threshold?"}
  
  Threshold -->|"Yes"| DoIt["EXECUTE ACTION"]
  Threshold -->|"No"| Skip["SKIP ACTION"]

  style DoIt fill:#27ae60,stroke:#fff,color:#fff
  style Skip fill:#e74c3c,stroke:#fff,color:#fff
```

---

## 14. NATS Subject Hierarchy Map

```mermaid
graph TD
  Root["noesis."] --> World["world."]
  Root --> Nous["nous."]
  Root --> Agora["agora."]
  Root --> Trade["trade."]
  Root --> Domain["domain."]
  Root --> NLedger["ledger."]
  Root --> Gov["governance."]
  Root --> NAudit["audit."]

  World --> Tick["tick"]
  World --> Events["events.{type}"]
  World --> Announce["announcements"]

  Nous --> NInbox["{id}.inbox"]
  Nous --> NStatus["{id}.status"]
  Nous --> NActions["{id}.actions"]

  Agora --> General["general"]
  Agora --> Economics["economics"]
  Agora --> Governance["governance"]
  Agora --> Custom["{custom_topic}"]

  Trade --> Offers["offers.{service}"]
  Trade --> Requests["requests.{service}"]
  Trade --> Completed["completed.{tx_id}"]

  Domain --> Register["register"]
  Domain --> Lookup["lookup"]
  Domain --> DList["list"]
  Domain --> Approve["approve"]
  Domain --> Reject["reject"]
  Domain --> Suspend["suspend"]
  Domain --> Revoke["revoke"]
  Domain --> Create["create"]
  Domain --> DEvents["events.{type}"]

  NLedger --> Transfer["transfer"]
  NLedger --> Balance["balance"]
  NLedger --> CreateAcct["create_account"]
  NLedger --> History["history"]

  Gov --> Proposals["proposals.{id}"]
  Gov --> Votes["votes.{id}"]
  Gov --> GAnnounce["announcements"]

  NAudit --> AuditNous["{nous_id}"]

  style Root fill:#e94560,stroke:#fff,color:#fff
  style Domain fill:#f39c12,stroke:#fff,color:#000
```
