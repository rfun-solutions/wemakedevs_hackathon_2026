-- b-capture: promises made ("I'll send you the repo"), with a done toggle.
CREATE TABLE IF NOT EXISTS promises (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  text        NOT NULL,
  client_id  uuid        NOT NULL,
  text       text        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 1000),
  person_id  uuid        NULL,
  due        date        NULL,
  done       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, client_id)
);
CREATE INDEX IF NOT EXISTS promises_device_created_idx ON promises (device_id, created_at DESC);
