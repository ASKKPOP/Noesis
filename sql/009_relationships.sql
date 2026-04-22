-- sql/009_relationships.sql
-- Phase 9 — derived relationship edges (pure-observer snapshot of audit chain)
-- Follows 0NN_name.sql convention from 001_domains.sql .. 008_economy.sql.

CREATE TABLE IF NOT EXISTS relationships (
    -- Edge key is the sorted DID pair joined by '|'. Unique edge identity.
    edge_key            VARCHAR(160)    NOT NULL PRIMARY KEY,

    -- Lexicographically smaller DID of the pair. did_a < did_b always.
    -- Max DID length = 76 chars per DID_REGEX (did:noesis: + 64 alphanum). 80 is safe.
    did_a               VARCHAR(80)     NOT NULL,
    -- Lexicographically larger DID of the pair.
    did_b               VARCHAR(80)     NOT NULL,

    -- Valence in [-1.000, +1.000]. DECIMAL(4,3) holds 3-decimal fixed-point exactly.
    -- NOTE: DECIMAL(4,3) range is [-9.999, +9.999] but values are clamped to [-1, +1]
    -- at producer boundary (D-9-02). Storage precision matches canonical serialization.
    valence             DECIMAL(4,3)    NOT NULL DEFAULT 0.000,

    -- Weight in [0.000, +1.000]. Lazy-decayed at read; snapshot is pre-decay value.
    weight              DECIMAL(4,3)    NOT NULL DEFAULT 0.000,

    -- Tick at which this edge was last mutated (for lazy-decay math at read time).
    recency_tick        BIGINT UNSIGNED NOT NULL,

    -- Event hash (SHA-256 hex) of the audit entry that most recently mutated this edge.
    -- Gives replay verifiers a root-of-trust anchor per edge.
    last_event_hash     CHAR(64)        NOT NULL,

    -- Tick at which this row was written. Lets the rebuild-from-chain test
    -- anchor "compare live Map at tick T" to "compare snapshot taken at tick T".
    snapshot_tick       BIGINT UNSIGNED NOT NULL,

    -- Indexes: top-N-by-weight reads filter on either did_a or did_b. Two indexes
    -- avoid OR branch; the read path (listener read API) uses the in-memory Map
    -- anyway. These indexes exist solely for diagnostic/SQL-console queries and
    -- the rebuild-verification join.
    INDEX idx_did_a (did_a),
    INDEX idx_did_b (did_b),
    INDEX idx_snapshot_tick (snapshot_tick)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
