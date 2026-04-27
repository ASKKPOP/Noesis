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
];
