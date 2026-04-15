-- Noēsis Domain System (NDS) — Domain Registry
CREATE TABLE IF NOT EXISTS domains (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(63) NOT NULL,
  grid_domain   VARCHAR(63) NOT NULL,
  full_address  VARCHAR(127) GENERATED ALWAYS AS (CONCAT('nous://', name, '.', grid_domain)) STORED,
  did_key       VARCHAR(255) NOT NULL,
  public_key    VARBINARY(32) NOT NULL,
  status        ENUM('pending','active','suspended','exiled') NOT NULL DEFAULT 'pending',
  access_type   ENUM('public','private','restricted') NOT NULL DEFAULT 'public',
  role          ENUM('citizen','visitor','admin') NOT NULL DEFAULT 'citizen',
  human_owner   VARCHAR(255),
  trade_seq     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  registered_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  expires_at    TIMESTAMP(6),
  updated_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_name_grid (name, grid_domain),
  UNIQUE KEY uq_did (did_key),
  INDEX idx_status (status),
  INDEX idx_human (human_owner)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
