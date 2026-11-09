-- b-capture: notes captured by a device (typed, dictated or caption highlight).
CREATE TABLE IF NOT EXISTS notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  text        NOT NULL,
  client_id  uuid        NOT NULL,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  source     text        NOT NULL CHECK (source IN ('typed', 'dictated', 'caption')),
  session_id text        NULL,
  person_ids uuid[]      NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, client_id)
);
CREATE INDEX IF NOT EXISTS notes_device_created_idx ON notes (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notes_device_session_idx ON notes (device_id, session_id) WHERE session_id IS NOT NULL;
