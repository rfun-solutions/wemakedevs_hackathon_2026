-- c-evening-threads: a thread groups one device's notes by topic across days.
CREATE TABLE IF NOT EXISTS threads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  text        NOT NULL,
  title      text        NOT NULL,
  summary    text        NOT NULL DEFAULT '',
  first_day  date        NOT NULL,
  last_day   date        NOT NULL,
  source     text        NOT NULL CHECK (source IN ('llm', 'heuristic')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS threads_device_last_day_idx ON threads (device_id, last_day DESC);
