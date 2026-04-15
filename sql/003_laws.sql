-- Logos — Constitutional and Adaptive Laws
CREATE TABLE IF NOT EXISTS laws (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  law_type      ENUM('constitutional','adaptive','temporary') NOT NULL,
  title         VARCHAR(255) NOT NULL,
  description   TEXT NOT NULL,
  rule_logic    JSON NOT NULL,
  severity      ENUM('info','warning','minor','major','critical') NOT NULL DEFAULT 'minor',
  status        ENUM('proposed','active','repealed') NOT NULL DEFAULT 'proposed',
  proposed_by   VARCHAR(255),
  enacted_at    TIMESTAMP(6),
  repealed_at   TIMESTAMP(6),
  created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
