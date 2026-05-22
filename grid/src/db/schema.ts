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
];
