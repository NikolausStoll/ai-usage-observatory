CREATE TABLE IF NOT EXISTS pricing (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_price_per_million TEXT NOT NULL,
  cached_input_price_per_million TEXT NOT NULL,
  output_price_per_million TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_until TEXT,
  source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pricing_provider_model ON pricing(provider, model);

CREATE TABLE IF NOT EXISTS artifacts (
  artifact_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(event_id),
  role TEXT NOT NULL CHECK(role IN ('input', 'output')),
  label TEXT,
  mime_type TEXT NOT NULL,
  original_filename TEXT,
  byte_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  content_hash TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_event_id ON artifacts(event_id);
