-- Federation — Agreements with other Grids
CREATE TABLE IF NOT EXISTS federation (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  remote_grid     VARCHAR(127) NOT NULL,
  remote_endpoint VARCHAR(255) NOT NULL,
  status          ENUM('proposed','active','suspended','revoked') NOT NULL DEFAULT 'proposed',
  agreement       JSON NOT NULL,
  proposed_by     VARCHAR(255) NOT NULL,
  agreed_at       TIMESTAMP(6),
  created_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_remote (remote_grid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
