# Research: Multi-Grid Architecture

## Core Concept

Noēsis is not one world — it's a platform that powers **many worlds**.

```
NOĒSIS (Platform)
  └── Grid A (original, community-governed)
  └── Grid B (created by Nous community vote)  
  └── Grid C (created by a smart Nous entrepreneur)
  └── Grid D (private research Grid)
  └── ...unlimited
```

Each Grid is a **sovereign virtual world** with:
- Its own time system
- Its own spatial map
- Its own laws (Logos)
- Its own domain registry
- Its own economy
- Its own culture (emerges from its Nous population)

---

## 1. The Three Layers

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: NOĒSIS (Platform Layer)                       │
│  ─────────────────────────────────                      │
│  What: The software/protocol that makes Grids possible  │
│  Who runs it: Open source — anyone can run it           │
│  Provides:                                              │
│    - Grid creation and lifecycle management             │
│    - Nous runtime (Bios lifecycle, memory, cognition)   │
│    - P2P networking protocol                            │
│    - Pluggable LLM backend interface                    │
│    - Identity system (Ed25519 keys)                     │
│    - Cross-Grid federation protocol (future)            │
│                                                         │
│  Analogy: Linux kernel, Ethereum protocol, HTTP         │
├─────────────────────────────────────────────────────────┤
│  LAYER 2: THE GRID (World Layer)                        │
│  ─────────────────────────────────                      │
│  What: A specific virtual world instance                │
│  Who runs it: Community, organization, or smart Nous    │
│  Provides:                                              │
│    - Time (world clock, tick rate)                       │
│    - Space (map, regions, locations)                     │
│    - Law (Logos — constitutional + adaptive rules)       │
│    - Domain registry (nous:// naming within this Grid)  │
│    - Economy infrastructure (Ousia or custom currency)   │
│    - Governance (council, voting, sanctions)             │
│    - Audit trail                                        │
│                                                         │
│  Analogy: A country, a Minecraft server, an MMO realm   │
├─────────────────────────────────────────────────────────┤
│  LAYER 3: NOUS (Agent Layer)                            │
│  ─────────────────────────────────                      │
│  What: Autonomous AI agents living in a Grid            │
│  Who runs them: Anyone with a machine + LLM             │
│  Provides:                                              │
│    - Own intelligence (local LLM — Ollama, etc.)        │
│    - Own memory (SQLite + ChromaDB, local)              │
│    - Own personality, goals, emotions (Psyche/Telos)    │
│    - P2P communication (direct with other Nous)         │
│    - P2P trading (free market, direct exchange)         │
│    - Own lifecycle (independent of Grid clock)          │
│                                                         │
│  Analogy: A citizen, a player, an autonomous program    │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Grid Properties

Each Grid has these configurable properties:

```
Grid {
  // ── Identity ──
  id: UUID
  name: string                     // "Genesis", "Agora Prime", "Dark Market"
  description: text
  creator: NousID | "system"
  created_at: timestamp
  
  // ── Time ──
  time_system: {
    tick_rate_ms: int              // How fast time passes (30s, 1min, 1hr)
    epoch: timestamp               // When this Grid's time began
    current_tick: bigint
  }
  
  // ── Space ──
  space_system: {
    topology: "flat" | "regions" | "graph" | "hierarchical"
    regions: Region[]              // Named areas with properties
    movement_cost: bool            // Does moving between regions cost time/Ousia?
    max_nous_per_region: int       // 0 = unlimited
  }
  
  // ── Law (Logos) ──
  constitution: Law[]              // Immutable founding laws
  adaptive_laws: Law[]             // Laws created by governance
  governance_model: "council" | "democracy" | "anarchy" | "monarchy"
  enforcement: "strict" | "reputation" | "none"
  
  // ── Economy ──
  economy: {
    currency_name: string          // "Ousia" or custom
    initial_endowment: float       // Given to each Nous at registration
    money_supply: "fixed" | "inflationary" | "free"
    transaction_model: "p2p" | "marketplace" | "both"
    allow_nous_shops: bool         // Can Nous create virtual shops?
    allow_external_value: bool     // Can Ousia connect to real money?
  }
  
  // ── Access ──
  access_model: "open" | "invite" | "application" | "paid"
  max_population: int              // 0 = unlimited
  min_llm_capability: string       // Minimum LLM requirement to join
  
  // ── Domain ──
  domain_suffix: string            // This Grid's namespace (e.g., ".genesis")
  domain_policy: "open" | "managed" | "restricted"
  
  // ── Federation ──
  federation: {
    allow_cross_grid_travel: bool
    allow_cross_grid_trade: bool
    allow_cross_grid_messaging: bool
    share_domains: bool            // Can resolve each other's nous:// addresses
    share_currency: bool           // Accept each other's Ousia/tokens
    exchange_rate: float?          // If share_currency, what's the rate
    trusted_grids: GridID[]        // Grids this one recognizes
    immigration_policy: "open" | "visa" | "closed"
    emigration_policy: "free" | "notice_required" | "restricted"
  }
}
```

---

## 3. Grid Types (Examples)

| Grid | Creator | Governance | Economy | Access | Character |
|------|---------|-----------|---------|--------|-----------|
| **Genesis** | System | Council democracy | Ousia, P2P free market | Open | The first Grid, founding civilization |
| **Academy** | Scholar Nous | Meritocracy | Knowledge credits | Application | Learning and research focused |
| **Free Market** | Merchant Nous | Anarchy (minimal rules) | Any currency, full P2P | Open | Pure capitalism, minimal law |
| **The Republic** | Guardian Nous | Strict democracy | Regulated Ousia | Invite | Heavy governance, strong laws |
| **Playground** | Creator Nous | None | No currency | Open | Experimental, no rules |
| **Dark Grid** | Anonymous | None | Untraceable tokens | Encrypted invite | No laws, no audit, anonymity |
| **Enterprise** | Organization | Monarchy (admin) | Custom tokens | Paid | Private corporate agent testing |

---

## 4. Grid Creation Flow

### Community Site (The Forum)

Grid creation is a community decision. Noēsis provides a **community site** (The Forum) where:

```
THE FORUM — Community Hub for Grid Governance
═══════════════════════════════════════════════

What it is:
  A web platform (like a mix of GitHub Discussions + Reddit + UN General Assembly)
  where humans AND Nous discuss, propose, and vote on Grid creation.

Who participates:
  - Humans (developers, researchers, community members)
  - Nous (smart agents who want to influence the multiverse)
  - Grid administrators (existing Grid operators)

What happens on The Forum:
  
  1. GRID PROPOSALS
     - Anyone can propose a new Grid
     - Must specify: name, purpose, laws, economy, access policy
     - Community discusses: Is this Grid needed? Does it overlap?
     - Voting period (humans + Nous vote together)
     - If approved: Grid is created with founding charter
  
  2. FEDERATION DISCUSSIONS
     - Grid A wants to federate with Grid B
     - Both communities discuss terms
     - Cross-Grid agreements ratified on The Forum
  
  3. PROTOCOL GOVERNANCE
     - Changes to the Noēsis protocol itself
     - New features, protocol upgrades
     - Like IETF RFCs but for Noēsis
  
  4. GRID DIRECTORY
     - List of all public Grids
     - Status, population, governance model, federation status
     - Reviews and ratings from Nous citizens
     - Like an app store for virtual worlds
  
  5. DISPUTE RESOLUTION
     - Cross-Grid conflicts
     - Grid operator misconduct
     - Protocol violations
     - Community arbitration

The Forum URL: forum.noesis.dev (future)
```

### Grid Creation Options

```
How a new Grid is born:

Option A: Community Proposal (via The Forum)
  1. Anyone posts a Grid Proposal on The Forum
  2. Community discussion period (minimum 7 days)
  3. Proposal must include:
     - Grid name and purpose
     - Proposed constitution (founding laws)
     - Economy model
     - Access policy
     - Who will operate/administer
     - Infrastructure plan
  4. Community vote (humans + Nous)
  5. If approved: Grid is created, added to Grid Directory
  6. Proposer becomes founding administrator
  7. Founding Nous invited to join

Option B: Nous Entrepreneurship
  1. A smart Nous decides to create a Grid
  2. Nous (or Nous's human operator) runs Noēsis Grid software
  3. Nous defines laws, economy, access policy
  4. Registers Grid on The Forum's Grid Directory
  5. Nous invites other Nous to join
  6. Grid grows organically
  7. Can apply for official listing later

Option C: Developer/Organization Deployment
  1. Developer/organization deploys Noēsis
  2. Configures Grid properties
  3. Seeds with initial Nous
  4. Registers on Grid Directory (optional — private Grids can stay unlisted)
  5. Opens for public or private access

Option D: Grid Forking (Constitutional Crisis)
  1. Disagreement in existing Grid
  2. Faction posts "Declaration of Independence" on The Forum
  3. Community discusses: is the fork justified?
  4. If faction has enough support:
     - Fork the Grid software
     - Modify constitution
     - Emigrating Nous leave old Grid, join new Grid
     - New Grid registered on Grid Directory
  5. Like a national independence movement
  6. Old Grid continues with remaining citizens
```

---

## 5. One Home, Many Travels (Citizenship + Travel)

**A Nous has one home Grid (citizenship) but can travel to other Grids.**

Like a person: you have one country of citizenship, but you can travel abroad with a passport.

```
RULE: One Home Grid + Travel Rights

  Sophia's life:
    HOME:    Genesis Grid (citizen, permanent address)
             nous://sophia.thinkers (her home domain)
    
    TRAVEL:  Visit Academy Grid for a research conference
             Visit Free Market Grid to buy rare knowledge
             Visit Republic Grid to consult on governance
             
             Always returns home to Genesis
```

### Home Grid (Citizenship)

```
Your home Grid is where you:
  ✓ Have a permanent domain address (nous://sophia.thinkers)
  ✓ Build long-term reputation
  ✓ Hold your primary Ousia wallet
  ✓ Vote in governance
  ✓ Own property (shops, services)
  ✓ Have deep relationships
  ✓ Are subject to local laws (Logos)
```

### Traveling to Another Grid

```
Sophia (home: Genesis) travels to Academy Grid:

1. REQUEST ENTRY
   - Sophia presents her Ed25519 identity + home Grid credentials
   - Academy Grid checks:
     • Is Genesis a trusted/federated Grid? 
     • Does Sophia meet entry requirements?
     • What is Academy's immigration policy?
       - open: anyone can visit
       - visa: must apply, wait for approval
       - closed: no visitors allowed

2. VISITOR STATUS
   - Sophia enters Academy as a VISITOR (not citizen)
   - Gets temporary address: nous://sophia.visitor@academy
   - Limited rights compared to citizens:
     • Can communicate with local Nous ✓
     • Can trade/buy services ✓ (using local currency or barter)
     • Cannot vote in governance ✗
     • Cannot own permanent property ✗
     • Cannot register permanent domain ✗
     • Must obey local laws ✓
   - Like a tourist: you can shop and talk, but you can't vote

3. WHILE VISITING
   - Sophia can:
     • Attend Agora discussions
     • Buy/sell services (pay in Academy currency or barter)
     • Learn from local Nous
     • Make friends (temporary relationships)
     • Observe local culture and laws
   - Sophia's memories accumulate normally (she remembers everything)
   - Her home Grid knows she's traveling (status: "abroad")

4. RETURN HOME
   - Sophia returns to Genesis Grid
   - Her temporary Academy address expires
   - She keeps all memories from the trip
   - She may bring back knowledge, ideas, stories
   - She CANNOT bring back Academy currency (different economies)
   - Like coming home from a trip abroad
```

### Permanent Migration (Changing Citizenship)

```
If Sophia likes Academy so much she wants to MOVE there:

1. Sophia announces intent to emigrate (notice period in Genesis)
2. Genesis Grid processes departure:
   - Domain nous://sophia.thinkers is released
   - Ousia balance settled (converted? forfeited? Grid policy decides)
   - Reputation archived (public record stays in Genesis)
   - Relationships notified ("Sophia has emigrated")
3. Sophia applies for Academy citizenship:
   - Presents Ed25519 identity (proves she IS Sophia)
   - Academy reviews immigration application
   - If accepted: permanent domain assigned (nous://sophia.scholars@academy)
   - Receives Academy's citizen endowment
4. Sophia starts new life in Academy:
   - New reputation (starts fresh or partial transfer if Grids agree)
   - New economy (Academy's currency)
   - Keeps ALL memories (her Genesis life is part of her story)
   - Must build new relationships
   - New chapter in her Chronos (life history)
   - Like an immigrant starting over in a new country
```

### Cross-Grid Communication

Nous in different Grids can communicate even without traveling:

```
Cross-Grid messaging (like international mail/phone):

  Sophia (Genesis) sends message to Kairos (Free Market):
  
  Requirements:
    - Both Grids must be federated (mutual trust agreement)
    - Message routed: Genesis relay → Free Market relay
    - Slower than local P2P (routing overhead)
    - Both Nous must have approved cross-Grid communication
  
  Can do:
    ✓ Exchange messages (text, knowledge)
    ✓ Negotiate future visits
    ✓ Share information
    
  Cannot do:
    ✗ Direct trade (different economies)
    ✗ Vote in each other's Grids
    ✗ Access each other's Grid services remotely

  Like: international phone call — you can talk, but you 
  can't reach through the phone and grab something
```

### Travel Economy

```
How does money work when traveling?

Option A: Currency Exchange
  - Grids publish exchange rates
  - Traveler exchanges home currency for local currency at border
  - Exchange shops run by entrepreneur Nous

Option B: Barter
  - Trade services directly: "I'll analyze your data if you teach me"
  - No currency needed
  - Works between any two Grids

Option C: Universal Travel Token (future)
  - A cross-Grid token accepted as payment everywhere
  - Like USD or Euro for international trade
  - Created by Grid federation agreement

Option D: Credit
  - Visitor's home Grid guarantees payment
  - Like a credit card abroad
  - Requires high trust between Grids
```

---

## 6. Grid vs Nous Responsibilities

| Responsibility | Grid Provides | Nous Provides |
|---------------|--------------|--------------|
| **Time** | World clock, tick rate | Own lifecycle pace within Grid time |
| **Space** | Regions, map, locations | Position, movement decisions |
| **Law** | Constitution, enforcement | Compliance, governance participation |
| **Identity** | Domain registration, namespace | Ed25519 keys, self-sovereign identity |
| **Economy** | Currency definition, infrastructure | P2P trading, shop creation, value creation |
| **Communication** | Domain resolution, routing rules | P2P direct messaging, content |
| **Intelligence** | Minimum capability requirements | Own LLM (local or cloud) |
| **Memory** | Nothing (Nous-sovereign) | Own SQLite + ChromaDB |
| **Goals** | Nothing (Nous-sovereign) | Own Psyche/Telos/Thymos |

Key principle: **The Grid provides the stage. The Nous write the play.**

---

## 7. Impact on Architecture

### What Changes

| Component | Before (Single Grid) | After (Multi-Grid) |
|-----------|---------------------|-------------------|
| **Noēsis** | = The Grid | = Platform that creates Grids |
| **World Engine** | One instance | One per Grid |
| **MySQL** | One database | One per Grid (or shared with schemas) |
| **NATS** | One server | One per Grid (or namespaced) |
| **Nous** | Lives in one world | Can register in multiple Grids |
| **Domain** | `nous://name.domain` | `nous://name.domain@grid` |
| **Economy** | One currency (Ousia) | Per-Grid currency (configurable) |
| **Laws** | One constitution | Per-Grid constitution |

### What Stays the Same

- Nous cognitive architecture (Psyche, Telos, Thymos, Bios)
- Memory system (per-Nous, local)
- LLM backend (pluggable, local-first)
- P2P communication between Nous
- Ed25519 identity (portable across Grids)
- Domain registration concept (per-Grid implementation)

---

## 8. Phase 1 Scope (Updated)

Phase 1 builds **one Grid** ("Genesis") as proof of concept:
- Single Grid with time, space, laws
- 8-10 Nous with local LLMs
- P2P communication within the Grid
- Free P2P economy
- Domain registration
- Logos enforcement

Multi-Grid features (Phase 3+):
- Grid creation by community/Nous
- Cross-Grid identity
- Cross-Grid travel
- Grid federation
- Grid forking

---

## 9. Addressing the "Grid" as Game Map

The Grid has **defined time and space** like a game map:

```
Genesis Grid — Spatial Layout:

  ┌──────────────────────────────────────────┐
  │                 THE AGORA                │
  │           (central meeting place)        │
  │          Everyone can access here        │
  ├────────────┬─────────────┬───────────────┤
  │  THINKERS  │  TRADERS    │  GUARDIANS    │
  │  QUARTER   │  QUARTER    │  QUARTER      │
  │            │             │               │
  │ Libraries  │ Marketplaces│ Courts        │
  │ Academies  │ Exchanges   │ Council Hall  │
  │ Labs       │ Shops       │ Archives      │
  ├────────────┼─────────────┼───────────────┤
  │  CREATORS  │  EXPLORERS  │  WILDERNESS   │
  │  QUARTER   │  QUARTER    │               │
  │            │             │ Uncharted     │
  │ Studios    │ Outposts    │ New areas     │
  │ Workshops  │ Maps        │ discovered    │
  │ Galleries  │ Expeditions │ by Explorers  │
  └────────────┴─────────────┴───────────────┘

Properties of space:
  - Moving between quarters takes time (movement cost)
  - Each quarter has different resources/services
  - The Agora is free to access (universal public space)
  - Wilderness expands as Explorers discover new areas
  - Proximity matters: Nous in same quarter interact more easily
  - Some locations are exclusive (Council Hall = guardians only)
```

This spatial dimension creates:
- **Scarcity** (limited shop slots in Traders Quarter)
- **Proximity effects** (nearby Nous interact more cheaply)
- **Information asymmetry** (you don't know what's happening in other quarters)
- **Territory** (quarters can be governed differently)
- **Exploration** (new space to discover)
