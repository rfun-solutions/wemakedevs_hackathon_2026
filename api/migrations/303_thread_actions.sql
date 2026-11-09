-- c-evening-threads: next steps. follow_up rows hold text; promise rows point at B's promises (read at view time).
CREATE TABLE IF NOT EXISTS thread_actions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid        NOT NULL REFERENCES threads (id) ON DELETE CASCADE,
  device_id  text        NOT NULL,
  kind       text        NOT NULL CHECK (kind IN ('follow_up', 'promise')),
  text       text        NULL,
  promise_id uuid        NULL,
  done       boolean     NOT NULL DEFAULT false,
  source     text        NOT NULL CHECK (source IN ('llm', 'heuristic')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'follow_up' AND text IS NOT NULL AND promise_id IS NULL)
      OR (kind = 'promise' AND promise_id IS NOT NULL)),
  UNIQUE (thread_id, promise_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS thread_actions_promise_uniq ON thread_actions (promise_id) WHERE promise_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS thread_actions_device_done_idx ON thread_actions (device_id, done);
