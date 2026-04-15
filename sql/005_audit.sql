-- Audit Trail — Hash-chained, append-only event log
CREATE TABLE IF NOT EXISTS audit_trail (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_type    VARCHAR(63) NOT NULL,
  actor_did     VARCHAR(255) NOT NULL,
  target_did    VARCHAR(255),
  payload       JSON NOT NULL,
  prev_hash     VARCHAR(64) NOT NULL,
  event_hash    VARCHAR(64) NOT NULL,
  created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX idx_type (event_type),
  INDEX idx_actor (actor_did),
  INDEX idx_target (target_did),
  INDEX idx_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
