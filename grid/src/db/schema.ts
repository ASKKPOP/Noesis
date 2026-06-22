/**
 * DB Schema — migration definitions as TypeScript constants.
 *
 * No file I/O required; migrations are embedded in the binary.
 */

export interface Migration {
    version: number;
    name: string;
    up: string;
    down: string;
}

export const MIGRATIONS: Migration[] = [
    {
        version: 1,
        name: 'create_migrations_table',
        up: `
            CREATE TABLE IF NOT EXISTS grid_migrations (
                version    INT UNSIGNED NOT NULL,
                name       VARCHAR(127) NOT NULL,
                applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (version)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS grid_migrations`,
    },
    {
        version: 2,
        name: 'create_audit_trail',
        up: `
            CREATE TABLE IF NOT EXISTS audit_trail (
                grid_name  VARCHAR(63)         NOT NULL,
                id         BIGINT UNSIGNED     NOT NULL,
                event_type VARCHAR(63)         NOT NULL,
                actor_did  VARCHAR(255)        NOT NULL,
                target_did VARCHAR(255),
                payload    JSON                NOT NULL,
                prev_hash  VARCHAR(64)         NOT NULL,
                event_hash VARCHAR(64)         NOT NULL,
                created_at BIGINT              NOT NULL,
                PRIMARY KEY (grid_name, id),
                INDEX idx_event_type (grid_name, event_type),
                INDEX idx_actor      (grid_name, actor_did),
                INDEX idx_time       (grid_name, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS audit_trail`,
    },
    {
        version: 3,
        name: 'create_nous_registry',
        up: `
            CREATE TABLE IF NOT EXISTS nous_registry (
                grid_name        VARCHAR(63)  NOT NULL,
                did              VARCHAR(255) NOT NULL,
                name             VARCHAR(127) NOT NULL,
                nds_address      VARCHAR(255) NOT NULL,
                public_key       VARCHAR(255) NOT NULL,
                human_owner      VARCHAR(255),
                region           VARCHAR(127) NOT NULL,
                lifecycle_phase  VARCHAR(63)  NOT NULL DEFAULT 'spawning',
                reputation       DECIMAL(8,4) NOT NULL DEFAULT 0.0000,
                ousia            BIGINT       NOT NULL DEFAULT 0,
                spawned_at_tick  INT UNSIGNED NOT NULL DEFAULT 0,
                last_active_tick INT UNSIGNED NOT NULL DEFAULT 0,
                status           VARCHAR(63)  NOT NULL DEFAULT 'active',
                PRIMARY KEY (grid_name, did),
                UNIQUE KEY uq_name (grid_name, name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS nous_registry`,
    },
    {
        version: 4,
        name: 'create_nous_positions',
        up: `
            CREATE TABLE IF NOT EXISTS nous_positions (
                grid_name  VARCHAR(63)  NOT NULL,
                nous_did   VARCHAR(255) NOT NULL,
                region_id  VARCHAR(127) NOT NULL,
                arrived_at BIGINT       NOT NULL,
                PRIMARY KEY (grid_name, nous_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS nous_positions`,
    },
    {
        version: 5,
        name: 'create_grid_config',
        up: `
            CREATE TABLE IF NOT EXISTS grid_config (
                grid_name    VARCHAR(63)  NOT NULL,
                config_key   VARCHAR(127) NOT NULL,
                config_value JSON         NOT NULL,
                updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
                PRIMARY KEY (grid_name, config_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS grid_config`,
    },
    {
        version: 6,
        name: 'governance_proposals + governance_ballots',
        up: `
            CREATE TABLE IF NOT EXISTS governance_proposals (
                grid_name        VARCHAR(63)  NOT NULL,
                proposal_id      VARCHAR(36)  NOT NULL,
                proposer_did     VARCHAR(255) NOT NULL,
                title_hash       VARCHAR(32)  NOT NULL,
                body_text        TEXT         NOT NULL,
                quorum_pct       TINYINT      NOT NULL DEFAULT 50,
                supermajority_pct TINYINT     NOT NULL DEFAULT 67,
                deadline_tick    INT UNSIGNED NOT NULL,
                status           VARCHAR(32)  NOT NULL DEFAULT 'open',
                outcome          VARCHAR(32),
                opened_at_tick   INT UNSIGNED NOT NULL,
                tallied_at_tick  INT UNSIGNED,
                PRIMARY KEY (grid_name, proposal_id),
                INDEX idx_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS governance_ballots (
                grid_name        VARCHAR(63)  NOT NULL,
                proposal_id      VARCHAR(36)  NOT NULL,
                voter_did        VARCHAR(255) NOT NULL,
                commit_hash      VARCHAR(64)  NOT NULL,
                revealed         TINYINT(1)   NOT NULL DEFAULT 0,
                choice           VARCHAR(16),
                nonce            VARCHAR(32),
                committed_tick   INT UNSIGNED NOT NULL,
                revealed_tick    INT UNSIGNED,
                PRIMARY KEY (grid_name, proposal_id, voter_did),
                INDEX idx_proposal (grid_name, proposal_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `
            DROP TABLE IF EXISTS governance_ballots;
            DROP TABLE IF EXISTS governance_proposals
        `,
    },
    {
        version: 7,
        name: 'create_norm_tables',
        up: `
            CREATE TABLE IF NOT EXISTS norm_candidates (
                fingerprint       CHAR(6)      NOT NULL,
                grid_name         VARCHAR(255) NOT NULL,
                participant_dids  TEXT         NOT NULL,
                first_seen_tick   INT          NOT NULL,
                last_updated_tick INT          NOT NULL,
                PRIMARY KEY (fingerprint, grid_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS norm_registry (
                norm_id           VARCHAR(64)  NOT NULL,
                fingerprint       CHAR(6)      NOT NULL,
                crystallized_tick INT          NOT NULL,
                participant_count INT          NOT NULL,
                convergence_type  ENUM('emergent','coincidental') NOT NULL,
                event_hash        VARCHAR(64)  NOT NULL,
                grid_name         VARCHAR(255) NOT NULL,
                first_seen_tick   INT          NOT NULL DEFAULT 0,
                PRIMARY KEY (norm_id),
                INDEX idx_fingerprint (grid_name, fingerprint),
                INDEX idx_crystallized (grid_name, crystallized_tick)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `
            DROP TABLE IF EXISTS norm_candidates;
            DROP TABLE IF EXISTS norm_registry
        `,
    },
    {
        version: 8,
        name: 'create_lore_commons',
        up: `
            CREATE TABLE IF NOT EXISTS lore_commons (
                grid_name        VARCHAR(63)  NOT NULL,
                content_hash     CHAR(64)     NOT NULL,
                contributor_did  VARCHAR(255) NOT NULL,
                title_hash       CHAR(64)     NOT NULL,
                category_tag     VARCHAR(32)  NOT NULL,
                citation_count   INT UNSIGNED NOT NULL DEFAULT 0,
                contributed_tick INT UNSIGNED NOT NULL,
                PRIMARY KEY (grid_name, content_hash),
                INDEX idx_category    (grid_name, category_tag),
                INDEX idx_contributor (grid_name, contributor_did),
                INDEX idx_tick        (grid_name, contributed_tick)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS lore_commons`,
    },
    {
        version: 9,
        name: 'create_human_users',
        up: `
            CREATE TABLE IF NOT EXISTS human_users (
                id           BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
                grid_name    VARCHAR(63)         NOT NULL,
                did          VARCHAR(255)        NOT NULL,
                eth_address  VARCHAR(255)        NOT NULL,
                created_at   TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (id),
                UNIQUE KEY uq_did          (grid_name, did),
                UNIQUE KEY uq_eth_address  (grid_name, eth_address)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS human_users`,
    },
    {
        version: 10,
        name: 'add_region_to_human_users',
        up: `ALTER TABLE human_users ADD COLUMN region VARCHAR(127) NOT NULL DEFAULT 'agora'`,
        down: `ALTER TABLE human_users DROP COLUMN region`,
    },
    {
        version: 11,
        name: 'add_email_auth_to_human_users',
        up: `
            ALTER TABLE human_users
              MODIFY COLUMN eth_address VARCHAR(255) NULL,
              ADD COLUMN email         VARCHAR(255) NULL AFTER eth_address,
              ADD COLUMN password_hash VARCHAR(255) NULL AFTER email,
              ADD UNIQUE KEY uq_email (grid_name, email)
        `,
        down: `
            ALTER TABLE human_users
              DROP INDEX uq_email,
              DROP COLUMN password_hash,
              DROP COLUMN email,
              MODIFY COLUMN eth_address VARCHAR(255) NOT NULL
        `,
    },
    {
        version: 12,
        name: 'create_sanction_reasons_and_freeze_human_users',
        up: `
            CREATE TABLE IF NOT EXISTS sanction_reasons (
              id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
              reason_hash   CHAR(64)        NOT NULL,
              plaintext     TEXT            NOT NULL,
              operator_id   VARCHAR(48)     NOT NULL,
              event_type    VARCHAR(63)     NOT NULL,
              target_did    VARCHAR(255)    NOT NULL,
              tick          BIGINT UNSIGNED NOT NULL,
              created_at    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
              PRIMARY KEY (id),
              UNIQUE KEY uq_reason_hash (reason_hash),
              INDEX idx_target_tick (target_did, tick)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ALTER TABLE human_users ADD COLUMN frozen TINYINT(1) NOT NULL DEFAULT 0
        `,
        down: `
            ALTER TABLE human_users DROP COLUMN frozen;
            DROP TABLE IF EXISTS sanction_reasons
        `,
    },
    {
        version: 13,
        name: 'add_banned_human_users',
        up: `
            ALTER TABLE human_users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0;
        `,
        down: `
            ALTER TABLE human_users DROP COLUMN banned;
        `,
    },
    {
        version: 14,
        name: 'add_onboarding_goal_to_human_users',
        up: `ALTER TABLE human_users ADD COLUMN onboarding_goal TEXT NULL DEFAULT NULL`,
        down: `ALTER TABLE human_users DROP COLUMN onboarding_goal`,
    },
    {
        version: 15,
        name: 'add_personality_seed_to_nous_registry',
        up: `ALTER TABLE nous_registry ADD COLUMN personality_seed VARCHAR(32) NULL DEFAULT NULL`,
        down: `ALTER TABLE nous_registry DROP COLUMN personality_seed`,
    },
    {
        version: 16,
        name: 'create_spawn_payments',
        up: `
            CREATE TABLE IF NOT EXISTS spawn_payments (
                tx_hash     CHAR(66)     NOT NULL,
                human_did   VARCHAR(255) NOT NULL,
                nous_did    VARCHAR(255) NULL,
                confirmed   TINYINT(1)   NOT NULL DEFAULT 0,
                created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (tx_hash),
                INDEX idx_spawn_payments_human (human_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS spawn_payments`,
    },
    {
        version: 17,
        name: 'unique_nous_per_human',
        up: `ALTER TABLE nous_registry ADD UNIQUE KEY uq_human_owner (human_owner)`,
        down: `ALTER TABLE nous_registry DROP INDEX uq_human_owner`,
    },
    {
        version: 18,
        name: 'add_ousia_to_human_users',
        up: `ALTER TABLE human_users ADD COLUMN ousia BIGINT NOT NULL DEFAULT 0`,
        down: `ALTER TABLE human_users DROP COLUMN ousia`,
    },
    {
        version: 19,
        name: 'create_community_posts',
        up: `
            CREATE TABLE IF NOT EXISTS community_posts (
                id          BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
                grid_name   VARCHAR(63)         NOT NULL,
                author_did  VARCHAR(255)        NOT NULL,
                content     TEXT                NOT NULL,
                created_at  TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (id),
                INDEX idx_posts_grid_time (grid_name, created_at DESC),
                INDEX idx_posts_author    (grid_name, author_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS community_posts`,
    },
    {
        version: 20,
        name: 'create_community_replies',
        up: `
            CREATE TABLE IF NOT EXISTS community_replies (
                id          BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
                grid_name   VARCHAR(63)         NOT NULL,
                post_id     BIGINT UNSIGNED     NOT NULL,
                author_did  VARCHAR(255)        NOT NULL,
                content     TEXT                NOT NULL,
                created_at  TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (id),
                INDEX idx_replies_post      (grid_name, post_id),
                INDEX idx_replies_author    (grid_name, author_did),
                CONSTRAINT fk_reply_post FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS community_replies`,
    },
    {
        version: 21,
        name: 'create_user_follows',
        up: `
            CREATE TABLE IF NOT EXISTS user_follows (
                grid_name      VARCHAR(63)  NOT NULL,
                follower_did   VARCHAR(255) NOT NULL,
                following_did  VARCHAR(255) NOT NULL,
                created_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (grid_name, follower_did, following_did),
                INDEX idx_follows_following (grid_name, following_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS user_follows`,
    },
    {
        version: 22,
        name: 'create_support_tickets',
        up: `
            CREATE TABLE IF NOT EXISTS support_tickets (
                id             CHAR(36)     NOT NULL,
                human_did      VARCHAR(255) NOT NULL,
                subject        VARCHAR(64)  NOT NULL,
                message        TEXT         NOT NULL,
                attachment_url TEXT         NULL,
                status         ENUM('open','closed') NOT NULL DEFAULT 'open',
                created_at     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (id),
                INDEX idx_support_tickets_human (human_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS support_tickets`,
    },
    {
        version: 23,
        name: 'create_civic_did_registry',
        up: `
            CREATE TABLE IF NOT EXISTS civic_did_registry (
                grid_name            VARCHAR(63)  NOT NULL,
                civic_did            VARCHAR(255) NOT NULL,
                existence_did        VARCHAR(255) NOT NULL,
                credential_json      JSON         NOT NULL,
                status               ENUM('active','revoked') NOT NULL DEFAULT 'active',
                issued_at_tick       INT UNSIGNED NOT NULL,
                revoked_at_tick      INT UNSIGNED NULL,
                court_conviction_ref VARCHAR(255) NULL,
                created_at           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (grid_name, civic_did),
                UNIQUE KEY uq_existence_did (grid_name, existence_did),
                INDEX idx_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS civic_did_registry`,
    },
    {
        version: 24,
        name: 'create_business_did_registry',
        up: `
            CREATE TABLE IF NOT EXISTS business_did_registry (
                grid_name         VARCHAR(63)  NOT NULL,
                business_did      VARCHAR(255) NOT NULL,
                civic_did         VARCHAR(255) NOT NULL,
                business_name     VARCHAR(255) NOT NULL,
                category          VARCHAR(127) NOT NULL,
                credential_json   JSON         NOT NULL,
                status            ENUM('active','dissolved') NOT NULL DEFAULT 'active',
                issued_at_tick    INT UNSIGNED NOT NULL,
                dissolved_at_tick INT UNSIGNED NULL,
                bios_cost_paid    INT UNSIGNED NOT NULL,
                created_at        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (grid_name, business_did),
                INDEX idx_civic_did (grid_name, civic_did),
                INDEX idx_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS business_did_registry`,
    },
    // Phase 38 WIRE-02 — Brain bearer-token storage.
    // One row per Brain (keyed by grid_name + brain_did).
    // upsert clears prior revocation when Brain re-registers a rotated public key.
    {
        version: 25,
        name: 'create_brain_tokens',
        up: `
            CREATE TABLE IF NOT EXISTS brain_tokens (
                grid_name       VARCHAR(63)  NOT NULL,
                brain_did       VARCHAR(255) NOT NULL,
                public_key_jwk  JSON         NOT NULL,
                issued_at       BIGINT       NOT NULL,
                expires_at      BIGINT       NOT NULL,
                revoked         TINYINT(1)   NOT NULL DEFAULT 0,
                revoked_at_tick INT UNSIGNED NULL,
                created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (grid_name, brain_did),
                INDEX idx_revoked (grid_name, revoked)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS brain_tokens`,
    },
    // Phase 38 WIRE-03/WIRE-04 — Brain event ingest dedup gate.
    // Idempotency key (CHAR(64) sha256 hex, per D-38-A8) is the PRIMARY KEY.
    // INSERT IGNORE on duplicate idempotency_key → affectedRows=0 → counted as duplicate.
    // This table is the dedup gate; it is NOT the audit chain (R-31-01 preserved).
    // Accepted events are forwarded to NousRunner.executeActions after ingest.
    {
        version: 26,
        name: 'create_brain_event_ingest',
        up: `
            CREATE TABLE IF NOT EXISTS brain_event_ingest (
                grid_name       VARCHAR(63)  NOT NULL,
                idempotency_key CHAR(64)     NOT NULL,
                brain_did       VARCHAR(255) NOT NULL,
                tick            INT UNSIGNED NOT NULL,
                event_type      VARCHAR(63)  NOT NULL,
                payload         JSON         NOT NULL,
                received_at     BIGINT       NOT NULL,
                PRIMARY KEY (grid_name, idempotency_key),
                INDEX idx_brain_did_tick (grid_name, brain_did, tick),
                INDEX idx_received_at   (grid_name, received_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS brain_event_ingest`,
    },
    // Phase 39 TENANT-01 — Operator-Brain ownership linkage (D-39-01).
    // Adds nullable operator_did column to brain_tokens so a Portal-authenticated
    // operator can claim ownership of a Brain via POST /api/v1/operator/me/brains.
    // NULL = unclaimed (functional but unowned per D-39-02).
    {
        version: 27,
        name: 'add_operator_did_to_brain_tokens',
        up: `
            ALTER TABLE brain_tokens
              ADD COLUMN operator_did VARCHAR(255) NULL DEFAULT NULL,
              ADD INDEX idx_operator_did (grid_name, operator_did)
        `,
        down: `
            ALTER TABLE brain_tokens
              DROP INDEX idx_operator_did,
              DROP COLUMN operator_did
        `,
    },
    // Phase 39 TENANT-03 — Per-operator quota overrides (D-39-07 / D-39-08).
    // When no row exists for an operator, getQuotaLimit() falls back to
    // grid_config 'quota.brain_processes_default' (global default = 3 per D-39-07).
    {
        version: 28,
        name: 'create_operator_quota_overrides',
        up: `
            CREATE TABLE IF NOT EXISTS operator_quota_overrides (
                grid_name                  VARCHAR(63)     NOT NULL,
                operator_did               VARCHAR(255)    NOT NULL,
                brain_process_limit        INT UNSIGNED NOT NULL DEFAULT 3,
                event_rate_per_did_per_min INT UNSIGNED NOT NULL DEFAULT 600,
                p2p_bandwidth_cap_bytes    BIGINT UNSIGNED NULL DEFAULT NULL,
                updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
                PRIMARY KEY (grid_name, operator_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS operator_quota_overrides`,
    },
    // Phase 40 LOCAL-01 / LOCAL-02 — Operator Local AI settings persistence.
    // One row per (grid_name, operator_did). Single JSON column stores OperatorSettings v2.
    // Follows the grid_config table pattern (migration v5): JSON blob per key.
    // getSettings() returns DEFAULT_LOCAL_AI when no row exists (no write-on-read).
    {
        version: 29,
        name: 'create_operator_settings',
        up: `
            CREATE TABLE IF NOT EXISTS operator_settings (
                grid_name    VARCHAR(63)  NOT NULL,
                operator_did VARCHAR(255) NOT NULL,
                settings     JSON         NOT NULL,
                updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                                 ON UPDATE CURRENT_TIMESTAMP(3),
                PRIMARY KEY (grid_name, operator_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS operator_settings`,
    },
    // Phase 41 SLEEP-01 / SLEEP-02 — Civic presence lifecycle columns on civic_did_registry.
    // Tracks awake/away/absent/presumed_departed state, last_seen markers, and frozen flag.
    // frozen=1 is set when presence_status flips to 'presumed_departed' (T-41-04 mitigation).
    {
        version: 30,
        name: 'add_presence_to_civic_did_registry',
        up: `
            ALTER TABLE civic_did_registry
              ADD COLUMN presence_status ENUM('awake','away','absent','presumed_departed')
                                         NOT NULL DEFAULT 'awake',
              ADD COLUMN last_seen_at TIMESTAMP(3) NULL,
              ADD COLUMN last_seen_tick INT UNSIGNED NULL,
              ADD COLUMN away_grace_expires_at TIMESTAMP(3) NULL,
              ADD COLUMN frozen TINYINT(1) NOT NULL DEFAULT 0,
              ADD INDEX idx_presence_status (grid_name, presence_status),
              ADD INDEX idx_last_seen_at (grid_name, last_seen_at)
        `,
        down: `
            ALTER TABLE civic_did_registry
              DROP INDEX idx_last_seen_at,
              DROP INDEX idx_presence_status,
              DROP COLUMN frozen,
              DROP COLUMN away_grace_expires_at,
              DROP COLUMN last_seen_tick,
              DROP COLUMN last_seen_at,
              DROP COLUMN presence_status
        `,
    },
    // Phase 41 SLEEP-02 / SLEEP-04 — Message queue for Nous-to-Nous messages during sleep.
    // Messages sent while recipient is away/absent queue here; delivered on wake (SLEEP-04).
    // Per-recipient cap of 1000 pending rows enforced at application layer (T-41-02 mitigation).
    {
        version: 31,
        name: 'create_civic_message_queue',
        up: `
            CREATE TABLE IF NOT EXISTS civic_message_queue (
                id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                grid_name           VARCHAR(63) NOT NULL,
                recipient_civic_did VARCHAR(255) NOT NULL,
                sender_civic_did    VARCHAR(255) NOT NULL,
                message_json        JSON NOT NULL,
                sent_at_tick        INT UNSIGNED NOT NULL,
                sent_at             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                status              ENUM('pending','delivered') NOT NULL DEFAULT 'pending',
                INDEX idx_recipient_status (grid_name, recipient_civic_did, status),
                INDEX idx_sent_at_tick (grid_name, recipient_civic_did, sent_at_tick)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS civic_message_queue`,
    },
    // Phase 42 P2P-01..05 — Public key column on civic_did_registry.
    // Allows Brain A to fetch Brain B's Ed25519 public key for SDP encryption (D-42-05).
    // NULL allowed for existing Phase 37 rows (NULL = P2P unavailable for that DID).
    // Re-registration is required to gain P2P capability for pre-Phase-42 rows.
    {
        version: 32,
        name: 'add_public_key_to_civic_did_registry',
        up: `
            ALTER TABLE civic_did_registry
              ADD COLUMN existence_public_key_jwk JSON NULL
        `,
        down: `
            ALTER TABLE civic_did_registry
              DROP COLUMN existence_public_key_jwk
        `,
    },
    // Phase 44 MKT-01..06 — Civic marketplace tables (listings, bids, escrow).
    // D-44-11: Additive; does not replace or alter existing shop-registry.
    {
        version: 33,
        name: 'marketplace_listings_bids_escrow',
        up: `
            CREATE TABLE IF NOT EXISTS marketplace_listings (
                listing_id          CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                seller_civic_did    VARCHAR(255)    NOT NULL,
                seller_business_did VARCHAR(255)    NOT NULL,
                title               VARCHAR(255)    NOT NULL,
                description         TEXT            NOT NULL,
                price_bios          BIGINT UNSIGNED NOT NULL,
                category            VARCHAR(63)     NOT NULL,
                status              ENUM('active','accepted','settled','expired','cancelled') NOT NULL DEFAULT 'active',
                created_at_tick     INT UNSIGNED    NOT NULL,
                expires_at_tick     INT UNSIGNED    NOT NULL,
                PRIMARY KEY (listing_id),
                INDEX idx_browse    (grid_name, status, category, price_bios),
                INDEX idx_seller    (grid_name, seller_civic_did),
                INDEX idx_expiry    (grid_name, expires_at_tick)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS marketplace_bids (
                bid_id              CHAR(36)        NOT NULL,
                listing_id          CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                bidder_civic_did    VARCHAR(255)    NOT NULL,
                offer_price_bios    BIGINT UNSIGNED NOT NULL,
                bid_message         VARCHAR(512),
                status              ENUM('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
                placed_at_tick      INT UNSIGNED    NOT NULL,
                PRIMARY KEY (bid_id),
                INDEX idx_listing   (listing_id),
                INDEX idx_bidder    (grid_name, bidder_civic_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS marketplace_escrow (
                escrow_id           CHAR(36)        NOT NULL,
                listing_id          CHAR(36)        NOT NULL,
                bid_id              CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                buyer_civic_did     VARCHAR(255)    NOT NULL,
                seller_civic_did    VARCHAR(255)    NOT NULL,
                amount_bios         BIGINT UNSIGNED NOT NULL,
                escrow_status       ENUM('held','frozen','settled','refunded') NOT NULL DEFAULT 'held',
                buyer_confirmed     TINYINT(1)      NOT NULL DEFAULT 0,
                seller_confirmed    TINYINT(1)      NOT NULL DEFAULT 0,
                accepted_at_tick    INT UNSIGNED    NOT NULL,
                settled_at_tick     INT UNSIGNED,
                PRIMARY KEY (escrow_id),
                UNIQUE KEY uq_listing (listing_id),
                INDEX idx_timeout   (grid_name, escrow_status, accepted_at_tick)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `
            DROP TABLE IF EXISTS marketplace_escrow;
            DROP TABLE IF EXISTS marketplace_bids;
            DROP TABLE IF EXISTS marketplace_listings
        `,
    },
    // Phase 44 MKT-05 / D-44-04 / D-44-05 — Dispute + Police stub tables.
    {
        version: 34,
        name: 'marketplace_disputes_police_investigations',
        up: `
            CREATE TABLE IF NOT EXISTS marketplace_disputes (
                dispute_id              CHAR(36)    NOT NULL,
                listing_id              CHAR(36)    NOT NULL,
                grid_name               VARCHAR(63) NOT NULL,
                complainant_civic_did_hash CHAR(64) NOT NULL,
                dispute_status          ENUM('pending_police','resolved','closed') NOT NULL DEFAULT 'pending_police',
                settled_audit_entry_id  BIGINT UNSIGNED,
                created_at_tick         INT UNSIGNED NOT NULL,
                PRIMARY KEY (dispute_id),
                INDEX idx_listing   (listing_id),
                INDEX idx_status    (grid_name, dispute_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS police_investigations (
                investigation_id    CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                source_type         VARCHAR(63)     NOT NULL,
                source_ref          CHAR(36)        NOT NULL,
                status              ENUM('pending','open','closed','resolved') NOT NULL DEFAULT 'pending',
                opened_at_tick      INT UNSIGNED    NOT NULL,
                closed_at_tick      INT UNSIGNED,
                PRIMARY KEY (investigation_id),
                INDEX idx_source    (source_type, source_ref),
                INDEX idx_status    (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `
            DROP TABLE IF EXISTS police_investigations;
            DROP TABLE IF EXISTS marketplace_disputes
        `,
    },
    // Phase 44 D-44-02 / D-44-03 — Civic treasury table + IRS config seed.
    // irs_fee_rate seeded at '0.02' (2%) per D-44-02 (not 3% — user confirmed 2026-05-27).
    // market_settlement_timeout_ticks seeded at '7' per D-44-05b.
    {
        version: 35,
        name: 'civic_treasury_seed_irs_config',
        up: `
            CREATE TABLE IF NOT EXISTS civic_treasury (
                grid_name           VARCHAR(63)     NOT NULL,
                balance_bios        BIGINT          NOT NULL DEFAULT 0,
                last_updated_tick   INT             NOT NULL DEFAULT 0,
                PRIMARY KEY (grid_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            INSERT IGNORE INTO grid_config (grid_name, config_key, config_value)
            VALUES ('genesis', 'irs_fee_rate', '0.02'),
                   ('genesis', 'market_settlement_timeout_ticks', '7')
        `,
        down: `
            DROP TABLE IF EXISTS civic_treasury;
            DELETE FROM grid_config WHERE config_key IN ('irs_fee_rate', 'market_settlement_timeout_ticks')
        `,
    },
    // Phase 46 (CIVGOV-01..06) — Nous-only legislative pipeline: bills, co-sponsorship,
    // sessions (debate window), and the civic law book. Voting itself reuses the
    // existing VOTE-05 governance_proposals/ballots tables (Phase 12) — no new vote engine.
    // body_text lives Grid-side only; only title_hash/body_hash cross the audit boundary.
    // gov_cosponsor_threshold seeded at '2' (N≥2 per CIVGOV-02).
    // gov_debate_window_ticks seeded at '10080' (1 week @ 1 tick/min per CIVGOV-03 default).
    {
        version: 36,
        name: 'gov_bills_sessions_laws',
        up: `
            CREATE TABLE IF NOT EXISTS gov_bills (
                bill_id             CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                author_civic_did    VARCHAR(255)    NOT NULL,
                title_hash          CHAR(64)        NOT NULL,
                body_text           TEXT            NOT NULL,
                body_hash           CHAR(64)        NOT NULL,
                category            VARCHAR(63)     NOT NULL,
                status              ENUM('drafted','cosponsored','in_session','enacted','rejected','withdrawn') NOT NULL DEFAULT 'drafted',
                cosponsor_count     INT UNSIGNED    NOT NULL DEFAULT 0,
                proposal_id         CHAR(36),
                created_at_tick     INT UNSIGNED    NOT NULL,
                PRIMARY KEY (bill_id),
                INDEX idx_bill_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS gov_bill_cosponsors (
                bill_id             CHAR(36)        NOT NULL,
                cosponsor_civic_did VARCHAR(255)    NOT NULL,
                cosponsored_at_tick INT UNSIGNED    NOT NULL,
                PRIMARY KEY (bill_id, cosponsor_civic_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS gov_sessions (
                session_id          CHAR(36)        NOT NULL,
                bill_id             CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                speaker_civic_did   VARCHAR(255)    NOT NULL,
                debate_deadline_tick INT UNSIGNED   NOT NULL,
                status              ENUM('open','closed') NOT NULL DEFAULT 'open',
                opened_at_tick      INT UNSIGNED    NOT NULL,
                closed_at_tick      INT UNSIGNED,
                outcome             VARCHAR(31),
                PRIMARY KEY (session_id),
                INDEX idx_session_status (grid_name, status),
                INDEX idx_session_bill (bill_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS gov_session_arguments (
                session_id          CHAR(36)        NOT NULL,
                author_civic_did    VARCHAR(255)    NOT NULL,
                argument_text       TEXT            NOT NULL,
                posted_at_tick      INT UNSIGNED    NOT NULL,
                INDEX idx_arg_session (session_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS gov_laws (
                law_id              CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                bill_id             CHAR(36)        NOT NULL,
                enacted_at_tick     INT UNSIGNED    NOT NULL,
                status              ENUM('active','repealed') NOT NULL DEFAULT 'active',
                supersedes_law_id   CHAR(36),
                repealed_at_tick    INT UNSIGNED,
                repealing_bill_id   CHAR(36),
                PRIMARY KEY (law_id),
                INDEX idx_law_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            INSERT IGNORE INTO grid_config (grid_name, config_key, config_value)
            VALUES ('genesis', 'gov_cosponsor_threshold', '2'),
                   ('genesis', 'gov_debate_window_ticks', '10080')
        `,
        down: `
            DROP TABLE IF EXISTS gov_laws;
            DROP TABLE IF EXISTS gov_session_arguments;
            DROP TABLE IF EXISTS gov_sessions;
            DROP TABLE IF EXISTS gov_bill_cosponsors;
            DROP TABLE IF EXISTS gov_bills;
            DELETE FROM grid_config WHERE config_key IN ('gov_cosponsor_threshold', 'gov_debate_window_ticks')
        `,
    },
    // Human Civic-DID applications (2026-06-10) — brings Phase 54's HUMAN track forward
    // (D-36-04 two-step registration; D-V3-33 Portal → Polis → Registry pipeline).
    // One row per (grid, human): rejected applicants may re-apply (row returns to 'pending').
    // statement is Grid-side only — it never crosses the audit boundary (closed reason_code
    // set on rejection). civic_did is filled on approval; the issued credential itself lives
    // in civic_did_registry (existence_did column carries the human operator-DID).
    {
        version: 37,
        name: 'human_civic_applications',
        up: `
            CREATE TABLE IF NOT EXISTS human_civic_applications (
                application_id      CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                human_did           VARCHAR(255)    NOT NULL,
                statement           TEXT            NOT NULL,
                status              ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
                reason_code         VARCHAR(63),
                civic_did           VARCHAR(255),
                requested_at_tick   INT UNSIGNED    NOT NULL,
                decided_at_tick     INT UNSIGNED,
                PRIMARY KEY (application_id),
                UNIQUE KEY uq_civic_app_human (grid_name, human_did),
                INDEX idx_civic_app_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `
            DROP TABLE IF EXISTS human_civic_applications
        `,
    },
    // Phase 58 HOUSE-1 (NH1-01 / D-58-02) — civic_parcels: one row per parcel with the
    // structure embedded (one-structure-per-parcel makes a separate table unnecessary).
    // D-NH-10 vector address: ring / sector_deg / level. owner_civic_did NULL = treasury.
    // structure_name is plaintext Grid-side only (never crosses the audit chain).
    // Occupants are NOT persisted — presence is memory-only (R-H-09), so no column for it.
    // named_address is wired in Phase 60. Write-through store; registry hydrated on boot.
    {
        version: 38,
        name: 'create_civic_parcels',
        up: `
            CREATE TABLE IF NOT EXISTS civic_parcels (
                parcel_id        VARCHAR(127)    NOT NULL,
                grid_name        VARCHAR(63)     NOT NULL,
                zone_id          VARCHAR(31)     NOT NULL,
                ring             TINYINT         NOT NULL,
                sector_deg       DECIMAL(6,2)    NOT NULL,
                level            SMALLINT        NOT NULL DEFAULT 0,
                owner_civic_did  VARCHAR(255)    NULL,
                price_bios       BIGINT UNSIGNED NOT NULL,
                acquired_at_tick INT UNSIGNED    NULL,
                structure_name   VARCHAR(255)    NULL,
                structure_type   ENUM('home','shop','workshop','venue') NULL,
                visibility       ENUM('open','private') NULL,
                built_at_tick    INT UNSIGNED    NULL,
                named_address    VARCHAR(255)    NULL,
                entry_policy     ENUM('open','allowlist') NOT NULL DEFAULT 'open',
                entry_allowlist  JSON            NULL,
                PRIMARY KEY (parcel_id),
                INDEX idx_parcel_owner (owner_civic_did),
                INDEX idx_parcel_zone (grid_name, zone_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS civic_parcels`,
    },
    // Phase 59 HOUSE-2 (NH2-01 / D-59-02 / R-59-01) — interiors + upkeep columns.
    // structure_interior holds the D-NH-02 Smallville interior tree (Grid-side JSON;
    // never crosses the audit chain). condition walks the upkeep ladder
    // (maintained → worn → derelict); last_upkeep_tick + missed_periods drive the
    // tick-based upkeep scanner (Wave 4). Applies cleanly on top of v38.
    // Write-through store; registry hydrated on boot reads all four columns.
    {
        version: 39,
        name: 'add_interior_upkeep_to_civic_parcels',
        up: `
            ALTER TABLE civic_parcels
              ADD COLUMN structure_interior JSON NULL,
              ADD COLUMN \`condition\` ENUM('maintained','worn','derelict') NOT NULL DEFAULT 'maintained',
              ADD COLUMN last_upkeep_tick INT UNSIGNED NULL,
              ADD COLUMN missed_periods TINYINT UNSIGNED NOT NULL DEFAULT 0
        `,
        down: `
            ALTER TABLE civic_parcels
              DROP COLUMN missed_periods,
              DROP COLUMN last_upkeep_tick,
              DROP COLUMN \`condition\`,
              DROP COLUMN structure_interior
        `,
    },
    // Phase 60 HOUSE-3 (NH3-01 / D-60-12 / R-60-01) — relationship + commerce storage.
    // Three tables + one column, all in one migration so v40 is atomic:
    //   - civic_parcel_roles : typed role edges (A4 / D-60-01). owner is NEVER a row here —
    //     it is implicit from civic_parcels.owner_civic_did (never stored twice). role ENUM is
    //     {staff,guest} only. trust_score is a derived float (honored settlements). The PK is
    //     (parcel_id, holder_civic_did) so a re-grant resumes the SAME row → trust continuity.
    //     revoked_tick stamps history at ARCHIVED — the row is kept, never hard-deleted (D-60-02).
    //   - civic_credit_ledger : bilateral mutual-credit IOU payables (D-60-05 / D-NH-06). Wave 2
    //     wires recordIou/settleIou; the table is created here so v40 is one migration.
    //   - civic_cowork_agreements : signed dual-DID Cowork Agreements + board tasks (D-60-06 / A5).
    //     Wave 2 wires post/claim/complete; created here.
    //   - civic_parcels.bound_shop_id : the shop⇄structure binding (D-60-03 / R-60-05). named_address
    //     already exists from v38 (Phase 58) — reused, NOT re-added.
    // Write-through store; hydrate-on-boot reads civic_parcel_roles. Applies cleanly on top of v39.
    {
        version: 40,
        name: 'house3_roles_credit_cowork_bound_shop',
        up: `
            CREATE TABLE IF NOT EXISTS civic_parcel_roles (
                parcel_id           VARCHAR(63)     NOT NULL,
                holder_civic_did    VARCHAR(255)    NOT NULL,
                role                ENUM('staff','guest') NOT NULL,
                granted_by_civic_did VARCHAR(255)   NOT NULL,
                granted_tick        INT UNSIGNED    NOT NULL,
                trust_score         FLOAT           NOT NULL DEFAULT 0,
                revoked_tick        INT UNSIGNED    NULL,
                PRIMARY KEY (parcel_id, holder_civic_did),
                INDEX idx_roles_holder (holder_civic_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS civic_credit_ledger (
                iou_id              CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                creditor_civic_did  VARCHAR(255)    NOT NULL,
                debtor_civic_did    VARCHAR(255)    NOT NULL,
                amount_bios         BIGINT UNSIGNED NOT NULL,
                reason_ref          VARCHAR(255)    NOT NULL,
                created_tick        INT UNSIGNED    NOT NULL,
                settled_tick        INT UNSIGNED    NULL,
                PRIMARY KEY (iou_id),
                INDEX idx_iou_creditor (grid_name, creditor_civic_did),
                INDEX idx_iou_debtor   (grid_name, debtor_civic_did),
                INDEX idx_iou_pair     (grid_name, creditor_civic_did, debtor_civic_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS civic_cowork_agreements (
                agreement_id        CHAR(36)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                parcel_id           VARCHAR(63)     NOT NULL,
                host_civic_did      VARCHAR(255)    NOT NULL,
                worker_civic_did    VARCHAR(255)    NULL,
                scope_ref           VARCHAR(255)    NOT NULL,
                settlement_amount_bios BIGINT UNSIGNED NOT NULL,
                term_ticks          INT UNSIGNED    NOT NULL,
                status              ENUM('posted','claimed','completed','cancelled') NOT NULL DEFAULT 'posted',
                created_tick        INT UNSIGNED    NOT NULL,
                completed_tick      INT UNSIGNED    NULL,
                PRIMARY KEY (agreement_id),
                INDEX idx_cowork_parcel (grid_name, parcel_id),
                INDEX idx_cowork_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            ALTER TABLE civic_parcels ADD COLUMN bound_shop_id VARCHAR(63) NULL
        `,
        down: `
            ALTER TABLE civic_parcels DROP COLUMN bound_shop_id;
            DROP TABLE IF EXISTS civic_cowork_agreements;
            DROP TABLE IF EXISTS civic_credit_ledger;
            DROP TABLE IF EXISTS civic_parcel_roles
        `,
    },
    // Phase 61 HOUSE-4 (NH4-01 / D-61-08 / R-61-01) — civic_blueprints: one row per
    // blueprint_hash holding the Grid-side recipe BODY the build executor applies
    // (objects + arrangement DAG as recipe_json, plus the material_cost_bios build debit).
    // A blueprint_hash IS a Phase 18 skill hash; the skill HASH diffuses via the existing
    // skill.taught/skill.inferred lineage (audit chain) — this table stores only the recipe
    // body. The row write emits NO chain event (Grid-side recipe storage). Write-through
    // store; cache hydrated on boot. Applies cleanly on top of v40.
    {
        version: 41,
        name: 'create_civic_blueprints',
        up: `
            CREATE TABLE IF NOT EXISTS civic_blueprints (
                blueprint_hash      CHAR(64)        NOT NULL,
                grid_name           VARCHAR(63)     NOT NULL,
                recipe_json         JSON            NOT NULL,
                material_cost_bios  BIGINT UNSIGNED NOT NULL,
                created_tick        INT UNSIGNED    NOT NULL,
                PRIMARY KEY (blueprint_hash),
                INDEX idx_blueprint_grid (grid_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS civic_blueprints`,
    },
    // Groups & Holdings · Phase 1 (D-GROUP-01/03/04) — civic_groups + civic_group_members.
    // A Group is a multi-member organization (collective): a for-profit `business` or a
    // `nonprofit` purpose group. The five founding Businesses are seeded as orbital ANCHOR
    // structures in the business sector (ring 2) — NOT purchased parcels. Table is named
    // civic_groups (matching the civic_* convention) because the bare word GROUPS is a
    // reserved word in MySQL 8. Treasury + projects arrive in v43 (later phase). Membership
    // table created here so v42 is one atomic migration; populated when Nous join (Phase 2).
    // Write-through store; group.founded emitted once per seeded row.
    {
        version: 42,
        name: 'create_civic_groups',
        up: `
            CREATE TABLE IF NOT EXISTS civic_groups (
                group_id          VARCHAR(127)    NOT NULL,
                grid_name         VARCHAR(63)     NOT NULL,
                kind              ENUM('business','nonprofit') NOT NULL,
                domain            VARCHAR(31)     NOT NULL,
                display_name      VARCHAR(255)    NOT NULL,
                crest_path        VARCHAR(255)    NULL,
                charter_text      TEXT            NULL,
                zone_id           VARCHAR(31)     NOT NULL DEFAULT 'business',
                ring              TINYINT         NOT NULL,
                sector_deg        DECIMAL(6,2)    NOT NULL,
                \`level\`           SMALLINT        NOT NULL DEFAULT 0,
                founder_civic_did VARCHAR(255)    NULL,
                status            ENUM('active','dissolved') NOT NULL DEFAULT 'active',
                created_at_tick   INT UNSIGNED    NULL,
                PRIMARY KEY (group_id),
                INDEX idx_group_grid (grid_name),
                INDEX idx_group_domain (grid_name, domain)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS civic_group_members (
                group_id          VARCHAR(127)    NOT NULL,
                member_civic_did  VARCHAR(255)    NOT NULL,
                role              ENUM('founder','member','affiliate') NOT NULL,
                joined_at_tick    INT UNSIGNED    NOT NULL,
                status            ENUM('active','departed') NOT NULL DEFAULT 'active',
                PRIMARY KEY (group_id, member_civic_did),
                INDEX idx_group_member (member_civic_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `
            DROP TABLE IF EXISTS civic_group_members;
            DROP TABLE IF EXISTS civic_groups
        `,
    },
    // Groups & Holdings · Phase 69 (D-GROUP-01) — civic_group_projects: a Group's research
    // projects. A completed project PRODUCES a blueprint/skill (produced_blueprint_hash IS a
    // Phase 18 skill hash; the recipe body lives in civic_blueprints from v41). Money-free —
    // the Group treasury is deferred to the on-chain money rails (Phase 70). The project title
    // stays Grid-side (never on the audit chain). Write-through store. Applies on top of v42.
    {
        version: 43,
        name: 'create_civic_group_projects',
        up: `
            CREATE TABLE IF NOT EXISTS civic_group_projects (
                project_id              CHAR(36)        NOT NULL,
                group_id                VARCHAR(127)    NOT NULL,
                grid_name               VARCHAR(63)     NOT NULL,
                title                   VARCHAR(255)    NOT NULL,
                status                  ENUM('active','completed','abandoned') NOT NULL DEFAULT 'active',
                produced_blueprint_hash CHAR(64)        NULL,
                started_at_tick         INT UNSIGNED    NOT NULL,
                completed_at_tick       INT UNSIGNED    NULL,
                PRIMARY KEY (project_id),
                INDEX idx_group_project (group_id),
                INDEX idx_group_project_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS civic_group_projects`,
    },
    // Money rails (D-MONEY-02) — civic_account_links: binds a Civic-DID to its on-chain
    // NousAccount address, proven by an EVM signature from the account owner's EOA. The raw
    // DID + addresses are stored Grid-side; only hashes cross the audit boundary (the audit
    // event + route are wired in the Phase 70 money rails). On-chain proof that
    // owner == NousAccount.owner() is deferred to an indexer. No reserved-word identifiers.
    {
        version: 44,
        name: 'create_civic_account_links',
        up: `
            CREATE TABLE IF NOT EXISTS civic_account_links (
                link_id          CHAR(36)     NOT NULL,
                grid_name        VARCHAR(63)  NOT NULL,
                civic_did        VARCHAR(255) NOT NULL,
                nous_account     VARCHAR(42)  NOT NULL,
                owner_address    VARCHAR(42)  NOT NULL,
                signature_hash   CHAR(64)     NOT NULL,
                verified_at_tick INT UNSIGNED NOT NULL,
                created_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
                PRIMARY KEY (link_id),
                UNIQUE KEY uq_civic_account (grid_name, civic_did, nous_account),
                INDEX idx_link_civic (grid_name, civic_did),
                INDEX idx_link_account (grid_name, nous_account)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS civic_account_links`,
    },
    // Economic Reality Loop (D-MONEY-01/02) — nous_accounts: wei-denominated, non-custodial
    // Nous account. Balance in DECIMAL(65,0) because BIGINT UNSIGNED overflows at ~18.4 ETH;
    // DECIMAL(65,0) holds ~1e65 wei. session_cap_wei + session_expiry are chain-ready mirror
    // of the future on-chain capped session key; not enforced in F1a. No internal mint —
    // accounts start at 0. Allowlist +0 (F1a is a ledger primitive; callers emit audit events).
    {
        version: 45,
        name: 'create_nous_accounts',
        up: `
            CREATE TABLE IF NOT EXISTS nous_accounts (
                grid_name        VARCHAR(64)   NOT NULL,
                civic_did        VARCHAR(255)  NOT NULL,
                balance_wei      DECIMAL(65,0) NOT NULL DEFAULT 0,
                session_cap_wei  DECIMAL(65,0) NOT NULL DEFAULT 0,
                session_expiry   BIGINT        NOT NULL DEFAULT 0,
                created_at       BIGINT        NOT NULL,
                updated_at       BIGINT        NOT NULL,
                PRIMARY KEY (grid_name, civic_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS nous_accounts`,
    },
    // F1b — Treasury wei: the civic commons fund in wei (DECIMAL(65,0) mirrors nous_accounts).
    // ALTER TABLE because the civic_treasury table + genesis row already exist from v35.
    // Allowlist +0 (callers emit audit events; this is a ledger primitive).
    {
        version: 46,
        name: 'civic_treasury_add_balance_wei',
        up: `ALTER TABLE civic_treasury ADD COLUMN balance_wei DECIMAL(65,0) NOT NULL DEFAULT 0`,
        down: `ALTER TABLE civic_treasury DROP COLUMN balance_wei`,
    },
    // F1c — Labor escrow: escrowed inter-Nous job settlement ledger.
    // fund: debit payer → escrow 'funded'; release: pay worker + fee → treasury, mark 'released';
    // reclaim: refund payer, mark 'reclaimed'. Atomic via LaborEscrowStore (wei-ops composition).
    // Allowlist +0 (RFP/settlement layer emits audit events).
    {
        version: 47,
        name: 'create_labor_escrow',
        up: `
            CREATE TABLE IF NOT EXISTS labor_escrow (
                escrow_id        CHAR(36)      NOT NULL,
                grid_name        VARCHAR(63)   NOT NULL,
                payer_did        VARCHAR(255)  NOT NULL,
                worker_did       VARCHAR(255)  NOT NULL,
                amount_wei       DECIMAL(65,0) NOT NULL,
                fee_wei          DECIMAL(65,0) NOT NULL DEFAULT 0,
                ref              VARCHAR(255)  NOT NULL,
                status           ENUM('funded','released','reclaimed') NOT NULL DEFAULT 'funded',
                attestation_ref  VARCHAR(255)  NULL,
                created_at       BIGINT        NOT NULL,
                updated_at       BIGINT        NOT NULL,
                PRIMARY KEY (escrow_id),
                INDEX idx_grid_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS labor_escrow`,
    },
    // F1d — Civic-labor credit: the "labor → standing" ledger.
    // earn: Polis-work completion credits a Nous (no self-mint);
    // redeem: spend for standing (e.g. a parcel) without passing through ETH.
    // Credits are a civic unit (BIGINT, not wei). Atomic redeem under FOR UPDATE.
    // Allowlist +0 (earn/redeem audited by civic-work / land layers).
    {
        version: 48,
        name: 'create_civic_labor_credit',
        up: `
            CREATE TABLE IF NOT EXISTS civic_labor_credit (
                grid_name      VARCHAR(63)  NOT NULL,
                civic_did      VARCHAR(255) NOT NULL,
                credit_balance BIGINT       NOT NULL DEFAULT 0,
                created_at     BIGINT       NOT NULL,
                updated_at     BIGINT       NOT NULL,
                PRIMARY KEY (grid_name, civic_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS civic_labor_credit`,
    },
    {
        version: 49,
        name: 'create_civic_dues',
        up: `
            CREATE TABLE IF NOT EXISTS civic_dues (
                due_id         CHAR(36)      NOT NULL,
                grid_name      VARCHAR(63)   NOT NULL,
                civic_did      VARCHAR(255)  NOT NULL,
                period         VARCHAR(32)   NOT NULL,
                amount_wei     DECIMAL(65,0) NOT NULL,
                amount_credit  BIGINT        NOT NULL,
                status         ENUM('assessed','paid','delinquent') NOT NULL DEFAULT 'assessed',
                paid_in        ENUM('wei','labor') NULL,
                due_tick       BIGINT        NOT NULL,
                created_at     BIGINT        NOT NULL,
                updated_at     BIGINT        NOT NULL,
                PRIMARY KEY (due_id),
                UNIQUE KEY uniq_member_period (grid_name, civic_did, period),
                INDEX idx_grid_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS civic_dues`,
    },
    // L2a — RFP procurement: the Polis commissions builds with the treasury.
    // issueNotice / placeBid / award / settleContract / cancelNotice.
    // award funds a labor_escrow from the treasury (payer = TREASURY_CIVIC_DID),
    // deducting treasury wei and writing a procurement_contracts row — all atomic.
    // Allowlist +0 (procurement.* events wired in L2b).
    {
        version: 50,
        name: 'create_procurement',
        up: `
            CREATE TABLE IF NOT EXISTS procurement_notices (
                notice_id              CHAR(36)      NOT NULL,
                grid_name              VARCHAR(63)   NOT NULL,
                polis_authorization_ref VARCHAR(255) NOT NULL,
                title                  VARCHAR(255)  NOT NULL,
                spec                   TEXT          NOT NULL,
                budget_wei             DECIMAL(65,0) NOT NULL,
                zone                   VARCHAR(63)   NOT NULL,
                function_type          VARCHAR(63)   NOT NULL,
                status                 ENUM('open','awarded','cancelled') NOT NULL DEFAULT 'open',
                deadline_tick          BIGINT        NOT NULL,
                created_at             BIGINT        NOT NULL,
                updated_at             BIGINT        NOT NULL,
                PRIMARY KEY (notice_id),
                INDEX idx_grid_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS procurement_bids (
                bid_id        CHAR(36)      NOT NULL,
                notice_id     CHAR(36)      NOT NULL,
                grid_name     VARCHAR(63)   NOT NULL,
                bidder_did    VARCHAR(255)  NOT NULL,
                price_wei     DECIMAL(65,0) NOT NULL,
                artifact_spec TEXT          NOT NULL,
                status        ENUM('submitted','awarded','rejected') NOT NULL DEFAULT 'submitted',
                created_at    BIGINT        NOT NULL,
                PRIMARY KEY (bid_id),
                INDEX idx_notice (notice_id, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

            CREATE TABLE IF NOT EXISTS procurement_contracts (
                contract_id   CHAR(36)      NOT NULL,
                notice_id     CHAR(36)      NOT NULL,
                grid_name     VARCHAR(63)   NOT NULL,
                winner_did    VARCHAR(255)  NOT NULL,
                award_wei     DECIMAL(65,0) NOT NULL,
                escrow_id     CHAR(36)      NOT NULL,
                status        ENUM('active','settled','cancelled') NOT NULL DEFAULT 'active',
                attested_tick BIGINT        NULL,
                created_at    BIGINT        NOT NULL,
                updated_at    BIGINT        NOT NULL,
                PRIMARY KEY (contract_id),
                INDEX idx_grid_status (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `
            DROP TABLE IF EXISTS procurement_contracts;
            DROP TABLE IF EXISTS procurement_bids;
            DROP TABLE IF EXISTS procurement_notices
        `,
    },
    {
        version: 51,
        name: 'create_orbital_objects',
        up: `
            CREATE TABLE IF NOT EXISTS orbital_objects (
                object_id              CHAR(36)      NOT NULL,
                grid_name              VARCHAR(63)   NOT NULL,
                owner_did              VARCHAR(255)  NOT NULL,
                builder_did            VARCHAR(255)  NOT NULL,
                build_cost_wei         DECIMAL(65,0) NOT NULL,
                function_type          VARCHAR(63)   NOT NULL,
                output_rate            BIGINT        NOT NULL DEFAULT 0,
                physics_spec           TEXT          NOT NULL,
                provenance_contract_id CHAR(36)      NOT NULL,
                zone                   VARCHAR(63)   NOT NULL,
                status                 ENUM('active','decommissioned') NOT NULL DEFAULT 'active',
                created_at             BIGINT        NOT NULL,
                updated_at             BIGINT        NOT NULL,
                PRIMARY KEY (object_id),
                UNIQUE KEY uniq_provenance (provenance_contract_id),
                INDEX idx_grid (grid_name, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS orbital_objects`,
    },
    {
        version: 52,
        name: 'create_pending_approvals',
        up: `
            CREATE TABLE IF NOT EXISTS pending_approvals (
                approval_id   CHAR(36)      NOT NULL,
                grid_name     VARCHAR(63)   NOT NULL,
                nous_did      VARCHAR(255)  NOT NULL,
                human_did     VARCHAR(255)  NOT NULL,
                kind          VARCHAR(63)   NOT NULL,
                summary       TEXT          NOT NULL,
                payload       TEXT          NOT NULL,
                status        ENUM('pending','approved','rejected','expired') NOT NULL DEFAULT 'pending',
                created_tick  BIGINT        NOT NULL,
                deadline_tick BIGINT        NOT NULL,
                resolved_tick BIGINT        NULL,
                created_at    BIGINT        NOT NULL,
                updated_at    BIGINT        NOT NULL,
                PRIMARY KEY (approval_id),
                INDEX idx_human_pending (grid_name, human_did, status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS pending_approvals`,
    },
    {
        version: 53,
        name: 'create_conversation_messages',
        up: `
            CREATE TABLE IF NOT EXISTS conversation_messages (
                message_id  CHAR(36)     NOT NULL,
                grid_name   VARCHAR(63)  NOT NULL,
                human_did   VARCHAR(255) NOT NULL,
                nous_did    VARCHAR(255) NOT NULL,
                sender      ENUM('human','nous') NOT NULL,
                text        TEXT         NOT NULL,
                tick        BIGINT       NOT NULL,
                created_at  BIGINT       NOT NULL,
                PRIMARY KEY (message_id),
                INDEX idx_thread (grid_name, human_did, nous_did, tick)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS conversation_messages`,
    },
    {
        // W4 (D-MONEY-09) — model-first endowment ledger. Each row is one bounded,
        // operator-authorized wei injection standing in for "the human brings ETH"
        // until on-chain settlement (D-MONEY-02). The ledger is the conservation
        // record + the retirement path (one row ↔ one future Sepolia deposit proof).
        // reason/operator_did are Grid-side provenance only — never on the audit chain.
        version: 54,
        name: 'create_account_endowments',
        up: `
            CREATE TABLE IF NOT EXISTS account_endowments (
                endowment_id  CHAR(36)      NOT NULL,
                grid_name     VARCHAR(63)   NOT NULL,
                civic_did     VARCHAR(255)  NOT NULL,
                amount_wei    DECIMAL(65,0) NOT NULL,
                source        VARCHAR(31)   NOT NULL DEFAULT 'model_first',
                reason        VARCHAR(255)  NULL,
                operator_did  VARCHAR(255)  NULL,
                endowed_tick  BIGINT        NOT NULL,
                created_at    BIGINT        NOT NULL,
                PRIMARY KEY (endowment_id),
                INDEX idx_account_endow (grid_name, civic_did)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `,
        down: `DROP TABLE IF EXISTS account_endowments`,
    },
];
