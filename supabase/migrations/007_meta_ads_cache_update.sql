-- Ajuste meta_ads_cache: cache_key + expires_at (TTL 15 min)
ALTER TABLE meta_ads_cache ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE meta_ads_cache ADD COLUMN IF NOT EXISTS cache_key VARCHAR(200);

UPDATE meta_ads_cache
SET expires_at = fetched_at + INTERVAL '15 minutes'
WHERE expires_at IS NULL;

UPDATE meta_ads_cache
SET cache_key = 'meta_ads_' || period_from::text || '_' || period_to::text
WHERE cache_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_meta_ads_cache_expires ON meta_ads_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_meta_ads_cache_key ON meta_ads_cache(cache_key);
