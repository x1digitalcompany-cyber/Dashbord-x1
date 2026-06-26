-- Dashboard X1 — Meta Ads: cache + contas (substitui 002 meta_ads_cache + 007 ajustes)
-- Execute no SQL Editor do Supabase

-- Cache Meta Ads (TTL via expires_at)
CREATE TABLE IF NOT EXISTS meta_ads_cache (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key    VARCHAR(200) NOT NULL,
  period_from  DATE NOT NULL,
  period_to    DATE NOT NULL,
  data         JSONB NOT NULL DEFAULT '{}',
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  UNIQUE (cache_key)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_cache_key     ON meta_ads_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_meta_ads_cache_expires ON meta_ads_cache(expires_at);

-- Contas Meta Ads (gerenciadas pelo dashboard em /configuracoes)
CREATE TABLE IF NOT EXISTS ad_accounts (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id    VARCHAR(50) NOT NULL,
  access_token  TEXT NOT NULL,
  name          VARCHAR(200),
  currency      VARCHAR(10) DEFAULT 'BRL',
  is_active     BOOLEAN DEFAULT true,
  api_version   VARCHAR(10) DEFAULT 'v19.0',
  last_fetch_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_accounts_account_id ON ad_accounts(account_id);

ALTER TABLE ad_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE meta_ads_cache DISABLE ROW LEVEL SECURITY;
