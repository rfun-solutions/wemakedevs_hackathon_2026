-- b-capture: people met. Names are free text entered by the device owner.
CREATE TABLE IF NOT EXISTS people (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id  text        NOT NULL,
  client_id  uuid        NOT NULL,
  name       text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  context    text        NULL CHECK (context IS NULL OR char_length(context) <= 1000),
  note_id    uuid        NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, client_id)
);
CREATE INDEX IF NOT EXISTS people_device_created_idx ON people (device_id, created_at DESC);
