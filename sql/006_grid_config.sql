-- Grid Configuration — Key-value store for Grid settings
CREATE TABLE IF NOT EXISTS grid_config (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  config_key    VARCHAR(127) NOT NULL UNIQUE,
  config_value  JSON NOT NULL,
  description   TEXT,
  updated_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default configuration
INSERT INTO grid_config (config_key, config_value, description) VALUES
  ('grid_name', '"genesis"', 'Grid display name'),
  ('grid_type', '"public"', 'Grid access type: public, private, restricted'),
  ('tick_rate_ms', '30000', 'World clock tick rate in milliseconds'),
  ('governance_model', '"democracy"', 'Governance model: democracy, monarchy, anarchy'),
  ('admin_did', '""', 'Grid administrator did:key'),
  ('max_nous', '1000', 'Maximum number of registered Nous');
