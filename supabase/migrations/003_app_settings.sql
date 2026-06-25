-- Configurações globais do dashboard (ex.: versão da Graph API Meta)
CREATE TABLE IF NOT EXISTS app_settings (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

INSERT INTO app_settings (key, value)
VALUES ('meta_ads_api_version', 'v19.0')
ON CONFLICT (key) DO NOTHING;
