-- A: one row per ingest run; F reads the latest success for the freshness display.
CREATE TABLE IF NOT EXISTS feed_runs (
  id            bigserial PRIMARY KEY,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL CHECK (status IN ('running', 'ok', 'error')),
  session_count integer,
  error         text
);
CREATE INDEX IF NOT EXISTS feed_runs_finished_idx ON feed_runs (finished_at DESC);
