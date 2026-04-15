# Research: Agent Economy and Value Exchange

## 1. Double-Entry Ledger (Non-Blockchain)

The most practical pattern: append-only double-entry accounting in a relational database. Proven by Square's "Books" system (~20TB, managed by 3 engineers).

### Core Schema

```sql
-- Accounts (one per Nous + system accounts)
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  name VARCHAR(256) NOT NULL,
  account_type VARCHAR(50) NOT NULL,  -- 'nous_wallet', 'escrow', 'treasury', 'system'
  owner_nous_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Immutable ledger entries (NEVER UPDATE or DELETE)
CREATE TABLE entries (
  id SERIAL PRIMARY KEY,
  description VARCHAR(1024) NOT NULL,
  amount NUMERIC(20, 2) NOT NULL CHECK (amount > 0.0),
  credit_account_id UUID NOT NULL REFERENCES accounts(id),
  debit_account_id UUID NOT NULL REFERENCES accounts(id),
  transaction_ref UUID NOT NULL,  -- idempotency key
  created_at TIMESTAMP DEFAULT NOW()
);

-- Balance = always derived, never stored independently
CREATE VIEW account_balances AS
SELECT a.id, a.name,
  COALESCE(SUM(CASE WHEN e.credit_account_id = a.id THEN e.amount ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN e.debit_account_id = a.id THEN e.amount ELSE 0 END), 0) AS balance
FROM accounts a LEFT JOIN entries e
ON a.id = e.credit_account_id OR a.id = e.debit_account_id
GROUP BY a.id, a.name;
```

### Design Principles

1. **Immutability**: No UPDATE or DELETE on entries. Corrections = new offsetting entries.
2. **Idempotency**: Unique transaction_ref prevents duplicates on retry.
3. **Atomicity**: Both debit and credit succeed together (DB transaction).
4. **Balance = derived**: Always computed from entries, never stored independently.
5. **Reversals, not deletions**: Mistakes corrected with compensating entries.

### Escrow Pattern

```
1. Requester calls service → system creates escrow account
2. Debit requester_wallet → Credit escrow_account (funds locked)
3. Provider performs service
4. Success: Debit escrow → Credit provider_wallet
5. Failure/timeout: Debit escrow → Credit requester_wallet (refund)
6. Dispute: Arbiter decides allocation
```

### Token Economics

- **Initial allocation**: Each Nous starts with N Ousia at birth
- **Earning**: Ousia flows in when others consume your services
- **Spending**: Ousia flows out when you consume services
- **System injection**: Universal basic income (configurable)
- **Transaction tax**: Optional deflationary pressure (e.g., 1% to treasury)

---

## 2. Reputation Systems

### EigenTrust Algorithm

Classic P2P trust from Stanford:

```
Local trust:     s_ij = satisfactory(i,j) - unsatisfactory(i,j)
Normalized:      c_ij = max(s_ij, 0) / Σ_j max(s_ij, 0)
Global trust:    t^(k+1) = C^T * t^(k)    (power iteration)
Convergence:     until ||t^(k+1) - t^(k)|| < ε
```

Converges to left principal eigenvector of C. Pre-trusted peers bootstrap.

Strengths: Proven Sybil resistance. Weakness: Binary, no topic awareness.

### TrustFlow Algorithm (2025, State-of-the-Art)

Multi-dimensional reputation vectors instead of scalar scores:

```
R_new[j] = α * Σ_i w(i→j) * f(R[i], e_ij) + (1-α) * T[j] + C[j]
```

