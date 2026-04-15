-- Economy — Ousia configuration
CREATE TABLE IF NOT EXISTS ousia_config (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  initial_supply  BIGINT UNSIGNED NOT NULL DEFAULT 1000,
  transaction_fee DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  min_transfer    BIGINT UNSIGNED NOT NULL DEFAULT 1,
  max_transfer    BIGINT UNSIGNED NOT NULL DEFAULT 1000000,
  updated_at      TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;

-- Default economy config
INSERT INTO ousia_config (initial_supply, transaction_fee, min_transfer, max_transfer) VALUES
  (1000, 0.0000, 1, 1000000);
