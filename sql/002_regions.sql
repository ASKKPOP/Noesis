-- Spatial Map — Regions and Connections
CREATE TABLE IF NOT EXISTS regions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(127) NOT NULL UNIQUE,
  description   TEXT,
  region_type   ENUM('public','restricted','private') NOT NULL DEFAULT 'public',
  capacity      INT UNSIGNED DEFAULT 100,
  properties    JSON,
  created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS region_connections (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  from_region   BIGINT UNSIGNED NOT NULL,
  to_region     BIGINT UNSIGNED NOT NULL,
  travel_cost   INT UNSIGNED NOT NULL DEFAULT 1,
  bidirectional BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (from_region) REFERENCES regions(id),
  FOREIGN KEY (to_region) REFERENCES regions(id),
  UNIQUE KEY uq_connection (from_region, to_region)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nous_positions (
  nous_did      VARCHAR(255) PRIMARY KEY,
  region_id     BIGINT UNSIGNED NOT NULL,
  arrived_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (nous_did) REFERENCES domains(did_key) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions(id)
) ENGINE=InnoDB;