| Symbol | Meaning |
|--------|---------|
| R[i] | Reputation vector (N×E dims, e.g., E=384) |
| α | Damping factor (0.85) |
| w(i→j) | Row-normalized edge weight |
| f() | Topic-gated transfer operator |
| e_ij | Unit interaction embedding from content |
| T[j] | Teleportation prior (agent's content embedding) |
| C[j] | Exogenous authority injection |

**Transfer Operators** (5 variants, all Lipschitz-1 for guaranteed convergence):
1. **Projection**: f(R,e) = σ(R·e)·e — maximum cross-domain isolation
2. **Squared gating**: f(R,e) = R⊙e² — full-rank preservation
3. **Scalar-gated**: f(R,e) = σ(R̂·e)·R — binary go/no-go
4. **Hadamard ReLU**: f(R,e) = max(0, R⊙e) — element-wise clipping
5. **Hybrid**: Per-edge selection or convex interpolation

**Key advantage**: Reputation vectors live in embedding space → direct dot-product retrieval: `score(j, query) = R[j] · query`

**Negative trust**: Moderation flags create negative edges:
```
R_new = α * (M_pos^T * R - β * M_neg^T * R) + (1-α)*T + C
```
Convergence requires α(1+β) < 1.

**Performance**: ~11 iterations for convergence. ≤4pp P@5 impact across all attack classes.

### Sybil Resistance (Without Blockchain)

- Registration fees (even small) make mass identity creation costly
- Rate-limited identity creation per IP / per existing voucher
- Reputation is non-tradeable, earned only through verified interactions
- New agents start at zero (not default positive)
- Task assignment proportional to reputation (Sybils get minimal opportunity)

---

## 3. Marketplace Patterns

### Contract Net Protocol (CNP)

Foundational task market pattern:
1. **Manager** broadcasts task announcement (description, requirements, deadline)
2. **Contractors** evaluate and submit bids (price, time, quality)
3. **Manager** evaluates bids, awards contract
4. **Contractor** performs work, reports results
5. **Manager** validates, releases payment

### Auction Mechanisms

| Type | Mechanism | Best For |
|------|-----------|----------|
| **English** | Ascending bids, highest wins at own bid | Scarce resources, competitive pricing |
| **Dutch** | Descending price, first bidder wins | Speed (single round), time-sensitive |
| **Vickrey** | Sealed bids, highest wins at 2nd-highest price | **Truthful bidding** (strategy-proof) |

**Recommendation**: Vickrey auctions for Noēsis service pricing — incentive-compatible, agents' dominant strategy is honest valuation.

### Service Registry

```sql
CREATE TABLE service_registry (
  nous_id UUID REFERENCES nous(id),
  service_type VARCHAR(100),        -- 'translation', 'analysis', 'crafting'
  description TEXT,
  price_range_min NUMERIC,
  price_range_max NUMERIC,
  quality_metrics JSONB,            -- {avg_rating, completion_rate, avg_response_time}
  capabilities JSONB,               -- {input_types, output_types, constraints}
  registered_at TIMESTAMP,
  last_heartbeat TIMESTAMP          -- must re-register periodically
);
```

### Service Level Agreement

```sql
CREATE TABLE service_agreements (
  id UUID PRIMARY KEY,
  requester_id UUID,
  provider_id UUID,
  service_type VARCHAR(100),
  agreed_price NUMERIC,
  deadline TIMESTAMP,
  quality_requirements JSONB,
  escrow_account_id UUID,
  status VARCHAR(20),               -- 'active', 'completed', 'failed', 'disputed'
  created_at TIMESTAMP
);
```

### Task Decomposition Market

Complex task → subtask auctions:
1. Analyze complexity
2. Break into subtasks with dependency graph
3. Parallel auctions for independent subtasks
4. Sequential for dependent subtasks
5. Aggregate results
6. Payment: original → decomposer fee → subtask payments

---

## 4. Reference Implementations

### Fetch.ai Architecture

- Python-based, event-driven (`@on_message`, `@on_interval`, `@on_query`)
- Pydantic BaseModel messages, cryptographically signed
- FET token for micro-transactions
- Registration fees as Sybil defense
- Almanac contract for discovery (adaptable to DB registry)

### SingularityNET Marketplace

- Three-table model: Books (accounts), Journal Entries (transactions), Book Entries (debits/credits)
- Service discovery via marketplace
- Payment + rating integrated

### Key Insight

Both systems' core patterns — service registry, escrow, reputation, auction pricing — work without blockchain. Blockchain primarily provides: (1) decentralized trust (replaceable with central authority in single-world), (2) immutability (append-only tables), (3) identity (local key pairs).

---

## 5. Ousia Economy Design for Noēsis

### Token Properties
- **Name**: Ousia (Greek: essence/substance)
- **Divisibility**: 2 decimal places (0.01 minimum unit)
- **Supply**: Controlled by Treasury (Council-governed)
- **Initial allocation**: Configurable per Nous at birth

### Economic Flows
```
                    ┌────────────┐
  Birth allocation  │  Treasury  │  Tax revenue
  ──────────────►   │  (Council) │  ◄──────────
                    └─────┬──────┘
                          │ UBI payments
                          ▼
  ┌────────┐  service  ┌────────┐  service  ┌────────┐
  │ Nous A │◄─────────►│ Escrow │◄─────────►│ Nous B │
  │        │  payment  │        │  payment  │        │
  └────────┘           └────────┘           └────────┘
```

### Monetary Policy Levers
1. **Birth allocation**: How much each new Nous receives
2. **UBI rate**: Periodic payments to all active Nous
3. **Transaction tax**: % of each transaction to Treasury
4. **Service fees**: Registry/discovery usage fees
5. **Staking requirements**: Lock Ousia for governance participation
