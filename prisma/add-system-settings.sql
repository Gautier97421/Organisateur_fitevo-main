-- Réglages globaux de l'application (quota de stockage superadmin)

CREATE TABLE IF NOT EXISTS system_settings (
  id               TEXT PRIMARY KEY,
  storage_quota_mb INTEGER,
  updated_at       TIMESTAMP NOT NULL DEFAULT now(),
  updated_by       TEXT
);
