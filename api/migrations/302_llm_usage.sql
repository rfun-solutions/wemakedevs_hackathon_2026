-- c-evening-threads: one row per threading run (tokens are 0 for heuristic runs); feeds the daily cost cap.
CREATE TABLE IF NOT EXISTS llm_usage (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  text          NOT NULL,
  run_id     uuid          NOT NULL,
  day        date          NOT NULL,
  model      text          NOT NULL DEFAULT '',
  tokens_in  integer       NOT NULL DEFAULT 0,
  tokens_out integer       NOT NULL DEFAULT 0,
  cost_usd   numeric(10,6) NOT NULL DEFAULT 0,
  latency_ms integer       NOT NULL DEFAULT 0,
  trace_id   text          NULL,
  mode       text          NOT NULL CHECK (mode IN ('llm', 'heuristic')),
  reason     text          NULL,
  created_at timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS llm_usage_device_day_idx ON llm_usage (device_id, day);
