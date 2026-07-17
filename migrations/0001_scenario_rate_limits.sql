CREATE TABLE IF NOT EXISTS scenario_rate_limits (
  actor_key TEXT PRIMARY KEY NOT NULL,
  window_id INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 1)
) STRICT;
