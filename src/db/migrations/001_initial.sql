CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  received_at TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  environment TEXT NOT NULL,
  application_version TEXT,
  feature TEXT NOT NULL,
  operation TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  workflow_id TEXT,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  provider TEXT NOT NULL,
  requested_model TEXT NOT NULL,
  reported_model TEXT,
  prompt_id TEXT,
  prompt_version TEXT,
  request_config TEXT,
  request_input TEXT,
  request_raw TEXT,
  request_metadata TEXT,
  response_output TEXT,
  response_raw TEXT,
  response_metadata TEXT,
  input_tokens INTEGER,
  cached_input_tokens INTEGER,
  output_tokens INTEGER,
  reasoning_tokens INTEGER,
  total_tokens INTEGER,
  raw_usage TEXT,
  http_status INTEGER,
  error_type TEXT,
  error_message TEXT,
  error_metadata TEXT,
  metadata TEXT,
  metrics TEXT,
  input_cost TEXT,
  cached_input_cost TEXT,
  output_cost TEXT,
  total_cost TEXT,
  pricing_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_application_id ON events(application_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
