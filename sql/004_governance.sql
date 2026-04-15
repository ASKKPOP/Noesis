-- Governance — Proposals, Votes, Sanctions
CREATE TABLE IF NOT EXISTS proposals (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  description   TEXT NOT NULL,
  proposal_type ENUM('law','amendment','repeal','sanction','config') NOT NULL,
  proposed_by   VARCHAR(255) NOT NULL,
  status        ENUM('open','passed','rejected','expired') NOT NULL DEFAULT 'open',
  target_id     BIGINT UNSIGNED,
  voting_model  ENUM('simple_majority','supermajority','quadratic') NOT NULL DEFAULT 'simple_majority',
  opens_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  closes_at     TIMESTAMP(6) NOT NULL,
  created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS votes (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proposal_id   BIGINT UNSIGNED NOT NULL,
  voter_did     VARCHAR(255) NOT NULL,
  vote          ENUM('yes','no','abstain') NOT NULL,
  weight        DECIMAL(10,4) NOT NULL DEFAULT 1.0,
  voted_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  UNIQUE KEY uq_vote (proposal_id, voter_did)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sanctions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  target_did    VARCHAR(255) NOT NULL,
  sanction_type ENUM('warning','rate_limit','suspend','exile') NOT NULL,
  reason        TEXT NOT NULL,
  evidence      JSON,
  imposed_by    ENUM('governance','logos','admin') NOT NULL,
  proposal_id   BIGINT UNSIGNED,
  starts_at     TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  ends_at       TIMESTAMP(6),
  status        ENUM('active','expired','appealed','reversed') NOT NULL DEFAULT 'active',
  FOREIGN KEY (proposal_id) REFERENCES proposals(id),
  INDEX idx_target (target_did),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
